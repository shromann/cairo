import React from "react";
import { Activity, Heart, Droplets, Zap } from "lucide-react";

/**
 * Diagnostic Vital Metric Badges HUD (Instatic Widget Style)
 */
export function MetricBadges({ studyParams = {}, kinematics = {} }) {
  const ef = studyParams.ef ?? 55.0;
  const edv = studyParams.edv ?? 100.0;
  const esv = studyParams.esv ?? 45.0;
  const gls = studyParams.gls ?? -18.5;
  const strokeVolume = studyParams.strokeVolume ?? (edv - esv);
  const heartRate = studyParams.heartRate ?? 70;
  const cardiacOutput = ((strokeVolume * heartRate) / 1000).toFixed(1);

  const currentVol = kinematics.currentVolume ? kinematics.currentVolume.toFixed(1) : edv.toFixed(1);
  const phaseName = kinematics.phaseName || "Diastole";

  // Clinical EF Status determination
  let efStatus = "Preserved Function";
  let efClass = "status-normal";
  if (ef < 30) {
    efStatus = "Severe HFrEF";
    efClass = "status-severe";
  } else if (ef < 40) {
    efStatus = "Moderate Dysfunction";
    efClass = "status-warning";
  } else if (ef < 50) {
    efStatus = "Mild Impairment (HFmrEF)";
    efClass = "status-warning";
  } else if (ef > 70) {
    efStatus = "Hyperdynamic";
    efClass = "status-cyan";
  }

  return (
    <div className="metric-badges-grid">
      {/* 1. Ejection Fraction */}
      <div className={`metric-card ${efClass}`}>
        <div className="metric-header">
          <span className="metric-label">LVEF Ejection Fraction</span>
          <Activity className="metric-icon" size={14} />
        </div>
        <div className="metric-value-row">
          <span className="metric-value">{ef.toFixed(1)}</span>
          <span className="metric-unit">%</span>
        </div>
        <div className="metric-footer">
          <span className="metric-tag">{efStatus}</span>
        </div>
      </div>

      {/* 2. Global Longitudinal Strain (GLS) */}
      <div className="metric-card status-cyan">
        <div className="metric-header">
          <span className="metric-label">PanEcho GLS Strain</span>
          <Zap className="metric-icon" size={14} />
        </div>
        <div className="metric-value-row">
          <span className="metric-value">{gls.toFixed(1)}</span>
          <span className="metric-unit">%</span>
        </div>
        <div className="metric-footer">
          <span className="metric-tag">{gls <= -18 ? "Normal Deform" : "Impaired Deform"}</span>
        </div>
      </div>

      {/* 3. Instantaneous Volume V(t) */}
      <div className="metric-card status-gold">
        <div className="metric-header">
          <span className="metric-label">Instantaneous Cavity V(t)</span>
          <Droplets className="metric-icon" size={14} />
        </div>
        <div className="metric-value-row">
          <span className="metric-value">{currentVol}</span>
          <span className="metric-unit">mL</span>
        </div>
        <div className="metric-footer">
          <span className="metric-tag">{phaseName}</span>
        </div>
      </div>

      {/* 4. Stroke Volume & Output */}
      <div className="metric-card status-purple">
        <div className="metric-header">
          <span className="metric-label">Stroke Volume &amp; CO</span>
          <Heart className="metric-icon" size={14} />
        </div>
        <div className="metric-value-row">
          <span className="metric-value">{strokeVolume.toFixed(0)}</span>
          <span className="metric-unit">mL ({cardiacOutput} L/m)</span>
        </div>
        <div className="metric-footer">
          <span className="metric-tag">EDV {edv.toFixed(0)} / ESV {esv.toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
}
