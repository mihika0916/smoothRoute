from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from time import monotonic
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from models import Settings
from services.distance import haversine_km, travel_minutes

_UNAVAILABLE_UNTIL: dict[str, float] = {}
_LEG_TABLE: dict[tuple[str, tuple[float, float], tuple[float, float]], "RoadLeg"] = {}
_PROVIDER_COOLDOWN_SECONDS = 30


@dataclass
class RoadSnap:
    latitude: float
    longitude: float
    distance_m: float
    provider: str


@dataclass
class RoadLeg:
    distance_km: float
    duration_minutes: float
    path: list[dict[str, float]]
    provider: str
    warning: str | None = None


@dataclass
class RoadRoute:
    distance_km: float
    duration_minutes: float
    path: list[dict[str, float]]
    provider: str
    warning: str | None = None


def coord_key(latitude: float, longitude: float) -> tuple[float, float]:
    return round(latitude, 6), round(longitude, 6)


def road_routing_enabled(settings: Settings) -> bool:
    return settings.routing_mode == "road" and settings.road_provider == "osrm"


def provider_key(settings: Settings) -> str:
    return f"{settings.osrm_base_url.rstrip()}|{settings.osrm_profile}"


def provider_available(settings: Settings) -> bool:
    return _UNAVAILABLE_UNTIL.get(provider_key(settings), 0) <= monotonic()


def mark_provider_unavailable(settings: Settings) -> None:
    _UNAVAILABLE_UNTIL[provider_key(settings)] = monotonic() + _PROVIDER_COOLDOWN_SECONDS


def prepare_road_matrix(orders, settings: Settings) -> list[str]:
    if not road_routing_enabled(settings) or not provider_available(settings):
        return []
    nodes = [settings.depot] + list(orders)
    coordinates = ";".join(f"{node.longitude:.6f},{node.latitude:.6f}" for node in nodes)
    data = _osrm_json(
        settings.osrm_base_url,
        "table",
        settings.osrm_profile,
        coordinates,
        {"annotations": "distance,duration"},
        settings.road_request_timeout_seconds,
    )
    if data is None:
        mark_provider_unavailable(settings)
        return ["OSRM table service is unavailable; falling back to per-leg routing or Haversine estimates."]
    if data.get("code") != "Ok" or not data.get("durations") or not data.get("distances"):
        return [f"OSRM table service returned {data.get('code', 'Unknown')}; falling back to per-leg routing or Haversine estimates."]
    key = provider_key(settings)
    for i, source in enumerate(nodes):
        for j, destination in enumerate(nodes):
            duration = data["durations"][i][j]
            distance = data["distances"][i][j]
            if duration is None or distance is None:
                continue
            source_key = coord_key(source.latitude, source.longitude)
            destination_key = coord_key(destination.latitude, destination.longitude)
            _LEG_TABLE[(key, source_key, destination_key)] = RoadLeg(
                distance_km=distance / 1000,
                duration_minutes=duration / 60,
                path=[{"lat": source.latitude, "lng": source.longitude}, {"lat": destination.latitude, "lng": destination.longitude}],
                provider="OSRM Table",
            )
    return []


def nearest_road(latitude: float, longitude: float, settings: Settings) -> RoadSnap | None:
    if not road_routing_enabled(settings):
        return None
    if not provider_available(settings):
        return None
    data = _osrm_json(
        settings.osrm_base_url,
        "nearest",
        settings.osrm_profile,
        f"{longitude:.6f},{latitude:.6f}",
        {"number": 1, "snapping": "any"},
        settings.road_request_timeout_seconds,
    )
    if data is None:
        mark_provider_unavailable(settings)
        return None
    if data.get("code") != "Ok" or not data.get("waypoints"):
        return None
    waypoint = data["waypoints"][0]
    if waypoint.get("distance", 999999) > settings.max_snap_distance_m:
        return None
    lon, lat = waypoint["location"]
    return RoadSnap(latitude=round(lat, 6), longitude=round(lon, 6), distance_m=round(waypoint["distance"], 1), provider="OSRM")


def route_leg(a_lat: float, a_lon: float, b_lat: float, b_lon: float, settings: Settings) -> RoadLeg:
    if road_routing_enabled(settings) and provider_available(settings):
        leg = _cached_route_leg(
            settings.osrm_base_url,
            settings.osrm_profile,
            round(a_lat, 6),
            round(a_lon, 6),
            round(b_lat, 6),
            round(b_lon, 6),
            settings.road_request_timeout_seconds,
        )
        if leg is not None:
            return leg
    distance = haversine_km(a_lat, a_lon, b_lat, b_lon)
    return RoadLeg(
        distance_km=distance,
        duration_minutes=travel_minutes(distance, settings.average_speed_kmh),
        path=[{"lat": a_lat, "lng": a_lon}, {"lat": b_lat, "lng": b_lon}],
        provider="Haversine",
        warning="Road network provider unavailable; fell back to straight-line Haversine estimates.",
    )


def leg_cost(a_lat: float, a_lon: float, b_lat: float, b_lon: float, settings: Settings) -> RoadLeg:
    key = (provider_key(settings), coord_key(a_lat, a_lon), coord_key(b_lat, b_lon))
    if key in _LEG_TABLE:
        return _LEG_TABLE[key]
    return route_leg(a_lat, a_lon, b_lat, b_lon, settings)


def route_geometry(points: list[tuple[float, float]], settings: Settings) -> RoadRoute:
    if len(points) < 2:
        return RoadRoute(0, 0, [{"lat": points[0][0], "lng": points[0][1]}] if points else [], "None")
    if road_routing_enabled(settings) and provider_available(settings):
        coordinates = ";".join(f"{lon:.6f},{lat:.6f}" for lat, lon in points)
        data = _osrm_json(
            settings.osrm_base_url,
            "route",
            settings.osrm_profile,
            coordinates,
            {"overview": "full", "geometries": "geojson", "steps": "false", "alternatives": "false"},
            settings.road_request_timeout_seconds,
        )
        if data and data.get("code") == "Ok" and data.get("routes"):
            route = data["routes"][0]
            coords = route["geometry"]["coordinates"]
            return RoadRoute(
                distance_km=route["distance"] / 1000,
                duration_minutes=route["duration"] / 60,
                path=[{"lat": lat, "lng": lon} for lon, lat in coords],
                provider="OSRM",
            )
        if data is None:
            mark_provider_unavailable(settings)
    path = [{"lat": lat, "lng": lon} for lat, lon in points]
    distance = 0.0
    duration = 0.0
    for (a_lat, a_lon), (b_lat, b_lon) in zip(points, points[1:]):
        leg = leg_cost(a_lat, a_lon, b_lat, b_lon, settings)
        distance += leg.distance_km
        duration += leg.duration_minutes
    return RoadRoute(distance, duration, path, "Fallback", "Road route geometry unavailable; displayed straight segments for this route.")


@lru_cache(maxsize=4096)
def _cached_route_leg(base_url: str, profile: str, a_lat: float, a_lon: float, b_lat: float, b_lon: float, timeout: float) -> RoadLeg | None:
    data = _osrm_json(
        base_url,
        "route",
        profile,
        f"{a_lon:.6f},{a_lat:.6f};{b_lon:.6f},{b_lat:.6f}",
        {"overview": "full", "geometries": "geojson", "steps": "false", "alternatives": "false"},
        timeout,
    )
    if data is None:
        return None
    if data.get("code") != "Ok" or not data.get("routes"):
        return None
    route = data["routes"][0]
    coords = route["geometry"]["coordinates"]
    return RoadLeg(
        distance_km=route["distance"] / 1000,
        duration_minutes=route["duration"] / 60,
        path=[{"lat": lat, "lng": lon} for lon, lat in coords],
        provider="OSRM",
    )


def _osrm_json(base_url: str, service: str, profile: str, coordinates: str, params: dict, timeout: float) -> dict | None:
    query = urlencode(params)
    url = f"{base_url.rstrip('/')}/{service}/v1/{profile}/{coordinates}?{query}"
    try:
        with urlopen(url, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        try:
            return json.loads(error.read().decode("utf-8"))
        except Exception:
            return {"code": f"HTTP{error.code}", "message": str(error)}
    except (TimeoutError, URLError, OSError):
        if base_url.rstrip("/") == "https://router.project-osrm.org":
            return _osrm_json("http://router.project-osrm.org", service, profile, coordinates, params, timeout)
        return None
