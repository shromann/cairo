import React from "react";
import { Layers, Scissors } from "lucide-react";

/**
 * Display Mode, Ultrasound Slicing Planes & Shader Controls (Instatic Segmented Controls)
 */
export function DisplayModeControls({
  displayMode = "solid",
  viewMode = "none",
  showHeatmap = false,
  showValves = true,
  showSimpsonTracings = false,
  onChangeDisplayMode = () => {},
  onChangeViewMode = () => {},
  onToggleHeatmap = () => {},
  onToggleValves = () => {},
  onToggleSimpson = () => {}
}) {
  return (
    <div className="display-controls-card">
      <div className="display-group">
        <span className="ctrl-group-label">
          <Layers size={12} /> Material
        </span>
        <div className="button-toggle-row">
          {[
            { id: "solid", label: "PBR Solid" },
            { id: "xray", label: "X-Ray" },
            { id: "wireframe", label: "Wireframe" },
            { id: "heatmap", label: "Strain Heatmap" }
          ].map((mode) => (
            <button
              key={mode.id}
              className={`toggle-pill ${displayMode === mode.id ? "active" : ""}`}
              onClick={() => onChangeDisplayMode(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      <div className="display-group">
        <span className="ctrl-group-label">
          <Scissors size={12} /> Ultrasound Plane
        </span>
        <div className="button-toggle-row">
          {[
            { id: "none", label: "3D View" },
            { id: "A4C", label: "A4C" },
            { id: "A2C", label: "A2C" },
            { id: "PLAX", label: "PLAX" },
            { id: "PSAX", label: "PSAX" }
          ].map((plane) => (
            <button
              key={plane.id}
              className={`toggle-pill ${viewMode === plane.id ? "active" : ""}`}
              onClick={() => onChangeViewMode(plane.id)}
            >
              {plane.label}
            </button>
          ))}
        </div>
      </div>

      <div className="display-group toggles-row">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showValves}
            onChange={onToggleValves}
          />
          <span>Valves</span>
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showSimpsonTracings}
            onChange={onToggleSimpson}
          />
          <span>Simpson 20-Discs</span>
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showHeatmap}
            onChange={onToggleHeatmap}
          />
          <span>AHA 17 Overlay</span>
        </label>
      </div>
    </div>
  );
}
