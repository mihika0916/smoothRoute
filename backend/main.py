from __future__ import annotations

import csv
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from algorithms import clarke_wright, greedy, ortools_solver
from database import init_db, record_run
from models import ExportRequest, GeocodeRequest, GeocodeResult, OptimizeRequest, ReverseGeocodeRequest, RoadSnapRequest, SimulationGenerateRequest, SimulationRunRequest
from services.export import results_to_csv, results_to_json
from services.geocoding import geocode_address, reverse_geocode, search_addresses
from services.road_network import nearest_road, prepare_road_matrix
from services.simulation import ensure_coordinates, generate_orders, generate_orders_with_warnings


app = FastAPI(title="SmoothRoute API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


SOLVERS = {
    "greedy": greedy.solve,
    "clarke_wright": clarke_wright.solve,
    "ortools": ortools_solver.solve,
}


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/geocode", response_model=GeocodeResult)
def geocode(payload: GeocodeRequest):
    return geocode_address(payload.address)


@app.post("/api/geocode/search")
def geocode_search(payload: GeocodeRequest):
    try:
        return {"results": search_addresses(payload.address)}
    except Exception as error:
        return {"results": [], "warning": f"Could not geocode this address: {error}"}


@app.post("/api/geocode/reverse", response_model=GeocodeResult)
def geocode_reverse(payload: ReverseGeocodeRequest):
    return reverse_geocode(payload.latitude, payload.longitude)


@app.post("/api/road/snap")
def road_snap(payload: RoadSnapRequest):
    snapped = nearest_road(payload.latitude, payload.longitude, payload.settings)
    if snapped is None:
        return {
            "snapped": False,
            "latitude": payload.latitude,
            "longitude": payload.longitude,
            "warning": "Could not snap this point to a drivable road within the configured threshold.",
        }
    return {
        "snapped": True,
        "latitude": snapped.latitude,
        "longitude": snapped.longitude,
        "distance_m": snapped.distance_m,
        "provider": snapped.provider,
    }


@app.post("/api/business/optimize")
def optimize_business(payload: OptimizeRequest):
    orders, warnings = ensure_coordinates(payload.orders, payload.settings)
    warnings.extend(prepare_road_matrix(orders, payload.settings))
    solver = SOLVERS.get(payload.algorithm, greedy.solve)
    result = solver(orders, payload.settings, warnings)
    record_run("business", result, payload.settings.drivers)
    return result


@app.post("/api/simulation/generate")
def simulation_generate(payload: SimulationGenerateRequest):
    orders, warnings = generate_orders_with_warnings(payload.number_of_orders, payload.settings, payload.seed)
    return {
        "orders": orders,
        "settings": payload.settings,
        "warnings": warnings,
    }


@app.post("/api/simulation/run")
def simulation_run(payload: SimulationRunRequest):
    return run_algorithms(payload)


@app.post("/api/simulation/compare")
def simulation_compare(payload: SimulationRunRequest):
    results = run_algorithms(payload)
    if payload.simulation_runs <= 1:
        for result in results["results"]:
            result.metrics["feasibility_rate"] = 100.0 if result.metrics["feasible"] else 0.0
        return {"results": results["results"]}
    successes = {key: [] for key in results["algorithm_keys"]}
    for run in range(payload.simulation_runs):
        scenario = generate_orders(len(payload.orders), payload.settings, run + 100)
        prepare_road_matrix(scenario, payload.settings)
        for key in results["algorithm_keys"]:
            trial = SOLVERS[key](scenario, payload.settings, [], include_geometry=False)
            successes[key].append(1 if trial.metrics["feasible"] else 0)
    for result, key in zip(results["results"], results["algorithm_keys"]):
        result.metrics["feasibility_rate"] = round(sum(successes[key]) / len(successes[key]) * 100, 1)
    return {"results": results["results"]}


def run_algorithms(payload: SimulationRunRequest):
    orders, warnings = ensure_coordinates(payload.orders, payload.settings)
    warnings.extend(prepare_road_matrix(orders, payload.settings))
    results = []
    keys = []
    for key in payload.algorithms:
        solver = SOLVERS.get(key)
        if not solver:
            continue
        result = solver(orders, payload.settings, warnings)
        record_run("research", result, payload.settings.drivers)
        results.append(result)
        keys.append(key)
    return {"results": results, "algorithm_keys": keys}


@app.get("/api/sample-orders", response_class=PlainTextResponse)
def sample_orders():
    return Path(__file__).parent.joinpath("sample_data", "sample_orders.csv").read_text()


@app.post("/api/export/csv", response_class=PlainTextResponse)
def export_csv(payload: ExportRequest):
    return results_to_csv(payload.results)


@app.post("/api/export/json", response_class=PlainTextResponse)
def export_json(payload: ExportRequest):
    return results_to_json(payload.results)


def parse_csv_orders(text: str):
    return list(csv.DictReader(text.splitlines()))
