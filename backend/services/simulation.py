from __future__ import annotations

import math
import random
from datetime import timedelta

from models import Order, Settings
from services.distance import haversine_km
from services.metrics import format_time, parse_time
from services.road_network import nearest_road, road_routing_enabled


def geocode_placeholder(address: str) -> tuple[float | None, float | None]:
    # Intentional integration point for Google Maps, Mapbox, or OpenRouteService.
    return None, None


def ensure_coordinates(orders: list[Order], settings: Settings) -> tuple[list[Order], list[str]]:
    ready: list[Order] = []
    warnings: list[str] = []
    for order in orders:
        if order.latitude is None or order.longitude is None:
            lat, lon = geocode_placeholder(order.address)
            if lat is None or lon is None:
                warnings.append(f"{order.customer_name} skipped: coordinates missing and geocoding is not configured.")
                continue
            order.latitude, order.longitude = lat, lon
        distance = haversine_km(settings.depot.latitude, settings.depot.longitude, order.latitude, order.longitude)
        if distance <= settings.delivery_radius_km:
            ready.append(order)
        else:
            warnings.append(f"{order.customer_name} is outside the {settings.delivery_radius_km} km delivery radius.")
    return ready, warnings


def generate_orders(count: int, settings: Settings, seed: int | None = 42) -> list[Order]:
    orders, _ = generate_orders_with_warnings(count, settings, seed)
    return orders


def generate_orders_with_warnings(count: int, settings: Settings, seed: int | None = 42) -> tuple[list[Order], list[str]]:
    rng = random.Random(seed)
    depot = settings.depot
    start = parse_time(settings.driver_start_time)
    end = parse_time(settings.route_end_time) - timedelta(minutes=30)
    span = int((end - start).total_seconds() // 60)
    orders = []
    warnings = []
    require_snap = settings.snap_to_road and road_routing_enabled(settings)
    if require_snap and nearest_road(depot.latitude, depot.longitude, settings) is None:
        warnings.append(
            "The depot coordinates could not be snapped to OSRM's road network. Check latitude/longitude signs and values, or geocode the depot address before generating."
        )
        require_snap = False
    attempts = 0
    max_attempts = max(count * 35, 50)
    while len(orders) < count and attempts < max_attempts:
        attempts += 1
        bearing = rng.uniform(0, 6.283185)
        distance = settings.delivery_radius_km * (rng.random() ** 0.5)
        d_lat = (distance / 111.0) * math.cos(bearing)
        d_lon = (distance / (111.0 * math.cos(math.radians(depot.latitude)))) * math.sin(bearing)
        lat = depot.latitude + d_lat
        lon = depot.longitude + d_lon
        snap_note = ""
        if require_snap:
            snapped = nearest_road(lat, lon, settings)
            if snapped is None:
                continue
            if haversine_km(depot.latitude, depot.longitude, snapped.latitude, snapped.longitude) > settings.delivery_radius_km:
                continue
            lat, lon = snapped.latitude, snapped.longitude
            snap_note = f"Road-snapped by {snapped.provider}; candidate offset {snapped.distance_m}m"
        window_start = start + timedelta(minutes=rng.randrange(0, max(1, span // 30)) * 30)
        order_index = len(orders) + 1
        orders.append(
            Order(
                id=f"ORD-{order_index:03d}",
                customer_name=f"Demo Customer {order_index}",
                address=f"Sector {rng.choice([43, 54, 55, 56, 57])}, Gurugram",
                latitude=round(lat, 6),
                longitude=round(lon, 6),
                window_start=format_time(window_start),
                window_end=format_time(window_start + timedelta(minutes=30)),
                notes=snap_note or rng.choice(["No ice", "Ring bell", "High protein", "Leave at reception", ""]),
            )
        )
    if len(orders) < count:
        warnings.append(f"Generated {len(orders)} of {count} requested customers after road-snap filtering. Increase radius or snap distance, or check OSRM availability.")
    return orders, warnings
