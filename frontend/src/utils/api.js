const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

async function post(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export const api = {
  sampleOrders: () => fetch(`${API_BASE}/api/sample-orders`).then((res) => res.text()),
  optimizeBusiness: (payload) => post("/api/business/optimize", payload),
  geocode: (payload) => post("/api/geocode", payload),
  geocodeSearch: (payload) => post("/api/geocode/search", payload),
  reverseGeocode: (payload) => post("/api/geocode/reverse", payload),
  snapLocation: (payload) => post("/api/road/snap", payload),
  generateScenario: (payload) => post("/api/simulation/generate", payload),
  runSimulation: (payload) => post("/api/simulation/compare", payload),
  exportCsv: (payload) => fetch(`${API_BASE}/api/export/csv`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((res) => res.text()),
  exportJson: (payload) => fetch(`${API_BASE}/api/export/json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((res) => res.text()),
};

export const defaultSettings = {
  drivers: 3,
  depot: {
    name: "Suncity School",
    address: "Suncity School, Suncity Road, Sun City, Sector 54, Gurgaon, Gurugram, Haryana, 122002, India",
    latitude: 28.434364,
    longitude: 77.112579,
  },
  delivery_radius_km: 4.8,
  driver_start_time: "06:00",
  route_end_time: "11:00",
  service_time_minutes: 3,
  average_speed_kmh: 20,
  routing_mode: "road",
  road_provider: "osrm",
  osrm_profile: "driving",
  osrm_base_url: "http://router.project-osrm.org",
  snap_to_road: true,
  max_snap_distance_m: 250,
  road_request_timeout_seconds: 1.5,
};

export function downloadFile(name, text, type) {
  const blob = new Blob([text], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}
