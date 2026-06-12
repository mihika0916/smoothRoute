import { Download, MapPinned, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import BusinessOrderUpload from "../components/BusinessOrderUpload.jsx";
import DriverTimeline from "../components/DriverTimeline.jsx";
import MapView from "../components/MapView.jsx";
import { api, defaultSettings, downloadFile } from "../utils/api.js";

export default function BusinessMode() {
  const [settings, setSettings] = useState(defaultSettings);
  const [orders, setOrders] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.sampleOrders().then((text) => {
      const [header, ...lines] = text.trim().split(/\r?\n/);
      const keys = header.split(",");
      setOrders(lines.map((line, index) => {
        const row = Object.fromEntries(keys.map((key, i) => [key, line.split(",")[i] || ""]));
        return { ...row, id: `SAMPLE-${index + 1}`, latitude: Number(row.latitude), longitude: Number(row.longitude) };
      }));
    });
  }, []);

  async function optimize() {
    setBusy(true);
    try {
      setResult(await api.optimizeBusiness({ orders, settings, algorithm: "greedy" }));
    } finally {
      setBusy(false);
    }
  }

  async function exportPlan(type) {
    const payload = { results: [result] };
    const text = type === "csv" ? await api.exportCsv(payload) : await api.exportJson(payload);
    downloadFile(`smoothroute-plan.${type}`, text, type === "csv" ? "text/csv" : "application/json");
  }

  return (
    <div className="page-grid">
      <aside>
        <section className="panel hero-panel">
          <p className="eyebrow">Business Mode</p>
          <h2>Generate today's smoothie routes before the 6 AM rush.</h2>
          <p>Depot is pinned to Suncity School. Orders without coordinates are skipped with a clean geocoding placeholder warning.</p>
          <button className="primary wide" onClick={optimize} disabled={busy}><Wand2 size={18} /> Generate Today's Routes</button>
        </section>
        <section className="panel settings">
          <label>Drivers<input type="number" value={settings.drivers} onChange={(e) => setSettings({ ...settings, drivers: Number(e.target.value) })} /></label>
          <label>Radius km<input type="number" value={settings.delivery_radius_km} onChange={(e) => setSettings({ ...settings, delivery_radius_km: Number(e.target.value) })} /></label>
          <label>Start<input value={settings.driver_start_time} onChange={(e) => setSettings({ ...settings, driver_start_time: e.target.value })} /></label>
          <label>End<input value={settings.route_end_time} onChange={(e) => setSettings({ ...settings, route_end_time: e.target.value })} /></label>
          <label>Service min<input type="number" value={settings.service_time_minutes} onChange={(e) => setSettings({ ...settings, service_time_minutes: Number(e.target.value) })} /></label>
        </section>
        <BusinessOrderUpload orders={orders} setOrders={setOrders} />
      </aside>
      <section className="workspace">
        <div className="panel map-shell">
          <div className="section-title inline">
            <div><h2><MapPinned size={20} /> Route Map</h2><p>Driver routes, customer stops, and depot marker.</p></div>
            {result && <div className="actions"><button onClick={() => exportPlan("csv")}><Download size={16} /> CSV</button><button onClick={() => exportPlan("json")}><Download size={16} /> JSON</button></div>}
          </div>
          <MapView result={result} orders={orders} settings={settings} />
        </div>
        {result && <Summary result={result} />}
        <DriverTimeline result={result} />
      </section>
    </div>
  );
}

function Summary({ result }) {
  return (
    <section className="summary-grid">
      {result.routes.map((route) => (
        <article className="summary-card" key={route.driver_id}>
          <h3>Driver {route.driver_id}</h3>
          <b>{route.total_distance_km} km</b>
          <span>{route.total_route_duration_minutes} min route</span>
          <ol>{route.stops.map((stop) => <li key={stop.order.id} className={stop.status}>{stop.arrival_time} {stop.order.customer_name}</li>)}</ol>
        </article>
      ))}
    </section>
  );
}
