import { Upload } from "lucide-react";

export default function BusinessOrderUpload({ orders, setOrders }) {
  function parseCsv(text) {
    const [header, ...lines] = text.trim().split(/\r?\n/);
    const keys = header.split(",");
    const parsed = lines.map((line, index) => {
      const values = line.split(",");
      const row = Object.fromEntries(keys.map((key, i) => [key.trim(), values[i]?.trim() || ""]));
      return {
        id: `CSV-${index + 1}`,
        customer_name: row.customer_name,
        address: row.address,
        latitude: row.latitude ? Number(row.latitude) : null,
        longitude: row.longitude ? Number(row.longitude) : null,
        window_start: row.window_start,
        window_end: row.window_end,
        notes: row.notes || "",
      };
    });
    setOrders(parsed);
  }
  return (
    <section className="panel">
      <div className="section-title inline">
        <div><h2>Orders</h2><p>Upload the morning CSV or add a quick manual order.</p></div>
        <label className="upload"><Upload size={17} /> CSV<input type="file" accept=".csv" onChange={(event) => event.target.files?.[0]?.text().then(parseCsv)} /></label>
      </div>
      <div className="order-grid">
        <input placeholder="Customer" id="customer" />
        <input placeholder="Latitude" id="lat" />
        <input placeholder="Longitude" id="lng" />
        <input defaultValue="07:00" id="start" />
        <input defaultValue="07:30" id="end" />
        <button onClick={() => {
          const next = {
            id: `MAN-${orders.length + 1}`,
            customer_name: document.getElementById("customer").value || `Walk-in ${orders.length + 1}`,
            address: "",
            latitude: Number(document.getElementById("lat").value),
            longitude: Number(document.getElementById("lng").value),
            window_start: document.getElementById("start").value,
            window_end: document.getElementById("end").value,
            notes: "",
          };
          setOrders([...orders, next]);
        }}>Add</button>
      </div>
      <p className="count">{orders.length} orders loaded</p>
    </section>
  );
}
