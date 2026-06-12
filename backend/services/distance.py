from __future__ import annotations

from math import asin, cos, radians, sin, sqrt


def haversine_km(a_lat: float, a_lon: float, b_lat: float, b_lon: float) -> float:
    radius = 6371.0
    d_lat = radians(b_lat - a_lat)
    d_lon = radians(b_lon - a_lon)
    lat1 = radians(a_lat)
    lat2 = radians(b_lat)
    h = sin(d_lat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(d_lon / 2) ** 2
    return 2 * radius * asin(sqrt(h))


def travel_minutes(distance_km: float, average_speed_kmh: float = 20) -> float:
    return (distance_km / average_speed_kmh) * 60


def coordinates(order_or_location) -> tuple[float, float]:
    lat = getattr(order_or_location, "latitude", None)
    lon = getattr(order_or_location, "longitude", None)
    if lat is None or lon is None:
        raise ValueError(f"Missing coordinates for {getattr(order_or_location, 'customer_name', 'location')}")
    return float(lat), float(lon)


def route_path(depot, stops) -> list[dict[str, float]]:
    path = [{"lat": depot.latitude, "lng": depot.longitude}]
    path.extend({"lat": stop.order.latitude, "lng": stop.order.longitude} for stop in stops)
    path.append({"lat": depot.latitude, "lng": depot.longitude})
    return path
