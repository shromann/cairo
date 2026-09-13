import React, { useRef, useEffect } from "react";

/**
 * Wiggers Diagram: Synchronized Multichannel Hemodynamics & Electrophysiology
 * Displays LV/Aortic/LA Pressures, Volume, Lead II ECG Waveform, and Phase cursor.
 */
export function WiggersDiagram({
  telemetryData = [],
  currentPhase = 0,
  studyParams = {}
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !telemetryData.length) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.parentElement.clientWidth;
    const height = 190;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 18, right: 14, bottom: 20, left: 38 };
    const chartW = width - padding.left - padding.right;

    // Top Channel: Pressures (0 to 140 mmHg)
    const pressH = 100;
    const pressY0 = padding.top;
    const maxP = 140;

    // Bottom Channel: ECG Waveform
    const ecgH = 40;
    const ecgY0 = pressY0 + pressH + 16;

    // 1. Shaded Phase Divisions (Systole vs Diastole)
    const systoleW = 0.38 * chartW;
    ctx.fillStyle = "rgba(248, 113, 113, 0.04)";
    ctx.fillRect(padding.left, pressY0, systoleW, pressH + ecgH + 16);

    ctx.fillStyle = "rgba(155, 220, 255, 0.02)";
    ctx.fillRect(padding.left + systoleW, pressY0, chartW - systoleW, pressH + ecgH + 16);

    // Subtle phase text headers
    ctx.fillStyle = "#f87171";
    ctx.font = "8.5px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SYSTOLE", padding.left + systoleW * 0.5, pressY0 - 5);

    ctx.fillStyle = "#9bdcff";
    ctx.fillText("DIASTOLE", padding.left + systoleW + (chartW - systoleW) * 0.5, pressY0 - 5);

    // 2. Pressure Channel Y-Axis Units & Grid lines
    ctx.fillStyle = "#71717a";
    ctx.font = "9px JetBrains Mono, monospace";
    ctx.textAlign = "right";
    ctx.fillText("mmHg", padding.left - 6, pressY0 - 5);

    ctx.strokeStyle = "#232328";
    ctx.lineWidth = 1;
    [0, 40, 80, 120].forEach((p) => {
      const y = pressY0 + pressH - (p / maxP) * pressH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();

      ctx.fillStyle = "#71717a";
      ctx.font = "9px JetBrains Mono, monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${p}`, padding.left - 6, y + 3);
    });

    // Channel Divider Line between Pressure & ECG
    ctx.strokeStyle = "#27272f";
    ctx.beginPath();
    ctx.moveTo(padding.left, pressY0 + pressH + 8);
    ctx.lineTo(padding.left + chartW, pressY0 + pressH + 8);
    ctx.stroke();

    // ECG Y-Axis Gutter Label
    ctx.fillStyle = "#71717a";
    ctx.font = "9px JetBrains Mono, monospace";
    ctx.textAlign = "right";
    ctx.fillText("ECG", padding.left - 6, ecgY0 + ecgH * 0.5 + 3);

    // 3. Draw Aortic Pressure Curve (Lavender)
    ctx.beginPath();
    telemetryData.forEach((pt, idx) => {
      const x = padding.left + pt.t * chartW;
      const y = pressY0 + pressH - (pt.aorticPressure / maxP) * pressH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#c8b6ff";
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // 4. Draw LV Pressure Curve (Sky Blue)
    ctx.beginPath();
    telemetryData.forEach((pt, idx) => {
      const x = padding.left + pt.t * chartW;
      const y = pressY0 + pressH - (pt.lvPressure / maxP) * pressH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#9bdcff";
    ctx.lineWidth = 2.0;
    ctx.stroke();

    // 5. Draw LA Pressure Curve (Amber Dotted)
    ctx.beginPath();
    telemetryData.forEach((pt, idx) => {
      const x = padding.left + pt.t * chartW;
      const y = pressY0 + pressH - (pt.laPressure / maxP) * pressH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1.3;
    ctx.setLineDash([3, 2]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 6. Draw Synthetic Synchronized Lead II ECG (Mint Green)
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const t = i / 200;
      const x = padding.left + t * chartW;
      let ecgVal = 0; // baseline

      if (t > 0.88 && t < 0.98) {
        // P-wave (atrial depolarization)
        const tau = (t - 0.88) / 0.10;
        ecgVal = 0.25 * Math.sin(tau * Math.PI);
      } else if (t >= 0.0 && t < 0.03) {
        // Q-wave
        ecgVal = -0.15 * Math.sin((t / 0.03) * Math.PI);
      } else if (t >= 0.03 && t < 0.06) {
        // R-peak (ventricular depolarization)
        const tau = (t - 0.03) / 0.03;
        ecgVal = 0.95 * Math.sin(tau * Math.PI);
      } else if (t >= 0.06 && t < 0.09) {
        // S-wave
        const tau = (t - 0.06) / 0.03;
        ecgVal = -0.35 * Math.sin(tau * Math.PI);
      } else if (t >= 0.22 && t < 0.38) {
        // T-wave (ventricular repolarization)
        const tau = (t - 0.22) / 0.16;
        ecgVal = 0.35 * Math.sin(tau * Math.PI);
      }

      const ecgY = ecgY0 + ecgH * 0.5 - ecgVal * (ecgH * 0.45);
      if (i === 0) ctx.moveTo(x, ecgY);
      else ctx.lineTo(x, ecgY);
    }
    ctx.strokeStyle = "#8ee6c8";
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // 7. Draw Live Tracking Phase Cursor
    const cursorX = padding.left + currentPhase * chartW;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.moveTo(cursorX, pressY0 - 4);
    ctx.lineTo(cursorX, ecgY0 + ecgH + 4);
    ctx.stroke();
    ctx.setLineDash([]);

    // Live tracking dots on LV Pressure & ECG
    const currentPt = telemetryData.find((p) => Math.abs(p.t - currentPhase) < 0.015) || telemetryData[0];
    if (currentPt) {
      const dotPressY = pressY0 + pressH - (currentPt.lvPressure / maxP) * pressH;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cursorX, dotPressY, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#09090b";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 8. Bottom X-Axis Progression
    ctx.fillStyle = "#71717a";
    ctx.font = "9px JetBrains Mono, monospace";
    ctx.textAlign = "right";
    ctx.fillText("0% → 100%", padding.left + chartW, ecgY0 + ecgH + 15);
  }, [telemetryData, currentPhase, studyParams]);

  return (
    <div className="telemetry-chart-card">
      <div className="telemetry-chart-header">
        <span className="telemetry-title">Wiggers Hemodynamic Diagram</span>
        <span className="telemetry-badge-alt">Pressure &amp; ECG</span>
      </div>

      {/* Clean, Non-Overlapping Legend Row */}
      <div className="telemetry-legend-row">
        <div className="telemetry-legend-item">
          <span className="telemetry-legend-line" style={{ background: "#9bdcff" }} />
          <span>LV Press</span>
        </div>
        <div className="telemetry-legend-item">
          <span className="telemetry-legend-line" style={{ background: "#c8b6ff" }} />
          <span>Aorta</span>
        </div>
        <div className="telemetry-legend-item">
          <span className="telemetry-legend-line" style={{ background: "#fbbf24", borderTop: "1px dashed #fbbf24" }} />
          <span>LA</span>
        </div>
        <div className="telemetry-legend-item">
          <span className="telemetry-legend-line" style={{ background: "#8ee6c8" }} />
          <span>Lead II</span>
        </div>
      </div>

      <canvas ref={canvasRef} style={{ width: "100%", display: "block" }} />
    </div>
  );
}

