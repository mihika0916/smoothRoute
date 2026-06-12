import { ArrowDown, ArrowUp, CheckCircle2, LocateFixed, MapPin, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { api } from "../utils/api.js";
import { addMinutes, normalizeOrderWindow, normalizeTime } from "../utils/time.js";

const customerIcon = new L.DivIcon({ className: "customer-map-pin", html: "<span></span>", iconSize: [30, 38], iconAnchor: [15, 35] });

export default function CustomerPointEditor({ orders, setOrders, settings, busy, onScenarioChange }) {
  const [draft, setDraft] = useState(emptyDraft(settings));
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchState, setSearchState] = useState("idle");
  const [status, setStatus] = useState("");
  const searchRef = useRef(null);
  const hasLocation = hasCoordinate(draft.latitude, draft.longitude);
  const center = hasLocation ? [Number(draft.latitude), Number(draft.longitude)] : [settings.depot.latitude, settings.depot.longitude];
  const mapZoom = hasLocation ? 15 : 14;

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setResults([]);
      setSearchState("idle");
      return undefined;
    }
    setSearchState("searching");
    const timer = setTimeout(async () => {
      try {
        const response = await api.geocodeSearch({ address: trimmed });
        setResults(response.results || []);
        setSearchState(response.results?.length ? "ready" : "empty");
      } catch {
        setResults([]);
        setSearchState("error");
      }
    }, 550);
    return () => clearTimeout(timer);
  }, [query]);

  function applyResult(result) {
    setDraft((current) => ({
      ...current,
      customer_name: result.name || `Manual Customer ${orders.length + 1}`,
      address: result.address,
      latitude: result.latitude,
      longitude: result.longitude,
    }));
    setQuery("");
    setResults([]);
    setSearchState("idle");
    setStatus("Location selected. It will snap to the road network when added.");
  }

  async function updateFromMap(latitude, longitude) {
    setDraft((current) => ({ ...current, latitude, longitude }));
    setStatus("Updating address from map...");
    try {
      const result = await api.reverseGeocode({ latitude, longitude });
      setDraft((current) => ({
        ...current,
        customer_name: current.customer_name || (result.display_name ? result.display_name.split(",")[0] : ""),
        address: result.display_name || current.address,
        latitude,
        longitude,
      }));
      setStatus(result.warning || "Location selected. It will snap to the road network when added.");
    } catch {
      setStatus("Location selected. Reverse geocoding is unavailable.");
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setStatus("Browser geolocation is unavailable.");
      return;
    }
    setStatus("Finding current location...");
    navigator.geolocation.getCurrentPosition(
      (position) => updateFromMap(round(position.coords.latitude), round(position.coords.longitude)),
      () => setStatus("Could not access current location.")
    );
  }

  async function addCustomer() {
    if (!hasLocation || busy) return;
    setStatus("Snapping customer to nearest drivable road...");
    let latitude = Number(draft.latitude);
    let longitude = Number(draft.longitude);
    let snapNote = "";
    try {
      const snap = await api.snapLocation({ latitude, longitude, settings });
      if (snap.snapped) {
        latitude = snap.latitude;
        longitude = snap.longitude;
        snapNote = `Manual point snapped to road network (${snap.distance_m}m).`;
      } else {
        snapNote = snap.warning || "Manual point could not be road-snapped.";
      }
    } catch {
      snapNote = "Manual point could not be road-snapped.";
    }
    const index = orders.length + 1;
    const nextOrder = {
      id: `MAN-${Date.now()}`,
      customer_name: draft.customer_name || `Manual Customer ${index}`,
      address: draft.address || "Manual map point",
      latitude,
      longitude,
      window_start: normalizeTime(draft.window_start),
      window_end: normalizeTime(draft.window_end, addMinutes(draft.window_start, 30)),
      notes: [draft.notes, snapNote].filter(Boolean).join(" "),
    };
    setOrders([...orders, normalizeOrderWindow(nextOrder)]);
    onScenarioChange();
    setDraft(emptyDraft(settings, index + 1));
    setQuery("");
    setStatus("Customer added to this scenario.");
    setTimeout(() => searchRef.current?.focus(), 0);
  }

  function clearManualOrders() {
    setOrders([]);
    onScenarioChange();
    setDraft(emptyDraft(settings));
    setStatus("Scenario cleared.");
  }

  function moveOrder(index, direction) {
    const next = [...orders];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrders(next);
    onScenarioChange();
  }

  function deleteOrder(id) {
    setOrders(orders.filter((order) => order.id !== id));
    onScenarioChange();
    setStatus("Stop removed from this scenario.");
  }

  return (
    <section className="customer-editor">
      <div className="section-title inline">
        <div>
          <h2>Manual Customer Points</h2>
          <p>Add exact customer stops. Radius is ignored for manual entry; points are snapped to the road network when added.</p>
        </div>
        <span className="scenario-badge">{orders.length} active stops</span>
      </div>
      <div className="manual-stop-layout">
        <div className="manual-stop-builder">
          <div className="depot-mode-tabs">
            <button type="button" className="active"><Search size={17} /> Search location</button>
            <button type="button" onClick={useCurrentLocation} disabled={busy}><LocateFixed size={17} /> Use current location</button>
          </div>
          <div className="search-box">
            <Search size={18} />
            <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer address, place, or postcode" />
            {query && <button type="button" className="ghost-icon" onClick={() => setQuery("")} aria-label="Clear search"><X size={18} /></button>}
          </div>
          <div className="suggestions-box compact">
            <span className="suggestions-label">Suggestions</span>
            {searchState === "searching" && <p className="suggestion-state">Searching...</p>}
            {searchState === "empty" && <p className="suggestion-state">No results found</p>}
            {searchState === "error" && <p className="suggestion-state">Couldn’t geocode this address</p>}
            {results.map((result) => (
              <button type="button" key={`${result.latitude}-${result.longitude}-${result.address}`} className="suggestion-item" onClick={() => applyResult(result)}>
                <MapPin size={18} />
                <span><b>{result.name}</b><small>{result.address}</small></span>
              </button>
            ))}
          </div>
          <div className="manual-builder-body">
            <MapContainer className="customer-picker-map" center={center} zoom={mapZoom} scrollWheelZoom>
              <MapSync center={center} zoom={mapZoom} />
              <MapClick onPick={(latlng) => updateFromMap(round(latlng.lat), round(latlng.lng))} />
              <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker
                position={[settings.depot.latitude, settings.depot.longitude]}
                icon={new L.DivIcon({ className: "playback-depot-pin", html: "D", iconSize: [30, 30] })}
              />
              {orders.map((order, index) => (
                <CircleMarker key={order.id} center={[order.latitude, order.longitude]} radius={7} pathOptions={{ color: "#246bfe", fillColor: "#eaf2ff", fillOpacity: 0.9, weight: 2 }}>
                  <Popup>{index + 1}. {order.customer_name}<br />{order.window_start}-{order.window_end}</Popup>
                </CircleMarker>
              ))}
              {hasLocation && (
                <Marker
                  position={[Number(draft.latitude), Number(draft.longitude)]}
                  icon={customerIcon}
                  draggable
                  eventHandlers={{ dragend: (event) => {
                    const latlng = event.target.getLatLng();
                    updateFromMap(round(latlng.lat), round(latlng.lng));
                  } }}
                >
                  <Popup>Draft customer<br />Drag to adjust before adding.</Popup>
                </Marker>
              )}
            </MapContainer>
            <div className="selected-stop-card">
              <span>Selected Location</span>
              <h3>{hasLocation ? draft.customer_name || "Selected customer" : "No location selected"}</h3>
              <p>{hasLocation ? draft.address || "Manual map point" : "Search or click the map to choose a stop."}</p>
              <div className="manual-order-grid">
                <label>Customer name<input value={draft.customer_name} onChange={(event) => setDraft({ ...draft, customer_name: event.target.value })} placeholder={`Manual Customer ${orders.length + 1}`} /></label>
                <label>Window start<input type="time" value={normalizeTime(draft.window_start)} onChange={(event) => setDraft({ ...draft, window_start: event.target.value })} onBlur={(event) => setDraft((current) => ({ ...current, window_start: normalizeTime(event.target.value) }))} step="60" /></label>
                <label>Window end<input type="time" value={normalizeTime(draft.window_end, addMinutes(draft.window_start, 30))} onChange={(event) => setDraft({ ...draft, window_end: event.target.value })} onBlur={(event) => setDraft((current) => ({ ...current, window_end: normalizeTime(event.target.value, addMinutes(current.window_start, 30)) }))} step="60" /></label>
                <label>Notes<input value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Optional" /></label>
              </div>
              {status && <p className="editor-status">{status}</p>}
              <div className="manual-actions">
                <button type="button" className="primary" onClick={addCustomer} disabled={!hasLocation || busy}><Plus size={17} /> Add Stop</button>
              </div>
            </div>
          </div>
        </div>
        <aside className="current-stops-panel">
          <div className="current-stops-head">
            <div>
              <h3>Current Stops</h3>
              <p>{orders.length} stops added</p>
            </div>
            <button type="button" onClick={clearManualOrders} disabled={!orders.length || busy}><Trash2 size={15} /> Clear</button>
          </div>
          <div className="current-stops-list">
            {orders.length ? orders.map((order, index) => (
              <article key={order.id} className="stop-row">
                <span>{index + 1}</span>
                <div>
                  <b>{order.customer_name}</b>
                  <p>{order.address || "Manual map point"}</p>
                </div>
                <small>{normalizeTime(order.window_start)}-{normalizeTime(order.window_end, addMinutes(order.window_start, 30))}</small>
                <div className="stop-row-actions">
                  <button type="button" onClick={() => moveOrder(index, -1)} disabled={index === 0 || busy} aria-label="Move stop up"><ArrowUp size={14} /></button>
                  <button type="button" onClick={() => moveOrder(index, 1)} disabled={index === orders.length - 1 || busy} aria-label="Move stop down"><ArrowDown size={14} /></button>
                  <button type="button" onClick={() => deleteOrder(order.id)} disabled={busy} aria-label="Delete stop"><Trash2 size={14} /></button>
                </div>
              </article>
            )) : (
              <div className="empty-stops">
                <CheckCircle2 size={18} />
                <p>Added stops will appear here immediately.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function MapSync({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center[0], center[1], zoom, map]);
  return null;
}

function MapClick({ onPick }) {
  useMapEvents({ click: (event) => onPick(event.latlng) });
  return null;
}

function emptyDraft(settings, index = 1) {
  return {
    customer_name: `Manual Customer ${index}`,
    address: "",
    latitude: null,
    longitude: null,
    window_start: normalizeTime(settings.driver_start_time),
    window_end: addMinutes(settings.driver_start_time, 30),
    notes: "",
  };
}

function round(value) {
  return Math.round(value * 1000000) / 1000000;
}

function hasCoordinate(latitude, longitude) {
  return latitude !== "" && latitude != null && longitude !== "" && longitude != null
    && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
}
