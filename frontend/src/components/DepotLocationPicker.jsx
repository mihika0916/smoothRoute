import { CheckCircle2, Copy, LocateFixed, MapPin, Navigation, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { api } from "../utils/api.js";

const depotIcon = new L.DivIcon({ className: "depot-map-pin", html: "<span></span>", iconSize: [34, 44], iconAnchor: [17, 40] });

export default function DepotLocationPicker({ depot, onSave, busy }) {
  const [draft, setDraft] = useState(depot);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchState, setSearchState] = useState("idle");
  const [status, setStatus] = useState("");
  const hasLocation = hasCoordinate(draft?.latitude, draft?.longitude);
  const center = hasLocation ? [Number(draft.latitude), Number(draft.longitude)] : [28.434364, 77.112579];
  const savedText = useMemo(() => `${Number(depot.latitude).toFixed(6)}, ${Number(depot.longitude).toFixed(6)}`, [depot.latitude, depot.longitude]);

  useEffect(() => {
    setDraft(depot);
  }, [depot]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setResults([]);
      setSearchState("idle");
      return;
    }
    setSearchState("searching");
    const timer = setTimeout(async () => {
      try {
        const response = await api.geocodeSearch({ address: trimmed });
        setResults(response.results || []);
        setSearchState(response.results?.length ? "ready" : "empty");
        if (response.warning) setStatus(response.warning);
      } catch (error) {
        setResults([]);
        setSearchState("error");
        setStatus("Couldn't geocode this address");
      }
    }, 550);
    return () => clearTimeout(timer);
  }, [query]);

  function applyResult(result) {
    const next = {
      name: result.name || result.address.split(",")[0],
      address: result.address,
      latitude: result.latitude,
      longitude: result.longitude,
    };
    setDraft(next);
    onSave(next);
    setQuery("");
    setResults([]);
    setSearchState("idle");
    setStatus("Depot location set and auto-saved");
  }

  async function updateFromMap(latitude, longitude) {
    setDraft((current) => ({ ...current, latitude, longitude }));
    setStatus("Updating address from map...");
    try {
      const result = await api.reverseGeocode({ latitude, longitude });
      const next = {
        ...draft,
        name: result.display_name ? result.display_name.split(",")[0] : draft.name,
        address: result.display_name || draft.address,
        latitude,
        longitude,
      };
      setDraft((current) => ({
        ...current,
        name: result.display_name ? result.display_name.split(",")[0] : current.name,
        address: result.display_name || current.address,
        latitude,
        longitude,
      }));
      onSave(next);
      setStatus(result.warning || "Depot location set and auto-saved");
    } catch {
      setStatus("Couldn’t geocode this address");
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

  function clearLocation() {
    setDraft({ name: "", address: "", latitude: "", longitude: "" });
    setQuery("");
    setResults([]);
    setStatus("No depot selected yet. Search or click the map to auto-save a new depot.");
  }

  return (
    <section className="depot-picker">
      <div className="depot-picker-body">
        <div className="depot-map-workspace">
          <div className="depot-mode-tabs">
            <button type="button" className="active"><Search size={17} /> Search address</button>
            <button type="button" onClick={useCurrentLocation} disabled={busy}><LocateFixed size={17} /> Use current location</button>
          </div>
          <div className="search-box">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search address, place, or postcode" />
            {query && <button type="button" className="ghost-icon" onClick={() => setQuery("")} aria-label="Clear search"><X size={18} /></button>}
          </div>
          <div className="suggestions-box">
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
          <MapContainer className="depot-picker-map" center={center} zoom={hasLocation ? 15 : 12} scrollWheelZoom>
            <MapSync center={center} zoom={hasLocation ? 15 : 12} />
            <MapClick onPick={(latlng) => updateFromMap(round(latlng.lat), round(latlng.lng))} />
            <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {hasLocation && (
              <Marker
                position={[Number(draft.latitude), Number(draft.longitude)]}
                icon={depotIcon}
                draggable
                eventHandlers={{ dragend: (event) => {
                  const latlng = event.target.getLatLng();
                  updateFromMap(round(latlng.lat), round(latlng.lng));
                } }}
              >
                <Popup>
                  <b>{draft.name || "Depot"}</b><br />
                  {draft.address || "Selected depot location"}<br />
                  <button type="button" className="popup-link">Edit location</button>
                </Popup>
              </Marker>
            )}
          </MapContainer>
          <div className="map-help"><Navigation size={17} /> Drag pin or click map to adjust location</div>
        </div>
        <aside className="depot-confirm-card">
          <div className={hasLocation ? "depot-status set" : "depot-status"}>
            <CheckCircle2 size={20} />
            <div>
              <b>{hasLocation ? "Depot location set" : "No depot selected yet"}</b>
              <p>{hasLocation ? draft.name || draft.address || savedText : status || "Search, use your location, or click the map."}</p>
            </div>
          </div>
          <div className="selected-place-card">
            <span>Selected Depot</span>
            <h3>{hasLocation ? draft.name || "Selected depot" : "Waiting for depot"}</h3>
            <p>{hasLocation ? draft.address || savedText : "Choose a starting point before creating delivery stops."}</p>
          </div>
          <details className="advanced-details">
            <summary>Advanced Details</summary>
            <div className="coordinate-grid">
              <Coordinate label="Latitude" value={hasLocation ? Number(draft.latitude).toFixed(6) : ""} />
              <Coordinate label="Longitude" value={hasLocation ? Number(draft.longitude).toFixed(6) : ""} />
            </div>
          </details>
          {hasLocation && <button type="button" onClick={clearLocation}><Trash2 size={16} /> Clear location</button>}
          <p className="tip-card"><LocateFixed size={17} /> You can change the depot location later if needed.</p>
        </aside>
      </div>
      <div className="depot-picker-footer">
        <p><LocateFixed size={17} /> Tip: search, use current location, click the map, or drag the pin. Changes auto-save.</p>
        <span className={hasLocation ? "autosave-pill set" : "autosave-pill"}>{hasLocation ? "Auto-saved" : "Waiting for location"}</span>
      </div>
    </section>
  );
}

function Coordinate({ label, value }) {
  return (
    <label>{label}
      <div className="coordinate-copy">
        <input readOnly value={value} placeholder="Not set" />
        <button type="button" aria-label={`Copy ${label}`} onClick={() => value && navigator.clipboard?.writeText(value)}><Copy size={16} /></button>
      </div>
    </label>
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

function round(value) {
  return Math.round(value * 1000000) / 1000000;
}

function hasCoordinate(latitude, longitude) {
  return latitude !== "" && latitude != null && longitude !== "" && longitude != null
    && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
}
