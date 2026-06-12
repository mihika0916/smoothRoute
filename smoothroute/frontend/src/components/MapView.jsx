import { useEffect } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";

const colors = ["#246bfe", "#16a34a", "#f97316", "#9333ea", "#e11d48", "#0891b2"];
const depotIcon = new L.DivIcon({ className: "depot-pin", html: "D", iconSize: [28, 28] });

export default function MapView({ result, orders = [], settings, compact = false, activeStep = null, progressive = false }) {
  const depot = settings.depot;
  const routes = result?.routes || [];
  return (
    <MapContainer className={compact ? "map compact" : "map"} center={[depot.latitude, depot.longitude]} zoom={13} scrollWheelZoom={false}>
      <MapUpdater depot={depot} />
      <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={[depot.latitude, depot.longitude]} icon={depotIcon}>
        <Popup>{depot.name}<br />Morning production depot</Popup>
      </Marker>
      {(!result || progressive) && orders.map((order) => (
        <CircleMarker key={order.id} center={[order.latitude, order.longitude]} radius={6} pathOptions={{ color: "#7d8ca3", fillColor: "#ffffff", fillOpacity: progressive ? 0.95 : 0.3, weight: progressive ? 2 : 1 }}>
          <Popup>{order.customer_name}<br />{order.window_start}-{order.window_end}</Popup>
        </CircleMarker>
      ))}
      {routes.map((route, index) => (
        <RouteLayer key={route.driver_id} route={route} color={colors[index % colors.length]} activeStep={activeStep} progressive={progressive} depot={depot} />
      ))}
    </MapContainer>
  );
}

function MapUpdater({ depot }) {
  const map = useMap();
  useEffect(() => {
    map.setView([depot.latitude, depot.longitude], map.getZoom());
  }, [depot.latitude, depot.longitude, map]);
  return null;
}

function RouteLayer({ route, color, activeStep, progressive, depot }) {
  const fulfilledCount = progressive ? Math.max(0, activeStep || 0) : route.stops.length;
  const visibleStops = progressive ? route.stops.slice(0, fulfilledCount) : route.stops;
  const path = progressive ? progressivePath(route, visibleStops, depot) : route.path.map((point) => [point.lat, point.lng]);
  const movingStop = progressive ? route.stops[fulfilledCount - 1] : activeStep != null ? route.stops[Math.min(activeStep, route.stops.length - 1)] : null;
  return (
    <>
      {path.length > 1 && <Polyline positions={path} pathOptions={{ color, weight: 4, opacity: 0.78 }} />}
      {visibleStops.map((stop, index) => (
        <CircleMarker key={stop.order.id} center={[stop.order.latitude, stop.order.longitude]} radius={7} pathOptions={{ color, fillColor: progressive ? color : statusColor(stop.status), fillOpacity: 0.92 }}>
          <Popup>
            Driver {route.driver_id}, stop {index + 1}<br />
            {stop.order.customer_name}<br />
            Arrival {stop.arrival_time}, {stop.status}
          </Popup>
        </CircleMarker>
      ))}
      {movingStop && (
        <CircleMarker center={[movingStop.order.latitude, movingStop.order.longitude]} radius={12} pathOptions={{ color, fillColor: color, fillOpacity: 0.25, weight: 4 }} />
      )}
    </>
  );
}

function progressivePath(route, visibleStops, depot) {
  if (!visibleStops.length) return [[depot.latitude, depot.longitude]];
  const lastStop = visibleStops[visibleStops.length - 1].order;
  const lastIndex = nearestPathIndex(route.path, lastStop.latitude, lastStop.longitude);
  return route.path.slice(0, Math.max(2, lastIndex + 1)).map((point) => [point.lat, point.lng]);
}

function nearestPathIndex(path, latitude, longitude) {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  path.forEach((point, index) => {
    const distance = Math.abs(point.lat - latitude) + Math.abs(point.lng - longitude);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function statusColor(status) {
  if (status === "late") return "#dc2626";
  if (status === "risky") return "#eab308";
  return "#16a34a";
}
