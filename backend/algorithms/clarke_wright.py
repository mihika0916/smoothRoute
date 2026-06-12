from __future__ import annotations

from time import perf_counter

from models import Order, Settings
from services.metrics import evaluate_routes, parse_time
from services.road_network import leg_cost


def solve(orders: list[Order], settings: Settings, warnings=None, include_geometry: bool = True):
    started = perf_counter()
    routes: list[list[Order]] = [[order] for order in orders]
    savings = compute_savings(orders, settings)
    for _, left, right in savings:
        left_route = find_route(routes, left)
        right_route = find_route(routes, right)
        if left_route is None or right_route is None or left_route is right_route:
            continue
        candidates = [
            left_route + right_route,
            right_route + left_route,
            repair_route(left_route + right_route),
            repair_route(right_route + left_route),
        ]
        feasible = [candidate for candidate in candidates if is_feasible(candidate, settings)]
        if feasible:
            routes.remove(left_route)
            routes.remove(right_route)
            routes.append(min(feasible, key=lambda route: route_distance(route, settings)))
    while len(routes) > settings.drivers:
        routes = merge_least_bad(routes, settings)
    routes = balance_routes(routes, settings.drivers)
    return evaluate_routes("Clarke-Wright", routes, settings, started, warnings, include_geometry=include_geometry)


def compute_savings(orders: list[Order], settings: Settings):
    depot = settings.depot
    rows = []
    for i, left in enumerate(orders):
        for right in orders[i + 1 :]:
            saving = (
                leg_cost(depot.latitude, depot.longitude, left.latitude, left.longitude, settings).distance_km
                + leg_cost(depot.latitude, depot.longitude, right.latitude, right.longitude, settings).distance_km
                - leg_cost(left.latitude, left.longitude, right.latitude, right.longitude, settings).distance_km
            )
            rows.append((saving, left, right))
    return sorted(rows, reverse=True, key=lambda row: row[0])


def find_route(routes, order):
    return next((route for route in routes if order in route), None)


def repair_route(route: list[Order]) -> list[Order]:
    return sorted(route, key=lambda order: (parse_time(order.window_end), parse_time(order.window_start)))


def is_feasible(route: list[Order], settings: Settings) -> bool:
    result = evaluate_routes("check", [route], settings, perf_counter(), include_geometry=False)
    return result.metrics["late_deliveries"] == 0


def route_distance(route: list[Order], settings: Settings) -> float:
    return evaluate_routes("distance", [route], settings, perf_counter(), include_geometry=False).metrics["total_distance_km"]


def merge_least_bad(routes: list[list[Order]], settings: Settings) -> list[list[Order]]:
    best = None
    for i, left in enumerate(routes):
        for j, right in enumerate(routes):
            if i >= j:
                continue
            for candidate in (repair_route(left + right), repair_route(right + left)):
                result = evaluate_routes("candidate", [candidate], settings, perf_counter(), include_geometry=False)
                score = result.metrics["late_deliveries"] * 10000 + result.metrics["maximum_lateness_minutes"] * 100 + result.metrics["total_distance_km"]
                if best is None or score < best[0]:
                    best = (score, i, j, candidate)
    _, i, j, candidate = best
    return [route for idx, route in enumerate(routes) if idx not in (i, j)] + [candidate]


def balance_routes(routes: list[list[Order]], drivers: int) -> list[list[Order]]:
    routes = sorted(routes, key=len, reverse=True)
    while len(routes) < drivers:
        routes.append([])
    return routes[:drivers]
