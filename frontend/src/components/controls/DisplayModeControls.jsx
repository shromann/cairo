import React from "react";
import { Eye, Layers, Scissors, Flame, Activity } from "lucide-react";

/**
 * Display Mode, Ultrasound Slicing Planes & Shader Controls
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
          <Layers size={13} /> 3D Material
        </span>
        <div className="button-toggle-row">
          {[
            { id: "solid", label: "PBR Solid" },
            { id: "xray", label: "X-Ray Glass" },
            { id: "wireframe", label: "Mesh Wire" },
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
          <Scissors size={13} /> Ultrasound Cutting Plane
        </span>
        <div className="button-toggle-row">
          {[
            { id: "none", label: "Off (3D)" },
            { id: "A4C", label: "A4C (4-Chamber)" },
            { id: "A2C", label: "A2C (2-Chamber)" },
            { id: "PLAX", label: "PLAX (Long-Axis)" },
            { id: "PSAX", label: "PSAX (Short-Axis)" }
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
          <span>Mitral/Aortic Valves</span>
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showSimpsonTracings}
            onChange={onToggleSimpson}
          />
          <span>Simpson 20-Disc Tracings</span>
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showHeatmap}
            onChange={onToggleHeatmap}
          />
          <span>AHA 17 Strain Overlay</span>
        </label>
      </div>
    </div>
  );
}
