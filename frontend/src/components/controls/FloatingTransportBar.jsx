import React from "react";
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Activity
} from "lucide-react";

/**
 * Blender-Style Floating Transport & Timeline Scrubber Bar
 * Floats docked at the bottom of the 3D Viewport.
 */
export function FloatingTransportBar({
  currentPhase = 0,
  isPlaying = true,
  bpm = 70,
  speedMultiplier = 1.0,
  phaseName = "Systole",
  onTogglePlay = () => {},
  onSeekPhase = () => {},
  onStepPhase = () => {},
  onChangeBpm = () => {},
  onChangeSpeed = () => {}
}) {
  const phasePercent = Math.round(currentPhase * 100);

  return (
    <div className="floating-transport-bar">
      {/* 1. Playback Action Buttons */}
      <div className="transport-btn-group">
        <button
          className="transport-icon-btn"
          onClick={() => onStepPhase(-0.02)}
          title="Step Back 2%"
        >
          <ChevronLeft size={14} />
        </button>

        <button
          className={`transport-play-btn ${isPlaying ? "playing" : ""}`}
          onClick={onTogglePlay}
          title={isPlaying ? "Pause Timeline (Space)" : "Play Cardiac Cycle"}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
        </button>

        <button
          className="transport-icon-btn"
          onClick={() => onStepPhase(0.02)}
          title="Step Forward 2%"
        >
          <ChevronRight size={14} />
        </button>

        <button
          className="transport-icon-btn"
          onClick={() => onSeekPhase(0)}
          title="Reset to End-Diastole (0%)"
        >
          <RotateCcw size={12} />
        </button>
      </div>

      <div className="transport-divider-v" />

      {/* 2. Cardiac Phase Readout Badge */}
      <div className="transport-phase-badge">
        <span className="dot dot-cyan"></span>
        <span className="t-phase-name">{phaseName}</span>
        <span className="t-phase-pct">{phasePercent}%</span>
      </div>

      {/* 3. Central Interactive Timeline Scrubber */}
      <div className="transport-slider-wrap">
        <input
          type="range"
          min="0"
          max="1"
          step="0.005"
          value={currentPhase}
          onChange={(e) => onSeekPhase(parseFloat(e.target.value))}
          className="transport-range-slider"
          aria-label="Cardiac phase scrubber"
        />

        {/* Phase Jumps */}
        <div className="transport-phase-markers">
          {[
            { label: "ED", phase: 0.0 },
            { label: "Ejection", phase: 0.20 },
            { label: "ES", phase: 0.38 },
            { label: "E-wave", phase: 0.60 },
            { label: "A-wave", phase: 0.92 }
          ].map((m) => (
            <button
              key={m.label}
              className={`transport-marker-btn ${Math.abs(currentPhase - m.phase) < 0.1 ? "active" : ""}`}
              onClick={() => onSeekPhase(m.phase)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="transport-divider-v" />

      {/* 4. Heart Rate (BPM) & Speed Controls */}
      <div className="transport-rate-group">
        <div className="bpm-pill">
          <Activity size={12} className="text-muted" />
          <select
            value={bpm}
            onChange={(e) => onChangeBpm(parseInt(e.target.value))}
            className="transport-bpm-select"
          >
            <option value={50}>50 BPM</option>
            <option value={60}>60 BPM</option>
            <option value={70}>70 BPM</option>
            <option value={80}>80 BPM</option>
            <option value={100}>100 BPM</option>
            <option value={120}>120 BPM</option>
          </select>
        </div>

        <div className="speed-pill-group">
          {[0.25, 0.5, 1.0].map((s) => (
            <button
              key={s}
              className={`transport-speed-btn ${speedMultiplier === s ? "active" : ""}`}
              onClick={() => onChangeSpeed(s)}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
