import React, { useRef, useEffect } from "react";

/**
 * Wiggers Diagram: Synchronized Multichannel Hemodynamics & Electrophysiology (Instatic Palette)
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

    const padding = { top: 20, right: 30, bottom: 20, left: 38 };
    const chartW = width - padding.left - padding.right;

    // Top Channel: Pressures (0 to 140 mmHg)
    const pressH = 100;
    const pressY0 = padding.top;
    const maxP = 140;

    // Bottom Channel: ECG Waveform
    const ecgH = 45;
    const ecgY0 = pressY0 + pressH + 12;

    // Background & Phase Divisions
    ctx.fillStyle = "rgba(248, 113, 113, 0.04)";
    ctx.fillRect(padding.left, pressY0, 0.38 * chartW, pressH + ecgH + 12);

    ctx.fillStyle = "rgba(155, 220, 255, 0.02)";
    ctx.fillRect(padding.left + 0.38 * chartW, pressY0, 0.62 * chartW, pressH + ecgH + 12);

    // Pressure Grid lines
    ctx.strokeStyle = "#27272a";
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

    // 1. Draw Aortic Pressure Curve (Lavender)
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

    // 2. Draw LV Pressure Curve (Sky Blue)
    ctx.beginPath();
    telemetryData.forEach((pt, idx) => {
      const x = padding.left + pt.t * chartW;
      const y = pressY0 + pressH - (pt.lvPressure / maxP) * pressH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#9bdcff";
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // 3. Draw LA Pressure Curve (Amber Dotted)
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

    // 4. Draw Synthetic Synchronized ECG Lead II (Mint Green)
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
    ctx.strokeStyle = "#8ee6c8";
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // 5. Draw Live Tracking Phase Cursor
    const cursorX = padding.left + currentPhase * chartW;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.moveTo(cursorX, pressY0 - 4);
    ctx.lineTo(cursorX, ecgY0 + ecgH + 4);
    ctx.stroke();
    ctx.setLineDash([]);

    // Channel Legends
    ctx.font = "9px Inter, sans-serif";
    ctx.fillStyle = "#9bdcff";
    ctx.fillText("■ LV Press", padding.left + 4, pressY0 + 10);

    ctx.fillStyle = "#c8b6ff";
    ctx.fillText("■ Aortic", padding.left + 68, pressY0 + 10);

    ctx.fillStyle = "#fbbf24";
    ctx.fillText("■ LA", padding.left + 120, pressY0 + 10);

    ctx.fillStyle = "#8ee6c8";
    ctx.fillText("■ ECG Lead II", padding.left + 4, ecgY0 + 10);
  }, [telemetryData, currentPhase, studyParams]);

  return (
    <div className="telemetry-chart-card">
      <div className="telemetry-chart-header">
        <span className="telemetry-title">Synchronized Wiggers Diagram (Pressure &amp; ECG)</span>
        <span className="telemetry-badge-alt">Multichannel</span>
      </div>
      <canvas ref={canvasRef} style={{ width: "100%", display: "block" }} />
    </div>
  );
}
