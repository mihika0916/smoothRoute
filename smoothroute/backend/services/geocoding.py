from __future__ import annotations

import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def geocode_address(address: str) -> dict:
    if not address.strip():
        return {
            "address": address,
            "latitude": None,
            "longitude": None,
            "display_name": "",
            "warning": "Enter a depot address before geocoding.",
        }
    params = urlencode({"q": address, "format": "jsonv2", "limit": 1})
    request = Request(
        f"https://nominatim.openstreetmap.org/search?{params}",
        headers={"User-Agent": "SmoothRoute/1.0 local routing demo"},
    )
    try:
        with urlopen(request, timeout=8) as response:
            rows = json.loads(response.read().decode("utf-8"))
    except Exception as error:
        return {
            "address": address,
            "latitude": None,
            "longitude": None,
            "display_name": "",
            "warning": f"Geocoding failed: {error}",
        }
    if not rows:
        return {
            "address": address,
            "latitude": None,
            "longitude": None,
            "display_name": "",
            "warning": "No geocoding result found for that address.",
        }
    best = rows[0]
    return {
        "address": address,
        "latitude": round(float(best["lat"]), 6),
        "longitude": round(float(best["lon"]), 6),
        "display_name": best.get("display_name", ""),
        "warning": "",
    }


def search_addresses(query: str, limit: int = 5) -> list[dict]:
    if len(query.strip()) < 3:
        return []
    params = urlencode({"q": query, "format": "jsonv2", "limit": limit, "addressdetails": 1})
    rows = nominatim_json(f"https://nominatim.openstreetmap.org/search?{params}")
    if not isinstance(rows, list):
        return []
    return [format_search_row(row) for row in rows]


def reverse_geocode(latitude: float, longitude: float) -> dict:
    params = urlencode({"lat": latitude, "lon": longitude, "format": "jsonv2", "zoom": 18, "addressdetails": 1})
    row = nominatim_json(f"https://nominatim.openstreetmap.org/reverse?{params}")
    if not isinstance(row, dict) or row.get("error"):
        return {
            "address": "",
            "latitude": round(latitude, 6),
            "longitude": round(longitude, 6),
            "display_name": "",
            "warning": "Could not reverse-geocode this map location.",
        }
    return {
        "address": row.get("display_name", ""),
        "latitude": round(latitude, 6),
        "longitude": round(longitude, 6),
        "display_name": row.get("display_name", ""),
        "warning": "",
    }


def nominatim_json(url: str):
    request = Request(url, headers={"User-Agent": "SmoothRoute/1.0 local routing demo"})
    with urlopen(request, timeout=8) as response:
        return json.loads(response.read().decode("utf-8"))


def format_search_row(row: dict) -> dict:
    display = row.get("display_name", "")
    name = row.get("name") or display.split(",")[0] if display else "Unnamed place"
    return {
        "name": name,
        "address": display,
        "latitude": round(float(row["lat"]), 6),
        "longitude": round(float(row["lon"]), 6),
        "type": row.get("type", ""),
    }
