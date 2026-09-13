import React, { useState } from "react";
import {
  Grid3X3,
  Box,
  Eye,
  Activity,
  Scissors,
  Layers,
  Camera,
  RotateCcw,
  X,
  Check
} from "lucide-react";

/**
 * Modern CAD / Blender-Style Viewport Navigation System
 * 1. Top-Center Floating Clinical Vitals HUD
 * 2. Left Vertical Tool Dock with Vertically-Centered Secondary Flyout Dock
 */
export function BlenderViewportToolbar({
  displayMode = "wireframe",
  viewMode = "none",
  showHeatmap = false,
  showValves = true,
  showSimpsonTracings = false,
  studyParams,
  kinematics,
  activeCameraPreset = "anterior",
  onChangeDisplayMode = () => {},
  onChangeViewMode = () => {},
  onSelectCameraPreset = () => {},
  onToggleHeatmap = () => {},
  onToggleValves = () => {},
  onToggleSimpson = () => {}
}) {
  const [activeFlyout, setActiveFlyout] = useState(null); // null | "shading" | "slicing" | "camera" | "overlays"

  const toggleFlyout = (id) => {
    setActiveFlyout((prev) => (prev === id ? null : id));
  };

  const shadingModes = [
    { id: "wireframe", label: "Wireframe", desc: "Poly-Wire Topology", icon: Grid3X3 },
    { id: "solid", label: "Solid PBR", desc: "Photorealistic Myocardium", icon: Box },
    { id: "xray", label: "X-Ray", desc: "Cavity Transillumination", icon: Eye },
    { id: "heatmap", label: "Strain Map", desc: "17-Segment Regional Strain", icon: Activity }
  ];

  const ultrasoundPlanes = [
    { id: "none", label: "3D Full", desc: "Complete 3D Volumetric Twin" },
    { id: "A4C", label: "A4C Plane", desc: "Apical 4-Chamber Long-Axis" },
    { id: "A2C", label: "A2C Plane", desc: "Apical 2-Chamber Slice" },
    { id: "PLAX", label: "PLAX Plane", desc: "Parasternal Long-Axis" },
    { id: "PSAX", label: "PSAX Plane", desc: "Parasternal Short-Axis" }
  ];

  const cameraPresets = [
    { id: "anterior", label: "Front (Anterior)", desc: "Standard AP Projection" },
    { id: "lateral", label: "LV Lateral", desc: "Free Wall & Mid-Cavity" },
    { id: "superior", label: "Valves (Superior)", desc: "Mitral & Aortic Annulus" },
    { id: "apical", label: "Apical View", desc: "Apex to Base Long-Axis" }
  ];

  const ef = studyParams?.ef ? Math.round(studyParams.ef * 10) / 10 : 26.7;
  const edv = studyParams?.edv ? Math.round(studyParams.edv * 10) / 10 : 149.8;
  const esv = studyParams?.esv ? Math.round(studyParams.esv * 10) / 10 : 109.8;
  const gls = studyParams?.gls ? Math.round(studyParams.gls * 10) / 10 : -18.5;

  return (
    <>
      {/* 1. TOP CENTER FLOATING VITALS HUD */}
      <div className="vitals-top-hud">
        <div className="vitals-hud-pill">
          <div className="vitals-hud-item ef-item">
            <span className={`vitals-status-dot ${ef < 40 ? "dot-danger" : ef < 50 ? "dot-warning" : "dot-normal"}`} />
            <span className="vitals-hud-label">LVEF</span>
            <span className={`vitals-hud-val ${ef < 40 ? "text-danger" : ef < 50 ? "text-warning" : "text-normal"}`}>
              {ef}%
            </span>
          </div>

          <div className="vitals-hud-divider" />

          <div className="vitals-hud-item">
            <span className="vitals-hud-label">EDV</span>
            <span className="vitals-hud-val">
              {edv} <span className="vitals-hud-unit">mL</span>
            </span>
          </div>

          <div className="vitals-hud-divider" />

          <div className="vitals-hud-item">
            <span className="vitals-hud-label">ESV</span>
            <span className="vitals-hud-val">
              {esv} <span className="vitals-hud-unit">mL</span>
            </span>
          </div>

          <div className="vitals-hud-divider" />

          <div className="vitals-hud-item">
            <span className="vitals-hud-label">GLS</span>
            <span className="vitals-hud-val">{gls}%</span>
          </div>
        </div>
      </div>

      {/* 2. LEFT VERTICAL TOOL DOCK (Vertically Centered) */}
      <div className="blender-left-dock">
        {/* Shading Tool */}
        <button
          className={`dock-tool-btn ${activeFlyout === "shading" ? "active" : ""}`}
          onClick={() => toggleFlyout("shading")}
          title="Viewport Shading (Wireframe, Solid, X-Ray, Strain)"
        >
          <Grid3X3 size={17} />
          <span className="dock-tooltip">Shading</span>
        </button>

        {/* Ultrasound Slicing Tool */}
        <button
          className={`dock-tool-btn ${activeFlyout === "slicing" || viewMode !== "none" ? "active" : ""}`}
          onClick={() => toggleFlyout("slicing")}
          title="Ultrasound Cutting Planes (3D, A4C, A2C, PLAX, PSAX)"
        >
          <Scissors size={17} />
          {viewMode !== "none" && <span className="dock-badge-dot" />}
          <span className="dock-tooltip">Slicing</span>
        </button>

        {/* Camera Presets Tool */}
        <button
          className={`dock-tool-btn ${activeFlyout === "camera" ? "active" : ""}`}
          onClick={() => toggleFlyout("camera")}
          title="Camera Anatomical Angles"
        >
          <Camera size={17} />
          <span className="dock-tooltip">Camera</span>
        </button>

        {/* Anatomical Overlays Tool */}
        <button
          className={`dock-tool-btn ${activeFlyout === "overlays" ? "active" : ""}`}
          onClick={() => toggleFlyout("overlays")}
          title="Anatomical Layers & Overlays"
        >
          <Layers size={17} />
          <span className="dock-tooltip">Overlays</span>
        </button>

        <div className="dock-divider" />

        {/* Quick Reset Camera Action */}
        <button
          className="dock-tool-btn dock-action-btn"
          onClick={() => onSelectCameraPreset("reset")}
          title="Reset Camera to Home"
        >
          <RotateCcw size={15} />
          <span className="dock-tooltip">Reset View</span>
        </button>
      </div>

      {/* 3. SECONDARY DOCK FLYOUT (Centered Vertically Next to Left Dock) */}
      {activeFlyout && (
        <>
          <div className="dock-flyout-backdrop" onClick={() => setActiveFlyout(null)} />
          <div className="blender-secondary-dock">
            {/* Flyout Header */}
            <div className="secondary-dock-header">
              <span className="secondary-dock-title">
                {activeFlyout === "shading" && "Viewport Shading"}
                {activeFlyout === "slicing" && "Ultrasound Slicing Planes"}
                {activeFlyout === "camera" && "Camera View Presets"}
                {activeFlyout === "overlays" && "Anatomical Overlays"}
              </span>
              <button
                className="secondary-dock-close"
                onClick={() => setActiveFlyout(null)}
                title="Close palette"
              >
                <X size={13} />
              </button>
            </div>

            {/* Content for Shading */}
            {activeFlyout === "shading" && (
              <div className="secondary-dock-list">
                {shadingModes.map((mode) => {
                  const Icon = mode.icon;
                  const isSelected = displayMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      className={`secondary-dock-item ${isSelected ? "selected" : ""}`}
                      onClick={() => {
                        onChangeDisplayMode(mode.id);
                        setActiveFlyout(null);
                      }}
                    >
                      <div className="item-icon-wrap">
                        <Icon size={15} />
                      </div>
                      <div className="item-text-wrap">
                        <span className="item-title">{mode.label}</span>
                        <span className="item-desc">{mode.desc}</span>
                      </div>
                      {isSelected && <Check size={14} className="item-check" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Content for Slicing */}
            {activeFlyout === "slicing" && (
              <div className="secondary-dock-list">
                {ultrasoundPlanes.map((plane) => {
                  const isSelected = viewMode === plane.id;
                  return (
                    <button
                      key={plane.id}
                      className={`secondary-dock-item ${isSelected ? "selected" : ""}`}
                      onClick={() => {
                        onChangeViewMode(plane.id);
                        setActiveFlyout(null);
                      }}
                    >
                      <div className="item-text-wrap">
                        <span className="item-title">{plane.label}</span>
                        <span className="item-desc">{plane.desc}</span>
                      </div>
                      {isSelected && <Check size={14} className="item-check" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Content for Camera Presets */}
            {activeFlyout === "camera" && (
              <div className="secondary-dock-list">
                {cameraPresets.map((cam) => {
                  const isSelected = activeCameraPreset === cam.id;
                  return (
                    <button
                      key={cam.id}
                      className={`secondary-dock-item ${isSelected ? "selected" : ""}`}
                      onClick={() => {
                        onSelectCameraPreset(cam.id);
                        setActiveFlyout(null);
                      }}
                    >
                      <div className="item-text-wrap">
                        <span className="item-title">{cam.label}</span>
                        <span className="item-desc">{cam.desc}</span>
                      </div>
                      {isSelected && <Check size={14} className="item-check" />}
                    </button>
                  );
                })}
                <div className="dock-item-divider" />
                <button
                  className="secondary-dock-item reset-item"
                  onClick={() => {
                    onSelectCameraPreset("reset");
                    setActiveFlyout(null);
                  }}
                >
                  <RotateCcw size={14} />
                  <span className="item-title">Reset Camera to Default</span>
                </button>
              </div>
            )}

            {/* Content for Overlays */}
            {activeFlyout === "overlays" && (
              <div className="secondary-dock-list">
                <label className="secondary-dock-toggle">
                  <input
                    type="checkbox"
                    checked={showValves}
                    onChange={onToggleValves}
                  />
                  <div className="toggle-text-wrap">
                    <span className="item-title">Fibrous Valve Leaflets</span>
                    <span className="item-desc">Mitral & Aortic functional annulus</span>
                  </div>
                </label>

                <label className="secondary-dock-toggle">
                  <input
                    type="checkbox"
                    checked={showSimpsonTracings}
                    onChange={onToggleSimpson}
                  />
                  <div className="toggle-text-wrap">
                    <span className="item-title">Simpson's 20-Disc Tracings</span>
                    <span className="item-desc">Biplane volumetric disk sum</span>
                  </div>
                </label>

                <label className="secondary-dock-toggle">
                  <input
                    type="checkbox"
                    checked={showHeatmap || displayMode === "heatmap"}
                    onChange={onToggleHeatmap}
                  />
                  <div className="toggle-text-wrap">
                    <span className="item-title">AHA 17 Regional Strain Map</span>
                    <span className="item-desc">Color-coded segmental deformation</span>
                  </div>
                </label>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

