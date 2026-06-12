import MapView from "./MapView.jsx";

export default function AlgorithmComparison({ results, settings }) {
  if (!results.length) return null;
  const badges = winnerBadges(results);
  return (
    <section className="comparison">
      {results.map((result) => (
        <article className="algorithm-panel" key={result.algorithm}>
          <div className="algo-head">
            <h2>{result.algorithm}</h2>
            <span title={tooltip(result.algorithm)}>?</span>
          </div>
          {!!badges[result.algorithm]?.length && (
            <div className="winner-badges">
              {badges[result.algorithm].map((badge) => <b key={badge}>🏆 {badge}</b>)}
            </div>
          )}
          <MapView result={result} settings={settings} compact />
          <div className="metric-strip">
            <b>{result.metrics.total_distance_km} km</b>
            <b>{result.metrics.late_deliveries} late</b>
            <b>{result.metrics.on_time_percentage}% on time</b>
          </div>
          {!!result.warnings?.length && (
            <div className="warning-list compact-warnings">
              {result.warnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          )}
          <ol className="route-list">
            {result.routes.map((route) => (
              <li key={route.driver_id}>Driver {route.driver_id}: {route.stops.map((stop) => stop.order.customer_name).join(" -> ") || "No stops"}</li>
            ))}
          </ol>
        </article>
      ))}
    </section>
  );
}

function winnerBadges(results) {
  const badges = {};
  const add = (algorithm, label) => {
    badges[algorithm] = [...(badges[algorithm] || []), label];
  };
  const shortest = minBy(results, (result) => result.metrics?.total_distance_km);
  const fastest = minBy(results, (result) => result.metrics?.computation_time_ms);
  const bestOnTime = maxBy(results, (result) => result.metrics?.on_time_percentage);
  if (shortest) add(shortest.algorithm, "Shortest Distance");
  if (fastest) add(fastest.algorithm, "Fastest Compute");
  if (bestOnTime) add(bestOnTime.algorithm, "Best On-Time Performance");
  return badges;
}

function minBy(items, getter) {
  return items.filter((item) => Number.isFinite(Number(getter(item)))).sort((a, b) => Number(getter(a)) - Number(getter(b)))[0];
}

function maxBy(items, getter) {
  return items.filter((item) => Number.isFinite(Number(getter(item)))).sort((a, b) => Number(getter(b)) - Number(getter(a)))[0];
}

function tooltip(name) {
  if (name.includes("Greedy")) return "Earliest deadline priority with nearest feasible next stop.";
  if (name.includes("Clarke")) return "Savings-based route merging with time window validation and repair.";
  return "Google OR-Tools VRPTW benchmark when installed, graceful fallback otherwise.";
}
