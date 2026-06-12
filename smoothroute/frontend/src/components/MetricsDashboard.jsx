import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function MetricsDashboard({ results }) {
  const data = results.map((result) => ({
    name: result.algorithm,
    distance: result.metrics.total_distance_km,
    late: result.metrics.late_deliveries,
    onTime: result.metrics.on_time_percentage,
    time: result.metrics.computation_time_ms,
  }));
  return (
    <section className="panel">
      <div className="section-title">
        <h2>Algorithm Metrics</h2>
        <p>Total distance, late deliveries, on-time rate, and computation time from the same scenario.</p>
      </div>
      <div className="chart-grid">
        <Chart title="Total distance">
          <BarChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="distance" fill="#246bfe" /></BarChart>
        </Chart>
        <Chart title="Late deliveries">
          <BarChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="late" fill="#dc2626" /></BarChart>
        </Chart>
        <Chart title="On-time rate">
          <LineChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis domain={[0, 100]} /><Tooltip /><Line dataKey="onTime" stroke="#16a34a" strokeWidth={3} /></LineChart>
        </Chart>
        <Chart title="Computation time">
          <LineChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Line dataKey="time" stroke="#f97316" strokeWidth={3} /></LineChart>
        </Chart>
      </div>
      <div className="chart-explainers">
        <p><b>Total distance</b> is the summed road-network distance for all driver routes in this exact scenario. Lower is usually better, unless it creates late deliveries.</p>
        <p><b>Late deliveries</b> counts orders completed after their selected window. This is the most important promise metric for breakfast delivery.</p>
        <p><b>On-time rate</b> shows the percentage of completed deliveries that hit the window. It should be read alongside distance.</p>
        <p><b>Computation time</b> shows how long each algorithm took for this run. OR-Tools may spend more time searching for a stronger VRPTW solution.</p>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Algorithm</th><th>Distance</th><th>Late</th><th>On time</th><th>Avg late</th><th>Max late</th><th>Balance</th><th>Compute</th><th>Feasibility</th></tr></thead>
          <tbody>{results.map((r) => <tr key={r.algorithm}><td>{r.algorithm}</td><td>{r.metrics.total_distance_km} km</td><td>{r.metrics.late_deliveries}</td><td>{r.metrics.on_time_percentage}%</td><td>{r.metrics.average_lateness_minutes}m</td><td>{r.metrics.maximum_lateness_minutes}m</td><td>{r.metrics.driver_utilization_balance}</td><td>{r.metrics.computation_time_ms}ms</td><td>{r.metrics.feasibility_rate ?? (r.metrics.feasible ? 100 : 0)}%</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

function Chart({ title, children }) {
  return <div className="chart-card"><h3>{title}</h3><ResponsiveContainer width="100%" height={210}>{children}</ResponsiveContainer></div>;
}
