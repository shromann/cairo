import React from "react";
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Gauge } from "lucide-react";

/**
 * Cardiac Cycle Time & Kinematics Controller HUD
 */
export function CardiacControls({
  currentPhase = 0,
  isPlaying = true,
  bpm = 70,
  speedMultiplier = 1.0,
  onTogglePlay = () => {},
  onSeekPhase = () => {},
  onStepPhase = () => {},
  onChangeBpm = () => {},
  onChangeSpeed = () => {}
}) {
  const phasePercent = Math.round(currentPhase * 100);

  return (
    <div className="cardiac-controls-panel">
      {/* 1. Main Scrubber Timeline */}
      <div className="scrubber-row">
        <div className="phase-readout">
          <span className="phase-label">Cardiac Phase</span>
          <span className="phase-value">{phasePercent}%</span>
        </div>

        <input
          type="range"
          min="0"
          max="1"
          step="0.005"
          value={currentPhase}
          onChange={(e) => onSeekPhase(parseFloat(e.target.value))}
          className="cardiac-slider"
        />

        <div className="phase-quick-jumps">
          <button
            className={`phase-jump-btn ${currentPhase < 0.08 ? "active" : ""}`}
            onClick={() => onSeekPhase(0.0)}
          >
            ED (0%)
          </button>
          <button
            className={`phase-jump-btn ${currentPhase >= 0.08 && currentPhase < 0.38 ? "active" : ""}`}
            onClick={() => onSeekPhase(0.20)}
          >
            Ejection
          </button>
          <button
            className={`phase-jump-btn ${currentPhase >= 0.38 && currentPhase < 0.46 ? "active" : ""}`}
            onClick={() => onSeekPhase(0.38)}
          >
            ES (38%)
          </button>
          <button
            className={`phase-jump-btn ${currentPhase >= 0.46 && currentPhase < 0.75 ? "active" : ""}`}
            onClick={() => onSeekPhase(0.60)}
          >
            E-wave
          </button>
          <button
            className={`phase-jump-btn ${currentPhase >= 0.88 ? "active" : ""}`}
            onClick={() => onSeekPhase(0.92)}
          >
            A-wave
          </button>
        </div>
      </div>

      {/* 2. Playback Buttons & Speed Selector */}
      <div className="playback-actions-row">
        <div className="playback-buttons">
          <button
            className="ctrl-btn"
            onClick={() => onStepPhase(-0.02)}
            title="Step Back 2%"
          >
            <ChevronLeft size={16} />
          </button>

          <button
            className={`ctrl-btn play-btn ${isPlaying ? "playing" : ""}`}
            onClick={onTogglePlay}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
          </button>

          <button
            className="ctrl-btn"
            onClick={() => onStepPhase(0.02)}
            title="Step Forward 2%"
          >
            <ChevronRight size={16} />
          </button>

          <button
            className="ctrl-btn"
            onClick={() => onSeekPhase(0)}
            title="Reset to 0%"
          >
            <RotateCcw size={15} />
          </button>
        </div>

        {/* BPM Selector */}
        <div className="bpm-control-group">
          <Gauge size={15} className="text-cyan" />
          <span className="bpm-label">Rate:</span>
          <select
            value={bpm}
            onChange={(e) => onChangeBpm(parseInt(e.target.value))}
            className="bpm-select"
          >
            <option value={50}>50 BPM</option>
            <option value={60}>60 BPM</option>
            <option value={70}>70 BPM (Standard)</option>
            <option value={80}>80 BPM</option>
            <option value={100}>100 BPM (Tachy)</option>
            <option value={120}>120 BPM</option>
          </select>
        </div>

        {/* Speed Multiplier */}
        <div className="speed-buttons">
          {[0.25, 0.5, 1.0].map((s) => (
            <button
              key={s}
              className={`speed-btn ${speedMultiplier === s ? "active" : ""}`}
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
