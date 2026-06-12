from __future__ import annotations

import csv
import io
import json


def results_to_csv(results) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["algorithm", "driver", "sequence", "customer", "arrival", "status", "wait_min", "lateness_min", "distance_km"])
    for result in results:
        for route in result.routes:
            for index, stop in enumerate(route.stops, start=1):
                writer.writerow([
                    result.algorithm,
                    route.driver_id,
                    index,
                    stop.order.customer_name,
                    stop.arrival_time,
                    stop.status,
                    stop.wait_minutes,
                    stop.lateness_minutes,
                    stop.distance_km,
                ])
    return buffer.getvalue()


def results_to_json(results) -> str:
    return json.dumps([result.model_dump() for result in results], indent=2)
