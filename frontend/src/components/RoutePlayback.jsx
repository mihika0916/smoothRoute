import { Car, CheckCircle2, ChevronsLeft, ChevronsRight, Clock, Eye, EyeOff, Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";

const colors = ["#246bfe", "#16a34a", "#f97316", "#9333ea", "#e11d48", "#0891b2"];
const speeds = [0.5, 1, 2, 5, 10, 20];
const depotIcon = new L.DivIcon({ className: "playback-depot-pin", html: "D", iconSize: [30, 30] });

export default function RoutePlayback({ results = [], selectedAlgorithm, onSelectAlgorithm, settings, orders = [] }) {
  const result = results.find((item) => item.algorithm === selectedAlgorithm) || results[0];
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(5);
  const [showLabels, setShowLabels] = useState(true);
  const [autoFollow, setAutoFollow] = useState(false);
  const [simTime, setSimTime] = useState(() => toSeconds(settings.driver_start_time));
  const frameRef = useRef(null);
  const lastFrameRef = useRef(null);
  const model = useMemo(() => buildModel(result, settings, orders), [result, settings, orders]);

  useEffect(() => {
    setPlaying(false);
    setSimTime(model.start);
  }, [result?.algorithm, model.start]);

  useEffect(() => {
    if (!playing) {
      lastFrameRef.current = null;
      return undefined;
    }
    function tick(timestamp) {
      if (lastFrameRef.current == null) lastFrameRef.current = timestamp;
      const elapsed = (timestamp - lastFrameRef.current) / 1000;
      lastFrameRef.current = timestamp;
      setSimTime((current) => Math.min(model.end, current + elapsed * 60 * speed));
      frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [playing, speed, model.end]);

  if (!result) return null;

  const snapshot = buildSnapshot(model, simTime);
  const events = buildEventFeed(model, simTime);

  return (
    <section className="playback-console">
      <div className="playback-console-head">
        <div>
          <h2>Route Playback <span>{speed}x speed</span></h2>
          <p>Watch all drivers complete their routes in accurate, time-based animation.</p>
        </div>
        <div className="playback-head-actions">
          <select value={result.algorithm} onChange={(event) => onSelectAlgorithm(event.target.value)} aria-label="Playback algorithm">
            {results.map((item) => <option key={item.algorithm} value={item.algorithm}>{item.algorithm}</option>)}
          </select>
          <button onClick={() => setSimTime(model.start)}><RotateCcw size={16} /> Reset</button>
          <button className="primary" onClick={() => setPlaying(!playing)}>{playing ? <Pause size={16} /> : <Play size={16} />} {playing ? "Pause" : "Play"}</button>
        </div>
      </div>

      <LiveMetrics model={model} snapshot={snapshot} simTime={simTime} />

      <div className="ops-layout">
        <PlaybackMap model={model} snapshot={snapshot} settings={settings} showLabels={showLabels} autoFollow={autoFollow} />
        <DriverOpsPanel model={model} snapshot={snapshot} />
      </div>

      <TimeScrubber model={model} simTime={simTime} setSimTime={setSimTime} snapshot={snapshot} />

      <div className="playback-controls">
        <button onClick={() => setSimTime(model.start)} title="Start"><ChevronsLeft size={18} /></button>
        <button onClick={() => setSimTime(previousEvent(model, simTime))} title="Previous event"><SkipBack size={18} /></button>
        <button className="round-play" onClick={() => setPlaying(!playing)}>{playing ? <Pause size={22} /> : <Play size={22} />}</button>
        <button onClick={() => setSimTime(nextEvent(model, simTime))} title="Next event"><SkipForward size={18} /></button>
        <button onClick={() => setSimTime(model.end)} title="End"><ChevronsRight size={18} /></button>
        <div className="speed-group"><span>Speed</span>{speeds.map((value) => <button key={value} className={speed === value ? "active" : ""} onClick={() => setSpeed(value)}>{value}x</button>)}</div>
        <button onClick={() => setShowLabels(!showLabels)}>{showLabels ? <Eye size={16} /> : <EyeOff size={16} />} Labels</button>
        <button onClick={() => setAutoFollow(!autoFollow)} className={autoFollow ? "active" : ""}>Auto-follow</button>
      </div>

      <div className="event-strip">
        <div>
          <b>Next stop</b>
          <p>{snapshot.nextEvent ? `${snapshot.nextEvent.order.customer_name} (${snapshot.nextEvent.driver}) at ${formatClock(snapshot.nextEvent.arrival)}` : "Route complete"}</p>
        </div>
        <div>
          <b>Last completed</b>
          <p>{snapshot.lastCompleted ? `${customerName(snapshot.lastCompleted)} (${snapshot.lastCompleted.driver}) completed ${formatClock(snapshot.lastCompleted.completeTime)}` : "No completed deliveries yet"}</p>
        </div>
        <div className="feed">
          <b>Event feed</b>
          {events.map((event) => <p key={`${event.time}-${event.driver}-${event.customer}-${event.type}`}><span>{formatClock(event.time)}</span> {event.driver} {event.type} {event.customer}</p>)}
        </div>
      </div>
    </section>
  );
}

function LiveMetrics({ model, snapshot, simTime }) {
  const onTime = snapshot.completed - snapshot.late || 0;
  const onTimePercent = snapshot.completed ? Math.round((onTime / snapshot.completed) * 1000) / 10 : 100;
  return (
    <div className="live-metrics">
      <Metric title="Current time" value={formatClock(simTime, true)} detail="Simulation clock" />
      <Metric title="Completed" value={`${snapshot.completed} / ${model.totalStops}`} detail={`${Math.round((snapshot.completed / Math.max(1, model.totalStops)) * 100)}%`} />
      <Metric title="On time" value={String(onTime)} detail={`${onTimePercent}%`} tone="good" />
      <Metric title="Late" value={String(snapshot.late)} detail={snapshot.completed ? `${Math.round((snapshot.late / snapshot.completed) * 1000) / 10}%` : "0%"} tone="bad" />
      <Metric title="Remaining" value={String(model.totalStops - snapshot.completed)} detail={`Est. finish ${formatClock(model.projectedFinish)}`} />
    </div>
  );
}

function Metric({ title, value, detail, tone = "" }) {
  return <div className={`live-metric ${tone}`}><span>{title}</span><b>{value}</b><small>{detail}</small></div>;
}

function PlaybackMap({ model, snapshot, settings, showLabels, autoFollow }) {
  const depot = settings.depot;
  return (
    <MapContainer className="ops-map" center={[depot.latitude, depot.longitude]} zoom={13} scrollWheelZoom>
      <MapAutoFollow positions={snapshot.driverStates.map((driver) => driver.position)} enabled={autoFollow} depot={depot} />
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={[depot.latitude, depot.longitude]} icon={depotIcon}><Popup>{depot.name}</Popup></Marker>
      {model.drivers.map((driver, index) => {
        const state = snapshot.driverStates[index];
        return (
          <DriverLayer key={driver.id} driver={driver} state={state} color={driver.color} showLabels={showLabels} />
        );
      })}
    </MapContainer>
  );
}

function DriverLayer({ driver, state, color, showLabels }) {
  return (
    <>
      <Polyline positions={driver.path.map(toLatLng)} pathOptions={{ color: "#d7deea", weight: 4, opacity: 0.9 }} />
      {state.completedPath.length > 1 && <Polyline positions={state.completedPath.map(toLatLng)} pathOptions={{ color, weight: 5, opacity: 0.9 }} />}
      {state.activePath.length > 1 && <Polyline positions={state.activePath.map(toLatLng)} pathOptions={{ color, weight: 7, opacity: 0.95 }} />}
      {driver.stops.map((stop) => {
        const current = state.target?.id === stop.id && state.phase === "enroute";
        const completed = stop.completeTime <= state.time;
        return (
          <CircleMarker
            key={stop.id}
            center={[stop.order.latitude, stop.order.longitude]}
            radius={current ? 10 : 7}
            className={current ? "pulse-marker" : ""}
            pathOptions={{ color: completed ? "#16a34a" : current ? color : "#94a3b8", fillColor: completed ? "#dcfce7" : "#ffffff", fillOpacity: 0.95, weight: 3 }}
          >
            <Popup>{completed ? "Completed" : current ? "Current target" : "Upcoming"}<br />{stop.order.customer_name}<br />ETA {formatClock(stop.arrival)}</Popup>
          </CircleMarker>
        );
      })}
      <Marker position={toLatLng(state.position)} icon={vehicleIcon(color, driver.id)}>
        <Popup>{driver.name}<br />{state.label}</Popup>
      </Marker>
      {showLabels && <CircleMarker center={toLatLng(state.position)} radius={1} opacity={0}><Popup>{driver.name}</Popup></CircleMarker>}
    </>
  );
}

function DriverOpsPanel({ model, snapshot }) {
  return (
    <aside className="driver-ops">
      <div className="driver-ops-head"><h3>Drivers</h3><span>{model.algorithm}</span></div>
      <div className="driver-ops-list">
        {snapshot.driverStates.map((driver) => (
          <article key={driver.id} className="driver-status-card">
            <div>
              <span className="driver-dot" style={{ background: driver.color }} />
              <b>{driver.name}</b>
              <Car size={15} />
            </div>
            <strong className={driver.phase}>{driver.label}</strong>
            <p>{driver.detail}</p>
            <small>Remaining {driver.remaining}</small>
          </article>
        ))}
      </div>
    </aside>
  );
}

function TimeScrubber({ model, simTime, setSimTime, snapshot }) {
  const percent = percentBetween(simTime, model.start, model.end);
  return (
    <div className="logistics-timeline">
      <div className="timeline-title"><b>Timeline</b><span>{formatClock(simTime, true)}</span></div>
      <div className="timeline-scale">{[6, 7, 8, 9, 10, 11].map((hour) => <span key={hour}>{String(hour).padStart(2, "0")}:00</span>)}</div>
      <div className="timeline-lanes">
        <div className="playhead" style={{ "--progress": percent / 100 }} />
        {model.drivers.map((driver, index) => (
          <div className="time-lane" key={driver.id}>
            <b>{driver.name}</b>
            <div className="lane-line">
              {driver.stops.map((stop) => (
                <button
                  key={stop.id}
                  className={stop.completeTime <= simTime ? "done" : ""}
                  style={{ left: `${percentBetween(stop.arrival, model.start, model.end)}%`, borderColor: driver.color, background: stop.completeTime <= simTime ? driver.color : "white" }}
                  onClick={() => setSimTime(stop.arrival)}
                  title={`${driver.name} ${stop.order.customer_name} ${formatClock(stop.arrival)}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <input className="timeline-scrubber" type="range" min={model.start} max={model.end} value={simTime} onChange={(event) => setSimTime(Number(event.target.value))} />
    </div>
  );
}

function buildModel(result, settings, orders) {
  const start = safeSeconds(settings.driver_start_time, 6 * 3600);
  const routeEnd = safeSeconds(settings.route_end_time, 11 * 3600);
  const drivers = (result?.routes || []).map((route, index) => buildDriver(route, index, start, settings.service_time_minutes));
  const totalStops = drivers.reduce((sum, driver) => sum + driver.stops.length, 0);
  const finishes = drivers.map((driver) => driver.finish).filter(Number.isFinite);
  const projectedFinish = Math.max(routeEnd, ...finishes);
  return { algorithm: result?.algorithm || "", start, end: Math.max(routeEnd, projectedFinish), routeEnd, drivers, totalStops, orders };
}

function buildDriver(route, index, start, serviceMinutes) {
  const color = colors[index % colors.length];
  const path = normalizePath(route.path);
  let previousDeparture = start;
  let previousIndex = 0;
  const stops = route.stops.map((stop, stopIndex) => {
    const arrival = Math.max(previousDeparture, toSeconds(stop.arrival_time));
    const completeTime = arrival + serviceMinutes * 60;
    const pathIndex = nearestPathIndex(path, stop.order.latitude, stop.order.longitude, previousIndex);
    const built = {
      id: stop.order.id,
      order: stop.order,
      status: stop.status,
      lateness: stop.lateness_minutes,
      arrival,
      completeTime,
      pathIndex,
      segmentStartIndex: previousIndex,
      segmentStartTime: previousDeparture,
      sequence: stopIndex + 1,
    };
    previousDeparture = completeTime;
    previousIndex = pathIndex;
    return built;
  });
  return { id: route.driver_id, name: `Driver ${route.driver_id}`, color, path, stops, finish: previousDeparture };
}

function buildSnapshot(model, time) {
  const allStops = model.drivers.flatMap((driver) => driver.stops.map((stop) => ({ ...stop, driver: driver.name })));
  const completedStops = allStops.filter((stop) => stop.completeTime <= time);
  const driverStates = model.drivers.map((driver) => driverState(driver, time));
  const nextEvent = allStops.filter((stop) => stop.arrival > time).sort((a, b) => a.arrival - b.arrival)[0];
  return {
    completed: completedStops.length,
    late: completedStops.filter((stop) => stop.lateness > 0).length,
    lastCompleted: completedStops.sort((a, b) => b.completeTime - a.completeTime)[0],
    nextEvent,
    driverStates,
  };
}

function driverState(driver, time) {
  const current = driver.stops.find((stop) => time < stop.completeTime);
  const completed = driver.stops.filter((stop) => stop.completeTime <= time);
  if (!current) {
    const position = driver.stops.length ? pointAtIndex(driver.path, driver.stops[driver.stops.length - 1].pathIndex) : driver.path[0];
    return {
      ...driver,
      time,
      phase: "complete",
      label: "Complete",
      detail: "All stops completed",
      remaining: 0,
      target: null,
      position,
      completedPath: driver.path.slice(0, completedPathIndex(driver, time) + 1),
      activePath: [],
    };
  }
  const atStop = time >= current.arrival;
  const ratio = atStop ? 1 : percentBetween(time, current.segmentStartTime, current.arrival) / 100;
  const segment = safeSegment(driver.path, current.segmentStartIndex, current.pathIndex);
  const position = atStop ? pointAtIndex(driver.path, current.pathIndex) : interpolatePath(segment, ratio);
  const activePath = atStop ? [] : segmentPrefix(segment, ratio);
  const completedPath = driver.path.slice(0, Math.max(1, current.segmentStartIndex + 1));
  return {
    ...driver,
    time,
    phase: atStop ? "arrived" : "enroute",
    label: atStop ? `Arrived stop ${current.sequence}` : `En route to stop ${current.sequence}`,
    detail: atStop ? `Current Stop: ${current.order.customer_name}. Departure ${formatClock(current.completeTime)}` : `Next Stop: ${current.order.customer_name}. ETA ${formatClock(current.arrival)}`,
    remaining: driver.stops.filter((stop) => stop.completeTime > time).length,
    target: current,
    position,
    completedPath,
    activePath,
  };
}

function buildEventFeed(model, time) {
  return model.drivers
    .flatMap((driver) => driver.stops.flatMap((stop) => [
      { time: stop.arrival, driver: driver.name, type: "arrived at", customer: stop.order.customer_name },
      { time: stop.completeTime, driver: driver.name, type: "completed", customer: stop.order.customer_name },
    ]))
    .filter((event) => event.time <= time + 10 * 60)
    .sort((a, b) => Math.abs(a.time - time) - Math.abs(b.time - time))
    .slice(0, 5)
    .sort((a, b) => b.time - a.time);
}

function customerName(stop) {
  return stop?.order?.customer_name || stop?.customer_name || "Unnamed customer";
}

function previousEvent(model, time) {
  const events = model.drivers.flatMap((driver) => driver.stops.flatMap((stop) => [stop.arrival, stop.completeTime])).filter((event) => event < time - 1);
  return events.length ? Math.max(...events) : model.start;
}

function nextEvent(model, time) {
  const events = model.drivers.flatMap((driver) => driver.stops.flatMap((stop) => [stop.arrival, stop.completeTime])).filter((event) => event > time + 1);
  return events.length ? Math.min(...events) : model.end;
}

function MapAutoFollow({ positions, enabled, depot }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled || !positions.length) return;
    const bounds = L.latLngBounds(positions.map(toLatLng));
    bounds.extend([depot.latitude, depot.longitude]);
    map.fitBounds(bounds.pad(0.25), { animate: true, maxZoom: 14 });
  }, [enabled, positions.map((point) => `${point.lat},${point.lng}`).join("|"), depot.latitude, depot.longitude, map]);
  return null;
}

function normalizePath(path) {
  return (path || []).map((point) => ({ lat: Number(point.lat), lng: Number(point.lng) })).filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
}

function nearestPathIndex(path, lat, lng, startIndex = 0) {
  let best = Math.min(startIndex, path.length - 1);
  let bestDistance = Number.POSITIVE_INFINITY;
  path.forEach((point, index) => {
    if (index < startIndex) return;
    const distance = Math.abs(point.lat - lat) + Math.abs(point.lng - lng);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

function safeSegment(path, start, end) {
  if (!path.length) return [];
  const from = Math.max(0, Math.min(start, path.length - 1));
  const to = Math.max(from + 1, Math.min(end, path.length - 1));
  return path.slice(from, to + 1);
}

function interpolatePath(points, ratio) {
  if (!points.length) return { lat: 0, lng: 0 };
  if (points.length === 1) return points[0];
  const lengths = segmentLengths(points);
  const total = lengths.reduce((sum, value) => sum + value, 0) || 1;
  let target = total * Math.max(0, Math.min(1, ratio));
  for (let index = 1; index < points.length; index += 1) {
    const length = lengths[index - 1];
    if (target <= length) {
      const local = length ? target / length : 0;
      return {
        lat: points[index - 1].lat + (points[index].lat - points[index - 1].lat) * local,
        lng: points[index - 1].lng + (points[index].lng - points[index - 1].lng) * local,
      };
    }
    target -= length;
  }
  return points[points.length - 1];
}

function segmentPrefix(points, ratio) {
  const position = interpolatePath(points, ratio);
  if (ratio <= 0) return [points[0], position].filter(Boolean);
  const lengths = segmentLengths(points);
  const total = lengths.reduce((sum, value) => sum + value, 0) || 1;
  let target = total * Math.max(0, Math.min(1, ratio));
  const prefix = [points[0]];
  for (let index = 1; index < points.length; index += 1) {
    if (target >= lengths[index - 1]) {
      prefix.push(points[index]);
      target -= lengths[index - 1];
    } else {
      prefix.push(position);
      break;
    }
  }
  return prefix;
}

function segmentLengths(points) {
  return points.slice(1).map((point, index) => Math.hypot(point.lat - points[index].lat, point.lng - points[index].lng));
}

function completedPathIndex(driver, time) {
  const completed = driver.stops.filter((stop) => stop.completeTime <= time);
  return completed.length ? completed[completed.length - 1].pathIndex : 0;
}

function pointAtIndex(path, index) {
  return path[Math.max(0, Math.min(index, path.length - 1))] || { lat: 0, lng: 0 };
}

function vehicleIcon(color, id) {
  return new L.DivIcon({ className: "vehicle-marker", html: `<span style="background:${color}"><svg viewBox="0 0 24 24"><path d="M5 11l1.4-4.2A3 3 0 0 1 9.2 5h5.6a3 3 0 0 1 2.8 1.8L19 11v6h-2a2 2 0 0 1-4 0h-2a2 2 0 0 1-4 0H5v-6zm3.2-1h7.6l-.8-2.4a1 1 0 0 0-.9-.6H9.9a1 1 0 0 0-.9.6L8.2 10z" fill="white"/></svg><b>${id}</b></span>`, iconSize: [34, 34], iconAnchor: [17, 17] });
}

function toLatLng(point) {
  return [point.lat, point.lng];
}

function toSeconds(value) {
  const [hours, minutes, seconds = 0] = String(value).split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

function safeSeconds(value, fallback) {
  const parsed = toSeconds(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatClock(seconds, withSeconds = false) {
  const safe = Math.max(0, Math.round(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return withSeconds ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function percentBetween(value, start, end) {
  return Math.max(0, Math.min(100, ((value - start) / Math.max(1, end - start)) * 100));
}
