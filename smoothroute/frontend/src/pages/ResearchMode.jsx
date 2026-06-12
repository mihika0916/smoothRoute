import { useEffect, useState } from "react";
import AlgorithmComparison from "../components/AlgorithmComparison.jsx";
import CustomerPointEditor from "../components/CustomerPointEditor.jsx";
import DepotLocationPicker from "../components/DepotLocationPicker.jsx";
import MetricsDashboard from "../components/MetricsDashboard.jsx";
import RoutePlayback from "../components/RoutePlayback.jsx";
import ScenarioPreview from "../components/ScenarioPreview.jsx";
import { api, defaultSettings } from "../utils/api.js";
import { normalizeOrderWindow, normalizeTime } from "../utils/time.js";

export default function ResearchMode() {
  const [settings, setSettings] = useState(defaultSettings);
  const [controls, setControls] = useState({ number_of_orders: 40, simulation_runs: 1 });
  const [orders, setOrders] = useState([]);
  const [results, setResults] = useState([]);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState("");
  const [scenarioWarnings, setScenarioWarnings] = useState([]);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [progress, setProgress] = useState(0);
  const [scenarioId, setScenarioId] = useState(0);
  const [lastRunScenarioId, setLastRunScenarioId] = useState(null);
  const [stopMode, setStopMode] = useState("generate");

  useEffect(() => {
    if (!busy) return undefined;
    setProgress(8);
    const timer = setInterval(() => setProgress((value) => Math.min(92, value + Math.max(1, (92 - value) * 0.08))), 450);
    return () => clearInterval(timer);
  }, [busy]);

  async function generate() {
    setBusy(true);
    setBusyLabel("Generating road-snapped test case");
    try {
      const scenario = await api.generateScenario({ number_of_orders: controls.number_of_orders, settings, seed: Date.now() % 1000000 });
      setOrders(scenario.orders);
      setScenarioWarnings(scenario.warnings || []);
      setResults([]);
      setSelectedAlgorithm("");
      setScenarioId((id) => id + 1);
      setLastRunScenarioId(null);
      setProgress(100);
    } finally {
      setTimeout(() => { setBusy(false); setBusyLabel(""); setProgress(0); }, 350);
    }
  }

  function markScenarioChanged() {
    setResults([]);
    setSelectedAlgorithm("");
    setScenarioWarnings([]);
    setScenarioId((id) => id + 1);
    setLastRunScenarioId(null);
  }

  async function run() {
    setBusy(true);
    setBusyLabel("Running algorithms on road-time matrix");
    try {
      let activeOrders = orders.map(normalizeOrderWindow);
      let activeScenarioId = scenarioId;
      let activeSettings = settings;
      if (!activeOrders.length) {
        const scenario = await api.generateScenario({ number_of_orders: controls.number_of_orders, settings, seed: 42 });
        activeOrders = scenario.orders;
        setScenarioWarnings(scenario.warnings || []);
        activeScenarioId = scenarioId + 1;
        setScenarioId(activeScenarioId);
      }
      if (stopMode === "manual" && activeOrders.length) {
        activeSettings = settingsWithManualRadius(settings, activeOrders);
      }
      setOrders(activeOrders);
      const response = await api.runSimulation({ orders: activeOrders, settings: activeSettings, algorithms: ["greedy", "clarke_wright", "ortools"], simulation_runs: controls.simulation_runs });
      setResults(response.results);
      setSelectedAlgorithm(bestAlgorithm(response.results)?.algorithm || "");
      setLastRunScenarioId(activeScenarioId);
      setProgress(100);
    } finally {
      setTimeout(() => { setBusy(false); setBusyLabel(""); setProgress(0); }, 350);
    }
  }

  useEffect(() => {
    if (!results.length || selectedAlgorithm) return;
    setSelectedAlgorithm(bestAlgorithm(results)?.algorithm || "");
  }, [results, selectedAlgorithm]);

  const selectedResult = results.find((result) => result.algorithm === selectedAlgorithm) || results[0];
  const scenarioReady = orders.length > 0;
  const scenarioHasRun = scenarioReady && results.length > 0 && lastRunScenarioId === scenarioId;
  const stepState = {
    depot: Number.isFinite(Number(settings.depot?.latitude)) && Number.isFinite(Number(settings.depot?.longitude)),
    stops: scenarioReady,
    run: scenarioHasRun,
    compare: results.length > 0,
    playback: results.length > 0,
  };
  return (
    <div className="guided-workflow">
      <WorkflowNav state={stepState} />
      <div className="research">
        <section className="panel hero-panel research-hero">
          <p className="eyebrow">Research Mode</p>
          <h2>Compare VRPTW algorithms on the same breakfast delivery scenario.</h2>
          <p>Follow the steps: choose a depot, create stops, run the comparison, then inspect results and playback.</p>
        </section>

        <StepSection id="step-depot" kicker="Step 1 of 5" title="📍 Step 1: Choose Depot Location" description="Select where all drivers start their routes.">
          <DepotLocationPicker depot={settings.depot} busy={busy} onSave={(depot) => setSettings({ ...settings, depot })} />
        </StepSection>

        <StepSection id="step-stops" kicker="Step 2 of 5" title="🏠 Step 2: Create Delivery Stops" description="Choose where customers are located.">
          <div className="stop-mode-tabs">
            <button className={stopMode === "generate" ? "active" : ""} onClick={() => setStopMode("generate")}>Generate Scenario</button>
            <button className={stopMode === "manual" ? "active" : ""} onClick={() => setStopMode("manual")}>Enter Manually</button>
          </div>
          {stopMode === "generate" ? (
            <GenerateScenarioPanel controls={controls} setControls={setControls} settings={settings} setSettings={setSettings} onGenerate={generate} busy={busy} />
          ) : (
            <CustomerPointEditor orders={orders} setOrders={setOrders} settings={settings} busy={busy} onScenarioChange={markScenarioChanged} />
          )}
          <ScenarioPreview orders={orders} settings={settings} setSettings={setSettings} controls={controls} setControls={setControls} warnings={scenarioWarnings} mode={stopMode} onScenarioChange={markScenarioChanged} />
        </StepSection>

        <StepSection id="step-run" kicker="Step 3 of 5" title="⚙️ Step 3: Configure Simulation" description="Run the same delivery scenario through multiple routing algorithms.">
          <ConfigureRunPanel settings={settings} setSettings={setSettings} onRun={run} busy={busy} scenarioReady={scenarioReady} scenarioHasRun={scenarioHasRun} />
          {busy && <ProgressCard label={busyLabel} progress={progress} />}
        </StepSection>

        <StepSection id="step-compare" kicker="Step 4 of 5" title="📊 Step 4: Compare Results" description="See how each algorithm performs on the same delivery scenario.">
          <AlgorithmComparison results={results} settings={settings} />
          {!!results.length && <MetricsDashboard results={results} />}
          {!!results.length && (
            <section className="panel conclusion-card">
              <div className="section-title"><h2>What this shows</h2><p>Greedy is fast and understandable, Clarke-Wright usually reduces travel by merging high-savings stops, and OR-Tools is the production benchmark when installed. The late-delivery and balance metrics reveal the real tradeoff: shorter routes can still fail the morning promise if windows are tight.</p></div>
            </section>
          )}
        </StepSection>

        <StepSection id="step-playback" kicker="Step 5 of 5" title="🎬 Step 5: Watch Route Playback" description="Watch deliveries happen in simulated time.">
          {!!results.length ? (
            <RoutePlayback results={results} selectedAlgorithm={selectedResult?.algorithm || selectedAlgorithm} onSelectAlgorithm={setSelectedAlgorithm} settings={settings} orders={orders} />
          ) : (
            <div className="empty-step">Run the algorithm comparison to unlock time-based route playback.</div>
          )}
        </StepSection>
      </div>
    </div>
  );
}

function WorkflowNav({ state }) {
  const steps = [
    ["step-depot", "Depot", "Choose Depot", state.depot],
    ["step-stops", "Stops", "Create Stops", state.stops],
    ["step-run", "Run", "Configure & Run", state.run],
    ["step-compare", "Compare", "Compare Results", state.compare],
    ["step-playback", "Playback", "Route Playback", state.playback],
  ];
  return (
    <aside className="workflow-nav" aria-label="Workflow progress">
      {steps.map(([id, short, label, done], index) => (
        <button key={id} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
          <span className={done ? "done" : ""}>{done ? "✓" : index + 1}</span>
          <b>{label}</b>
          <small>{short}</small>
        </button>
      ))}
    </aside>
  );
}

function StepSection({ id, kicker, title, description, children }) {
  return (
    <section id={id} className="workflow-step">
      <div className="step-heading">
        <span>{kicker}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {children}
    </section>
  );
}

function GenerateScenarioPanel({ controls, setControls, settings, setSettings, onGenerate, busy }) {
  return (
    <div className="scenario-generator-card">
      <div>
        <h3>Generate a realistic test scenario</h3>
        <p>Generate a realistic breakfast delivery scenario for testing algorithms.</p>
      </div>
      <div className="controls-grid">
        <Input label="Orders" value={controls.number_of_orders} type="number" onChange={(v) => setControls({ ...controls, number_of_orders: Number(v) })} />
        <Input label="Drivers" value={settings.drivers} type="number" onChange={(v) => setSettings({ ...settings, drivers: Number(v) })} />
        <Input label="Radius km" value={settings.delivery_radius_km} type="number" onChange={(v) => setSettings({ ...settings, delivery_radius_km: Number(v) })} />
        <Input label="Service min" value={settings.service_time_minutes} type="number" onChange={(v) => setSettings({ ...settings, service_time_minutes: Number(v) })} />
        <Input label="Runs" value={controls.simulation_runs} type="number" onChange={(v) => setControls({ ...controls, simulation_runs: Number(v) })} />
        <Input label="Earliest time" value={settings.driver_start_time} type="time" onChange={(v) => setSettings({ ...settings, driver_start_time: v })} onBlur={(v) => setSettings({ ...settings, driver_start_time: normalizeTime(v, "06:00") })} />
        <Input label="Latest time" value={settings.route_end_time} type="time" onChange={(v) => setSettings({ ...settings, route_end_time: v })} onBlur={(v) => setSettings({ ...settings, route_end_time: normalizeTime(v, "11:00") })} />
      </div>
      <div className="control-actions">
        <button onClick={onGenerate} disabled={busy}>Generate Scenario</button>
      </div>
    </div>
  );
}

function ConfigureRunPanel({ settings, setSettings, onRun, busy, scenarioReady, scenarioHasRun }) {
  return (
    <div className="run-config-card">
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
      <div className="run-cta">
        <button className={scenarioReady && !scenarioHasRun ? "primary needs-run" : "primary"} onClick={onRun} disabled={busy || !scenarioReady}>
          🚀 {scenarioHasRun ? "Re-run Algorithm Comparison" : "Run Algorithm Comparison"}
        </button>
        <p>This will compare Greedy, Clarke-Wright, and OR-Tools on the exact same scenario.</p>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, onBlur, type = "text" }) {
  return <label>{label}<input type={type} value={type === "time" ? normalizeTime(value) : value} onChange={(event) => onChange(event.target.value)} onBlur={(event) => onBlur?.(event.target.value)} step={type === "number" ? "any" : type === "time" ? "60" : undefined} /></label>;
}

function settingsWithManualRadius(settings, orders) {
  const maxDistance = orders.reduce((max, order) => {
    const distance = haversineKm(settings.depot.latitude, settings.depot.longitude, order.latitude, order.longitude);
    return Math.max(max, distance);
  }, 0);
  return {
    ...settings,
    delivery_radius_km: Math.max(settings.delivery_radius_km, Math.ceil((maxDistance + 0.5) * 10) / 10),
  };
}

function haversineKm(aLat, aLng, bLat, bLng) {
  const radius = 6371;
  const toRad = (value) => (Number(value) * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

function ProgressCard({ label, progress }) {
  return (
    <section className="progress-card">
      <div><b>{label}</b><span>{Math.round(progress)}%</span></div>
      <div className="progress-track"><i style={{ width: `${progress}%` }} /></div>
      <p>Road mode may call OSRM for snapping, matrix preparation, and final route geometry.</p>
    </section>
  );
}

function bestAlgorithm(results) {
  return [...results].sort((left, right) => (
    left.metrics.late_deliveries - right.metrics.late_deliveries
    || left.metrics.total_distance_km - right.metrics.total_distance_km
    || left.metrics.driver_utilization_balance - right.metrics.driver_utilization_balance
  ))[0];
}
