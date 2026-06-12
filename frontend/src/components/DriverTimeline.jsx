const START = 6 * 60;
const END = 11 * 60;

export default function DriverTimeline({ result }) {
  if (!result) return null;
  return (
    <section className="panel">
      <div className="section-title"><h2>Driver Timeline</h2><p>Delivery windows from 6:00 AM to 11:00 AM. Green is on time, yellow is risky, red is late.</p></div>
      <div className="timeline">
        {result.routes.map((route) => (
          <div className="timeline-row" key={route.driver_id}>
            <strong>Driver {route.driver_id}</strong>
            <div className="timeline-track">
              {route.stops.map((stop, index) => {
                const left = ((toMinutes(stop.arrival_time) - START) / (END - START)) * 100;
                return <span key={stop.order.id} className={`delivery ${stop.status}`} style={{ left: `${Math.max(0, Math.min(96, left))}%` }} title={`${index + 1}. ${stop.order.customer_name} ${stop.arrival_time}`} />;
              })}
            </div>
          </div>
        ))}
        <div className="timeline-axis"><span>6 AM</span><span>8 AM</span><span>11 AM</span></div>
      </div>
    </section>
  );
}

function toMinutes(value) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
