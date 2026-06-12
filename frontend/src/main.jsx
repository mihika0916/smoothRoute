import React from "react";
import { createRoot } from "react-dom/client";
import { BarChart3, FlaskConical } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import ResearchMode from "./pages/ResearchMode.jsx";

function App() {
  return (
    <main>
      <header className="topbar">
        <div>
          <p className="eyebrow">Breakfast logistics + VRPTW lab</p>
          <h1>SmoothRoute</h1>
        </div>
        <nav className="segmented" aria-label="Mode">
          <button className="active"><FlaskConical size={17} /> Research Lab</button>
        </nav>
      </header>
      <ResearchMode />
      <footer><BarChart3 size={16} /> Research lab uses OSRM road-network routing when enabled, with Haversine fallback only if the road provider is unavailable.</footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
