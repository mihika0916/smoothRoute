from __future__ import annotations

from time import perf_counter

from models import Order, Settings
from services.metrics import evaluate_routes, parse_time
from services.road_network import leg_cost


def solve(orders: list[Order], settings: Settings, warnings=None, include_geometry: bool = True):
    started = perf_counter()
    try:
        from ortools.constraint_solver import pywrapcp, routing_enums_pb2
    except Exception:
        fallback_routes = [[] for _ in range(settings.drivers)]
        for index, order in enumerate(sorted(orders, key=lambda item: parse_time(item.window_end))):
            fallback_routes[index % settings.drivers].append(order)
        return evaluate_routes(
            "OR-Tools",
            fallback_routes,
            settings,
            started,
            (warnings or []) + ["OR-Tools is not installed. Showing a friendly benchmark placeholder route; install ortools to enable VRPTW solving."],
            include_geometry=include_geometry,
        )

    nodes = [settings.depot] + orders
    manager = pywrapcp.RoutingIndexManager(len(nodes), settings.drivers, 0)
    routing = pywrapcp.RoutingModel(manager)
    matrix = build_time_matrix(nodes, settings)

    def transit(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        service = 0 if from_node == 0 else settings.service_time_minutes
        return matrix[from_node][to_node] + service

    transit_callback = routing.RegisterTransitCallback(transit)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback)
    start_min = minutes(settings.driver_start_time)
    route_end_offset = max(1, minutes(settings.route_end_time) - start_min)
    horizon = route_end_offset + 360
    routing.AddDimension(transit_callback, horizon, horizon, False, "Time")
    time_dimension = routing.GetDimensionOrDie("Time")
    lateness_penalty_per_minute = 10000
    overtime_penalty_per_minute = 1000
    for idx, order in enumerate(orders, start=1):
        index = manager.NodeToIndex(idx)
        window_start = max(0, minutes(order.window_start) - start_min)
        window_end = max(window_start, minutes(order.window_end) - start_min)
        time_dimension.CumulVar(index).SetRange(window_start, horizon)
        time_dimension.SetCumulVarSoftUpperBound(index, window_end, lateness_penalty_per_minute)
    for vehicle in range(settings.drivers):
        time_dimension.CumulVar(routing.Start(vehicle)).SetRange(0, 0)
        time_dimension.CumulVar(routing.End(vehicle)).SetRange(0, horizon)
        time_dimension.SetCumulVarSoftUpperBound(routing.End(vehicle), route_end_offset, overtime_penalty_per_minute)
        routing.AddVariableMinimizedByFinalizer(time_dimension.CumulVar(routing.Start(vehicle)))
        routing.AddVariableMinimizedByFinalizer(time_dimension.CumulVar(routing.End(vehicle)))
    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    params.time_limit.FromSeconds(8)
    solution = routing.SolveWithParameters(params)
    if not solution:
        from algorithms import greedy

        fallback = greedy.solve(orders, settings, [], include_geometry=False)
        fallback_routes = [[stop.order for stop in route.stops] for route in fallback.routes]
        return evaluate_routes(
            "OR-Tools",
            fallback_routes,
            settings,
            started,
            (warnings or []) + ["OR-Tools could not find a strict feasible solution; showing Greedy fallback route for comparison."],
            include_geometry=include_geometry,
        )
    routes = []
    for vehicle in range(settings.drivers):
        index = routing.Start(vehicle)
        route = []
        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            if node != 0:
                route.append(orders[node - 1])
            index = solution.Value(routing.NextVar(index))
        routes.append(route)
    return evaluate_routes("OR-Tools", routes, settings, started, warnings, include_geometry=include_geometry)


def build_time_matrix(nodes, settings: Settings) -> list[list[int]]:
    matrix = []
    for left in nodes:
        row = []
        for right in nodes:
            row.append(int(round(leg_cost(left.latitude, left.longitude, right.latitude, right.longitude, settings).duration_minutes)))
        matrix.append(row)
    return matrix


def minutes(value: str) -> int:
    parsed = parse_time(value)
    return parsed.hour * 60 + parsed.minute
