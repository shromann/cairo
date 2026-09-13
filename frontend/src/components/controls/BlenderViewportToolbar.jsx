import React, { useState } from "react";
import {
  Grid3X3,
  Box,
  Eye,
  Activity,
  Scissors,
  Layers,
  ChevronDown,
  Check,
  Sparkles,
  Info
} from "lucide-react";

/**
 * Blender-Style 3D Viewport Header Toolbar
 * Provides instant viewport shading, ultrasound slicing planes, and layer toggles.
 */
export function BlenderViewportToolbar({
  displayMode = "wireframe", // DEFAULT IS WIREFRAME
  viewMode = "none",
  showHeatmap = false,
  showValves = true,
  showSimpsonTracings = false,
  studyParams,
  kinematics,
  onChangeDisplayMode = () => {},
  onChangeViewMode = () => {},
  onToggleHeatmap = () => {},
  onToggleValves = () => {},
  onToggleSimpson = () => {}
}) {
  const [layersOpen, setLayersOpen] = useState(false);

  const shadingModes = [
    { id: "wireframe", label: "Wireframe", icon: Grid3X3, desc: "Anatomical Poly-Wire Structure" },
    { id: "solid", label: "Solid PBR", icon: Box, desc: "Photorealistic Myocardial Studio" },
    { id: "xray", label: "X-Ray", icon: Eye, desc: "Endocardial Cavity Transillumination" },
    { id: "heatmap", label: "Strain", icon: Activity, desc: "AHA 17-Segment Regional Map" }
  ];

  const ultrasoundPlanes = [
    { id: "none", label: "3D Full" },
    { id: "A4C", label: "A4C" },
    { id: "A2C", label: "A2C" },
    { id: "PLAX", label: "PLAX" },
    { id: "PSAX", label: "PSAX" }
  ];

  const ef = studyParams?.ef ? Math.round(studyParams.ef * 10) / 10 : 55;
  const edv = studyParams?.edv ? Math.round(studyParams.edv * 10) / 10 : 100;
  const esv = studyParams?.esv ? Math.round(studyParams.esv * 10) / 10 : 45;
  const gls = studyParams?.gls ? Math.round(studyParams.gls * 10) / 10 : -18.5;

  return (
    <div className="blender-viewport-header">
      {/* 1. Left Group: Viewport Shading Modes (Blender Header Style) */}
      <div className="blender-tool-group">
        <span className="blender-group-tag">Shading:</span>
        <div className="blender-segmented-pill">
          {shadingModes.map((mode) => {
            const Icon = mode.icon;
            const isActive = displayMode === mode.id;
            return (
              <button
                key={mode.id}
                className={`blender-tool-btn ${isActive ? "active" : ""}`}
                onClick={() => onChangeDisplayMode(mode.id)}
                title={`${mode.label}: ${mode.desc}`}
              >
                <Icon size={12} />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="blender-divider-v" />

      {/* 2. Middle Group: Ultrasound Slicing Planes */}
      <div className="blender-tool-group">
        <span className="blender-group-tag">
          <Scissors size={11} /> Slicing Plane:
        </span>
        <div className="blender-segmented-pill">
          {ultrasoundPlanes.map((plane) => (
            <button
              key={plane.id}
              className={`blender-tool-btn ${viewMode === plane.id ? "active" : ""}`}
              onClick={() => onChangeViewMode(plane.id)}
            >
              <span>{plane.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="blender-divider-v" />

      {/* 3. Layer Visibility Popover */}
      <div className="blender-tool-group relative-wrap">
        <button
          className={`blender-menu-btn ${layersOpen ? "active" : ""}`}
          onClick={() => setLayersOpen(!layersOpen)}
        >
          <Layers size={12} />
          <span>Overlays</span>
          <ChevronDown size={11} />
        </button>

        {layersOpen && (
          <>
            <div className="popover-backdrop" onClick={() => setLayersOpen(false)} />
            <div className="blender-popover-menu">
              <div className="popover-title">Anatomical Overlays</div>
              <label className="blender-check-item">
                <input
                  type="checkbox"
                  checked={showValves}
                  onChange={onToggleValves}
                />
                <span>Fibrous Valve Leaflets</span>
              </label>

              <label className="blender-check-item">
                <input
                  type="checkbox"
                  checked={showSimpsonTracings}
                  onChange={onToggleSimpson}
                />
                <span>Simpson's 20-Disc Tracings</span>
              </label>

              <label className="blender-check-item">
                <input
                  type="checkbox"
                  checked={showHeatmap || displayMode === "heatmap"}
                  onChange={onToggleHeatmap}
                />
                <span>AHA 17 Regional Strain Heatmap</span>
              </label>
            </div>
          </>
        )}
      </div>

      {/* 4. Right Side: Compact Vital Badges HUD Strip */}
      <div className="blender-vitals-strip">
        <div className="blender-vital-item">
          <span className="bvi-label">LVEF</span>
          <span className={`bvi-val ${ef < 40 ? "text-danger" : ef < 50 ? "text-warning" : "text-normal"}`}>
            {ef}%
          </span>
        </div>
        <div className="blender-vital-item">
          <span className="bvi-label">EDV</span>
          <span className="bvi-val">{edv} mL</span>
        </div>
        <div className="blender-vital-item">
          <span className="bvi-label">ESV</span>
          <span className="bvi-val">{esv} mL</span>
        </div>
        <div className="blender-vital-item">
          <span className="bvi-label">GLS</span>
          <span className="bvi-val">{gls}%</span>
        </div>
      </div>
    </div>
  );
}
