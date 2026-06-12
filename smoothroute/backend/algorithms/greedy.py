from __future__ import annotations

from time import perf_counter

from models import Order, Settings
from services.metrics import evaluate_routes, parse_time
from services.road_network import leg_cost


def solve(orders: list[Order], settings: Settings, warnings=None, include_geometry: bool = True):
    started = perf_counter()
    remaining = sorted(orders, key=lambda order: parse_time(order.window_end))
    routes: list[list[Order]] = [[] for _ in range(settings.drivers)]
    driver_state = [
        {"time": parse_time(settings.driver_start_time), "lat": settings.depot.latitude, "lon": settings.depot.longitude}
        for _ in range(settings.drivers)
    ]
    while remaining:
        for driver_idx in range(settings.drivers):
            if not remaining:
                break
            state = driver_state[driver_idx]
            best = choose_next(remaining, state, settings)
            remaining.remove(best)
            routes[driver_idx].append(best)
            leg = leg_cost(state["lat"], state["lon"], best.latitude, best.longitude, settings)
            arrival = state["time"] + __import__("datetime").timedelta(minutes=leg.duration_minutes)
            window_start = parse_time(best.window_start)
            served = max(arrival, window_start)
            state["time"] = served + __import__("datetime").timedelta(minutes=settings.service_time_minutes)
            state["lat"], state["lon"] = best.latitude, best.longitude
    return evaluate_routes("Greedy", routes, settings, started, warnings, include_geometry=include_geometry)


def choose_next(orders: list[Order], state: dict, settings: Settings) -> Order:
    feasible = []
    fallback = []
    for order in orders:
        leg = leg_cost(state["lat"], state["lon"], order.latitude, order.longitude, settings)
        distance = leg.distance_km
        arrival = state["time"] + __import__("datetime").timedelta(minutes=leg.duration_minutes)
        served = max(arrival, parse_time(order.window_start))
        lateness = max(0, (served - parse_time(order.window_end)).total_seconds() / 60)
        row = (lateness, distance, parse_time(order.window_end), order)
        if lateness == 0:
            feasible.append(row)
        fallback.append(row)
    pool = feasible or fallback
    return sorted(pool, key=lambda item: (item[0], item[2], item[1]))[0][3]
