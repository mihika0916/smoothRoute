import DepotLocationPicker from "./DepotLocationPicker.jsx";

export default function SimulationControls({ settings, setSettings, controls, setControls, onGenerate, onRun, busy, scenarioReady, scenarioHasRun }) {
  return (
    <section className="panel simulation-panel">
      <div className="controls-grid">
        <Input label="Orders" value={controls.number_of_orders} type="number" onChange={(v) => setControls({ ...controls, number_of_orders: Number(v) })} />
        <Input label="Drivers" value={settings.drivers} type="number" onChange={(v) => setSettings({ ...settings, drivers: Number(v) })} />
        <Input label="Radius km" value={settings.delivery_radius_km} type="number" onChange={(v) => setSettings({ ...settings, delivery_radius_km: Number(v) })} />
        <Input label="Service min" value={settings.service_time_minutes} type="number" onChange={(v) => setSettings({ ...settings, service_time_minutes: Number(v) })} />
        <Input label="Runs" value={controls.simulation_runs} type="number" onChange={(v) => setControls({ ...controls, simulation_runs: Number(v) })} />
        <Input label="Earliest time" value={settings.driver_start_time} onChange={(v) => setSettings({ ...settings, driver_start_time: v })} />
        <Input label="Latest time" value={settings.route_end_time} onChange={(v) => setSettings({ ...settings, route_end_time: v })} />
      </div>
      <DepotLocationPicker depot={settings.depot} busy={busy} onSave={(depot) => setSettings({ ...settings, depot })} />
      <div className="road-grid">
        <label>Routing mode
          <select value={settings.routing_mode} onChange={(event) => setSettings({ ...settings, routing_mode: event.target.value })}>
            <option value="road">Road network</option>
            <option value="haversine">Haversine lab</option>
          </select>
        </label>
        <label>Snap customers
          <select value={settings.snap_to_road ? "yes" : "no"} onChange={(event) => setSettings({ ...settings, snap_to_road: event.target.value === "yes" })}>
            <option value="yes">Yes, nearest drivable road</option>
            <option value="no">No, synthetic point only</option>
          </select>
        </label>
        <Input label="Max snap m" value={settings.max_snap_distance_m} type="number" onChange={(v) => setSettings({ ...settings, max_snap_distance_m: Number(v) })} />
      </div>
      <p className="routing-note">Road-network mode uses the embedded OSRM driving profile and service URL. Advanced provider details stay hidden so the lab stays focused on scenarios and algorithm behavior.</p>
      <div className="control-actions">
        <button onClick={onGenerate} disabled={busy}>Generate Scenario</button>
        <button className={scenarioReady && !scenarioHasRun ? "primary needs-run" : "primary"} onClick={onRun} disabled={busy || !scenarioReady}>
          {scenarioHasRun ? "Re-run Algorithms" : "Run All Algorithms"}
        </button>
      </div>
    </section>
  );
}

function Input({ label, value, onChange, type = "text" }) {
  return <label>{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} step={type === "number" ? "any" : undefined} /></label>;
}
