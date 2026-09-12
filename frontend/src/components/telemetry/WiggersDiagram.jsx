import React, { useRef, useEffect } from "react";

/**
 * Wiggers Diagram: Synchronized Multichannel Hemodynamics & Electrophysiology
 * Displays LV/Aortic/LA Pressures, Volume, ECG Waveform, and Phase cursor.
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
    const height = 180;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 20, right: 30, bottom: 20, left: 42 };
    const chartW = width - padding.left - padding.right;

    // Top Channel: Pressures (0 to 140 mmHg)
    const pressH = 100;
    const pressY0 = padding.top;
    const maxP = 140;

    // Bottom Channel: ECG Waveform
    const ecgH = 45;
    const ecgY0 = pressY0 + pressH + 12;

    // Background & Phase Divisions
    ctx.fillStyle = "rgba(255, 45, 85, 0.05)";
    ctx.fillRect(padding.left, pressY0, 0.38 * chartW, pressH + ecgH + 12);

    ctx.fillStyle = "rgba(0, 240, 255, 0.03)";
    ctx.fillRect(padding.left + 0.38 * chartW, pressY0, 0.62 * chartW, pressH + ecgH + 12);

    // Pressure Grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 1;
    [0, 40, 80, 120].forEach((p) => {
      const y = pressY0 + pressH - (p / maxP) * pressH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.font = "9px Inter, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`${p}`, padding.left - 6, y + 3);
    });

    // 1. Draw Aortic Pressure Curve (Red)
    ctx.beginPath();
    telemetryData.forEach((pt, idx) => {
      const x = padding.left + pt.t * chartW;
      const y = pressY0 + pressH - (pt.aorticPressure / maxP) * pressH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#ff4d6d";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 2. Draw LV Pressure Curve (Cyan)
    ctx.beginPath();
    telemetryData.forEach((pt, idx) => {
      const x = padding.left + pt.t * chartW;
      const y = pressY0 + pressH - (pt.lvPressure / maxP) * pressH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 3. Draw LA Pressure Curve (Amber Dotted)
    ctx.beginPath();
    telemetryData.forEach((pt, idx) => {
      const x = padding.left + pt.t * chartW;
      const y = pressY0 + pressH - (pt.laPressure / maxP) * pressH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#ffea00";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 2]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Draw Synthetic Synchronized ECG Lead II
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
        ecgVal = 0.95 * Math.sin(((t - 0.03) / 0.03) * Math.PI);
      } else if (t >= 0.06 && t < 0.09) {
        // S-wave
        ecgVal = -0.35 * Math.sin(((t - 0.06) / 0.03) * Math.PI);
      } else if (t >= 0.22 && t < 0.38) {
        // T-wave (ventricular repolarization)
        const tau = (t - 0.22) / 0.16;
        ecgVal = 0.35 * Math.sin(tau * Math.PI);
      }

      const ecgY = ecgY0 + ecgH * 0.5 - ecgVal * (ecgH * 0.45);
      if (i === 0) ctx.moveTo(x, ecgY);
      else ctx.lineTo(x, ecgY);
    }
    ctx.strokeStyle = "#00e676"; // Emerald green ECG line
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // 5. Draw Live Tracking Phase Cursor
    const cursorX = padding.left + currentPhase * chartW;
    ctx.strokeStyle = "#ffea00";
    ctx.lineWidth = 1.8;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.moveTo(cursorX, pressY0 - 4);
    ctx.lineTo(cursorX, ecgY0 + ecgH + 4);
    ctx.stroke();
    ctx.setLineDash([]);

    // Channel Legends
    ctx.font = "9px Inter, sans-serif";
    ctx.fillStyle = "#00f0ff";
    ctx.fillText("■ LV Press", padding.left + 5, pressY0 + 12);

    ctx.fillStyle = "#ff4d6d";
    ctx.fillText("■ Aortic Press", padding.left + 75, pressY0 + 12);

    ctx.fillStyle = "#ffea00";
    ctx.fillText("■ LA Press", padding.left + 160, pressY0 + 12);

    ctx.fillStyle = "#00e676";
    ctx.fillText("■ ECG Lead II", padding.left + 5, ecgY0 + 10);
  }, [telemetryData, currentPhase, studyParams]);

  return (
    <div className="telemetry-chart-card">
      <div className="telemetry-chart-header">
        <span className="telemetry-title">Synchronized Wiggers Diagram (Pressure & ECG)</span>
        <span className="telemetry-badge-alt">Electromechanical Coupling</span>
      </div>
      <canvas ref={canvasRef} style={{ width: "100%", display: "block" }} />
    </div>
  );
}
