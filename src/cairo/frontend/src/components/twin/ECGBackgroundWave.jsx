import React, { useEffect, useRef } from "react";

/**
 * Lead II Electrocardiogram (ECG) Real-Time Oscilloscope Waveform Background
 * Renders a synchronized P-QRS-T clinical telemetry strip in the background of the 3D viewport.
 */
export function ECGBackgroundWave({ currentPhase = 0, bpm = 70, isPlaying = true }) {
  const canvasRef = useRef(null);

  // High-fidelity Lead II ECG voltage model: P-wave, PR segment, QRS complex, ST segment, T-wave
  const getEcgVoltage = (t) => {
    const phase = ((t % 1) + 1) % 1;

    // 1. P-Wave (Atrial Depolarization): 0.08 -> 0.16
    if (phase >= 0.08 && phase < 0.16) {
      const p = (phase - 0.08) / 0.08;
      return 0.16 * Math.sin(Math.PI * p);
    }
    // 2. PR Segment: 0.16 -> 0.20 (Isoelectric)
    if (phase >= 0.16 && phase < 0.20) {
      return 0;
    }
    // 3. Q-Wave (Septal Depolarization): 0.20 -> 0.22
    if (phase >= 0.20 && phase < 0.22) {
      const q = (phase - 0.20) / 0.02;
      return -0.12 * Math.sin(Math.PI * q);
    }
    // 4. R-Wave (Ventricular Depolarization Spike): 0.22 -> 0.245
    if (phase >= 0.22 && phase < 0.245) {
      const r = (phase - 0.22) / 0.025;
      return 1.0 * Math.sin(Math.PI * r);
    }
    // 5. S-Wave (Late Ventricular Depolarization): 0.245 -> 0.27
    if (phase >= 0.245 && phase < 0.27) {
      const s = (phase - 0.245) / 0.025;
      return -0.28 * Math.sin(Math.PI * s);
    }
    // 6. ST Segment: 0.27 -> 0.38 (Isoelectric)
    if (phase >= 0.27 && phase < 0.38) {
      return 0;
    }
    // 7. T-Wave (Ventricular Repolarization): 0.38 -> 0.54
    if (phase >= 0.38 && phase < 0.54) {
      const tw = (phase - 0.38) / 0.16;
      return 0.32 * Math.sin(Math.PI * tw);
    }
    // 8. TP Interval: 0.54 -> 1.00 (Resting baseline)
    return 0;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId;
    const render = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, width, height);

      // 1. Render Subtle Clinical Telemetry Grid
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(142, 230, 200, 0.025)";
      const gridSize = 24;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Major grid divisions (every 5 blocks)
      ctx.strokeStyle = "rgba(142, 230, 200, 0.05)";
      for (let x = 0; x < width; x += gridSize * 5) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize * 5) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 2. Render Continuous Sweeping Lead II ECG Waveform
      const centerY = height * 0.52;
      const amplitude = Math.min(height * 0.38, 44);
      const cyclesAcrossScreen = 2.6;

      // Draw historical ECG tracing
      ctx.beginPath();
      const numPoints = Math.floor(width / 2);
      for (let i = 0; i < numPoints; i++) {
        const x = (i / numPoints) * width;
        // Map x position relative to current phase
        const wavePhase = (currentPhase + (i / numPoints) * cyclesAcrossScreen) % 1.0;
        const v = getEcgVoltage(wavePhase);
        const y = centerY - v * amplitude;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      // Outer phosphor glow
      ctx.strokeStyle = "rgba(142, 230, 200, 0.15)";
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Sharp primary trace line
      ctx.strokeStyle = "rgba(142, 230, 200, 0.45)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 3. Real-Time Sweep Head Marker
      const sweepX = (currentPhase * width * (1 / cyclesAcrossScreen)) % width;
      const currentV = getEcgVoltage(currentPhase);
      const currentY = centerY - currentV * amplitude;

      // Glowing sweep cursor
      ctx.beginPath();
      ctx.arc(sweepX, currentY, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#8ee6c8";
      ctx.shadowColor = "#8ee6c8";
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0; // reset

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [currentPhase, bpm]);

  return (
    <div className="ecg-background-wave-container">
      <canvas ref={canvasRef} className="ecg-background-canvas" />
      <div className="ecg-lead-annotation">
        <span className="ecg-lead-tag">LEAD II</span>
        <span className="ecg-spec-tag">25mm/s • 10mm/mV</span>
        <span className="ecg-sync-tag">HR {bpm} BPM</span>
      </div>
    </div>
  );
}
