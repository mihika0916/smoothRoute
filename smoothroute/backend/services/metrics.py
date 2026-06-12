from __future__ import annotations

from datetime import datetime, timedelta
from statistics import pstdev
from time import perf_counter

from models import AlgorithmResult, DriverRoute, Order, Settings, StopResult
from services.distance import coordinates
from services.road_network import leg_cost, route_geometry


BASE_DATE = "2026-01-01"


def parse_time(value: str) -> datetime:
    clean = value.strip()
    for pattern in ("%H:%M", "%H:%M:%S", "%I:%M %p", "%I:%M%p"):
        try:
            parsed = datetime.strptime(clean.upper(), pattern)
            return datetime.fromisoformat(BASE_DATE).replace(hour=parsed.hour, minute=parsed.minute, second=parsed.second)
        except ValueError:
            continue
    return datetime.fromisoformat(f"{BASE_DATE}T{clean}:00" if len(clean) == 5 else f"{BASE_DATE}T{clean}")


def format_time(value: datetime) -> str:
    return value.strftime("%H:%M")


def status_for(lateness: float, slack: float) -> str:
    if lateness > 0:
        return "late"
    if slack <= 5:
        return "risky"
    return "on-time"


def evaluate_routes(name: str, raw_routes: list[list[Order]], settings: Settings, started_at: float, warnings=None, include_geometry: bool = True) -> AlgorithmResult:
    depot = settings.depot
    start = parse_time(settings.driver_start_time)
    driver_routes: list[DriverRoute] = []
    result_warnings = list(warnings or [])
    for driver_idx, orders in enumerate(raw_routes, start=1):
        cursor = start
        current_lat, current_lon = depot.latitude, depot.longitude
        route_distance = 0.0
        route_travel = 0.0
        stops: list[StopResult] = []
        route_points = [(depot.latitude, depot.longitude)]
        for order in orders:
            lat, lon = coordinates(order)
            leg = leg_cost(current_lat, current_lon, lat, lon, settings)
            distance = leg.distance_km
            travel = leg.duration_minutes
            if leg.warning:
                result_warnings.append(leg.warning)
            arrival = cursor + timedelta(minutes=travel)
            window_start = parse_time(order.window_start)
            window_end = parse_time(order.window_end)
            wait = max(0.0, (window_start - arrival).total_seconds() / 60)
            served_at = arrival + timedelta(minutes=wait)
            lateness = max(0.0, (served_at - window_end).total_seconds() / 60)
            slack = (window_end - served_at).total_seconds() / 60
            stops.append(
                StopResult(
                    order=order,
                    arrival_time=format_time(served_at),
                    wait_minutes=round(wait, 1),
                    lateness_minutes=round(lateness, 1),
                    travel_minutes=round(travel, 1),
                    distance_km=round(distance, 2),
                    status=status_for(lateness, slack),
                )
            )
            cursor = served_at + timedelta(minutes=settings.service_time_minutes)
            current_lat, current_lon = lat, lon
            route_distance += distance
            route_travel += travel
            route_points.append((lat, lon))
        if orders:
            back_leg = leg_cost(current_lat, current_lon, depot.latitude, depot.longitude, settings)
            route_distance += back_leg.distance_km
            route_travel += back_leg.duration_minutes
            if back_leg.warning:
                result_warnings.append(back_leg.warning)
            route_points.append((depot.latitude, depot.longitude))
        road_path = [{"lat": lat, "lng": lon} for lat, lon in route_points]
        if include_geometry and orders:
            geometry = route_geometry(route_points, settings)
            road_path = geometry.path
            if geometry.warning:
                result_warnings.append(geometry.warning)
        duration = (cursor - start).total_seconds() / 60
        maps = "https://www.google.com/maps/dir/?api=1&origin={lat},{lon}&destination={lat},{lon}".format(
            lat=depot.latitude, lon=depot.longitude
        )
        driver_routes.append(
            DriverRoute(
                driver_id=driver_idx,
                stops=stops,
                total_distance_km=round(route_distance, 2),
                total_route_duration_minutes=round(duration, 1),
                total_travel_minutes=round(route_travel, 1),
                maps_link=maps,
                path=road_path,
            )
        )
    return AlgorithmResult(
        algorithm=name,
        routes=driver_routes,
        metrics=build_metrics(driver_routes, started_at),
        warnings=dedupe(result_warnings),
    )


def dedupe(values: list[str]) -> list[str]:
    seen = set()
    clean = []
    for value in values:
        if value not in seen:
            clean.append(value)
            seen.add(value)
    return clean


def build_metrics(routes: list[DriverRoute], started_at: float) -> dict:
    stops = [stop for route in routes for stop in route.stops]
    lateness = [stop.lateness_minutes for stop in stops]
    late_count = sum(1 for value in lateness if value > 0)
    durations = [route.total_route_duration_minutes for route in routes]
    on_time = len(stops) - late_count
    return {
        "total_distance_km": round(sum(route.total_distance_km for route in routes), 2),
        "total_travel_time_minutes": round(sum(route.total_travel_minutes for route in routes), 1),
        "total_route_duration_minutes": round(sum(durations), 1),
        "late_deliveries": late_count,
        "average_lateness_minutes": round(sum(lateness) / len(lateness), 1) if lateness else 0,
        "maximum_lateness_minutes": round(max(lateness), 1) if lateness else 0,
        "on_time_deliveries": on_time,
        "on_time_percentage": round((on_time / len(stops)) * 100, 1) if stops else 100,
        "driver_utilization_balance": round(pstdev(durations), 1) if len(durations) > 1 else 0,
        "computation_time_ms": round((perf_counter() - started_at) * 1000, 2),
        "feasible": late_count == 0,
    }
