from __future__ import annotations

import sqlite3
from pathlib import Path


DB_PATH = Path(__file__).with_name("smoothroute.sqlite3")


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS route_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                mode TEXT NOT NULL,
                algorithm TEXT NOT NULL,
                orders_count INTEGER NOT NULL,
                drivers INTEGER NOT NULL,
                total_distance_km REAL NOT NULL,
                late_deliveries INTEGER NOT NULL
            )
            """
        )


def record_run(mode: str, result, drivers: int) -> None:
    init_db()
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO route_runs (mode, algorithm, orders_count, drivers, total_distance_km, late_deliveries)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                mode,
                result.algorithm,
                sum(len(route.stops) for route in result.routes),
                drivers,
                result.metrics["total_distance_km"],
                result.metrics["late_deliveries"],
            ),
        )
