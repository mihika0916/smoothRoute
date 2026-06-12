import MapView from "./MapView.jsx";
import { addMinutes, normalizeTime } from "../utils/time.js";

export default function ScenarioPreview({ orders, settings, setSettings, controls, setControls, warnings = [], mode = "generate", onScenarioChange }) {
  if (!orders.length) return null;
  const windows = orders.reduce((groups, order) => {
    const key = `${normalizeTime(order.window_start)}-${normalizeTime(order.window_end, addMinutes(order.window_start, 30))}`;
    groups[key] = (groups[key] || 0) + 1;
    return groups;
  }, {});
  return (
    <section className="panel scenario-panel">
      <div className="section-title inline">
        <div>
          <h2>Active Test Case</h2>
          <p>{orders.length} customers around {settings.depot.name}, grouped into {Object.keys(windows).length} delivery windows.</p>
        </div>
        <span className="scenario-badge">{mode === "manual" ? "Manual stops" : `${settings.delivery_radius_km} km radius`}</span>
      </div>
      <div className="active-case-controls">
        <Input label="Drivers" value={settings.drivers} type="number" onChange={(value) => {
          setSettings({ ...settings, drivers: Number(value) });
          onScenarioChange?.();
        }} />
        <Input label="Service min" value={settings.service_time_minutes} type="number" onChange={(value) => {
          setSettings({ ...settings, service_time_minutes: Number(value) });
          onScenarioChange?.();
        }} />
        <Input label="Runs" value={controls?.simulation_runs ?? 1} type="number" onChange={(value) => {
          setControls?.({ ...controls, simulation_runs: Number(value) });
          onScenarioChange?.();
        }} />
      </div>
      <div className="assumption-grid">
        <div>
          <b>Customer location model</b>
          <p>{mode === "manual" ? "Manual stops are user-approved delivery locations. Radius is not used to choose or reject them in this workflow." : settings.snap_to_road && settings.routing_mode === "road" ? "Generated candidates are accepted only after OSRM snaps them to a nearby drivable road within the configured threshold." : "Generated customers are synthetic latitude/longitude points inside the radius and are not road-snapped in the current mode."}</p>
        </div>
        <div>
          <b>Routing model</b>
          <p>{settings.routing_mode === "road" ? "Route distances, durations, and displayed polylines are requested from OSRM driving routes; fallback warnings appear if OSRM is unavailable." : "Algorithms use Haversine distance and estimated city speed in lab mode."}</p>
        </div>
      </div>
      {!!warnings.length && (
        <div className="warning-list">
          {warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      )}
      <div className="scenario-grid">
        <MapView orders={orders} settings={settings} compact />
        <div className="scenario-list">
          <table>
            <thead><tr><th>Customer</th><th>Window</th><th>Lat</th><th>Lng</th><th>Notes</th></tr></thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.customer_name}</td>
                  <td>{normalizeTime(order.window_start)}-{normalizeTime(order.window_end, addMinutes(order.window_start, 30))}</td>
                  <td>{Number(order.latitude).toFixed(4)}</td>
                  <td>{Number(order.longitude).toFixed(4)}</td>
                  <td>{order.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="count">Showing all {orders.length} customers in the active scenario.</p>
        </div>
      </div>
    </section>
  );
}

function Input({ label, value, onChange, type = "text" }) {
  return <label>{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} step={type === "number" ? "any" : undefined} /></label>;
}
