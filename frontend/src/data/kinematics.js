/**
 * Biomechanical & Hemodynamic Kinematics Engine
 * Computes time-varying volume curves, wall thickening via incompressibility,
 * longitudinal strain shortening, wringing apex torsion, and valve apertures.
 */

/**
 * Cardiac Cycle Kinematic State at phase t in [0, 1]
 * Phase breakdown:
 * - 0.00 to 0.08: End-Diastole & Isovolumetric Contraction (IVC)
 * - 0.08 to 0.38: Ventricular Systole / Rapid Ejection
 * - 0.38 to 0.46: Isovolumetric Relaxation (IVR)
 * - 0.46 to 0.75: Rapid Early Diastolic Filling (E-wave)
 * - 0.75 to 0.88: Diastasis (Reduced Filling)
 * - 0.88 to 1.00: Atrial Kick / Late Filling (A-wave)
 */
export function getCardiacKinematics(phase, studyParams = {}) {
  // Normalize phase to [0, 1)
  const t = ((phase % 1) + 1) % 1;

  const ef = studyParams.ef ?? 55.0;       // Ejection Fraction %
  const edv = studyParams.edv ?? 100.0;    // End-Diastolic Volume mL
  const esv = studyParams.esv ?? 45.0;     // End-Systolic Volume mL
  const gls = studyParams.gls ?? -18.5;    // Global Longitudinal Strain %
  const heartRate = studyParams.heartRate ?? 70; // bpm

  // 1. Contraction Fraction f_systole in [0, 1] (0 = fully relaxed at ED, 1 = peak contraction at ES)
  let f_contraction = 0;
  let phaseName = "Diastole";
  let mitralOpen = 0;
  let aorticOpen = 0;
  let lvPressure = 8; // mmHg
  let aorticPressure = 80; // mmHg
  let laPressure = 6; // mmHg

  if (t < 0.08) {
    // Isovolumetric Contraction (IVC)
    const tau = t / 0.08;
    f_contraction = 0.05 * Math.sin(tau * Math.PI * 0.5);
    phaseName = "Isovolumetric Contraction";
    mitralOpen = Math.max(0, 1 - tau * 4);
    aorticOpen = 0;
    lvPressure = 8 + (80 - 8) * tau;
    aorticPressure = 80 - 2 * tau;
    laPressure = 8;
  } else if (t < 0.38) {
    // Systolic Ejection (Rapid -> Reduced)
    const tau = (t - 0.08) / 0.30;
    // Asymmetric smooth sinusoidal ejection curve
    f_contraction = Math.sin(tau * Math.PI * 0.5);
    phaseName = tau < 0.5 ? "Rapid Ejection" : "Reduced Ejection";
    mitralOpen = 0;
    aorticOpen = Math.sin(tau * Math.PI);
    lvPressure = 80 + 40 * Math.sin(tau * Math.PI) - 5 * tau;
    aorticPressure = lvPressure - 3;
    laPressure = 7 + 4 * tau;
  } else if (t < 0.46) {
    // Isovolumetric Relaxation (IVR)
    const tau = (t - 0.38) / 0.08;
    f_contraction = 1.0 - 0.15 * tau;
    phaseName = "Isovolumetric Relaxation";
    mitralOpen = 0;
    aorticOpen = 0;
    lvPressure = 80 * (1 - tau) + 12 * tau;
    aorticPressure = 85 - 10 * tau;
    laPressure = 12;
  } else if (t < 0.75) {
    // Rapid Early Diastolic Filling (E-wave)
    const tau = (t - 0.46) / 0.29;
    f_contraction = 0.85 * (1 - Math.sin(tau * Math.PI * 0.5));
    phaseName = "Rapid Early Filling (E-wave)";
    mitralOpen = Math.sin(tau * Math.PI * 0.8 + 0.2);
    aorticOpen = 0;
    lvPressure = 6 + 4 * (1 - tau);
    aorticPressure = 75 - 5 * tau;
    laPressure = 10 - 3 * tau;
  } else if (t < 0.88) {
    // Diastasis
    const tau = (t - 0.75) / 0.13;
    f_contraction = 0.15 * (1 - tau);
    phaseName = "Diastasis";
    mitralOpen = 0.25;
    aorticOpen = 0;
    lvPressure = 8 + 2 * tau;
    aorticPressure = 70 - 2 * tau;
    laPressure = 8;
  } else {
    // Atrial Kick (A-wave)
    const tau = (t - 0.88) / 0.12;
    f_contraction = 0.05 * Math.sin(tau * Math.PI);
    phaseName = "Atrial Contraction (A-wave)";
    mitralOpen = 0.25 + 0.6 * Math.sin(tau * Math.PI);
    aorticOpen = 0;
    lvPressure = 10 + 4 * Math.sin(tau * Math.PI);
    aorticPressure = 68;
    laPressure = 14 * Math.sin(tau * Math.PI);
  }

  // 2. Instantaneous Chamber Volume V(t) in mL
  const currentVolume = edv - (edv - esv) * f_contraction;

  // 3. Radial cavity contraction scale factor (relative to ED)
  // V is proportional to r^2 * L. With proportional scaling, r ~ (V / V_ed)^(1/3)
  const volRatio = Math.max(0.2, currentVolume / edv);
  const radialScale = Math.pow(volRatio, 0.45); // Cavity radius scale

  // 4. Incompressible Myocardium Wall Thickness (thickens as cavity shrinks)
  // h(t) = h_0 * (1 / radialScale)^0.7
  const wallThickeningFactor = 1.0 + (1.0 - radialScale) * 0.75;

  // 5. Longitudinal Shortening (Apex to Base displacement)
  // Shortening magnitude is driven by Global Longitudinal Strain (GLS)
  const maxShorteningFraction = Math.abs(gls) / 100.0; // e.g. 0.18 for -18% GLS
  const longitudinalShortening = 1.0 - maxShorteningFraction * f_contraction;

  // 6. Apex-to-Base Wringing Torsion (counter-clockwise apex, clockwise base)
  const maxApexTorsionDeg = 12.0 * (ef / 60.0); // deg
  const currentApexTorsionRad = (maxApexTorsionDeg * f_contraction * Math.PI) / 180.0;

  // 7. Instantaneous Myocardial Strain (negative during systole)
  const currentStrain = gls * f_contraction;

  return {
    phase: t,
    phaseName,
    f_contraction,
    currentVolume,
    radialScale,
    wallThickeningFactor,
    longitudinalShortening,
    currentApexTorsionRad,
    currentStrain,
    mitralOpen: Math.max(0, Math.min(1, mitralOpen)),
    aorticOpen: Math.max(0, Math.min(1, aorticOpen)),
    lvPressure,
    aorticPressure,
    laPressure
  };
}

/**
 * Generate full Wiggers Diagram telemetry curve points for Canvas charting
 */
export function generateWiggersTelemetry(studyParams, numPoints = 100) {
  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const k = getCardiacKinematics(t, studyParams);
    points.push({
      t,
      volume: k.currentVolume,
      lvPressure: k.lvPressure,
      aorticPressure: k.aorticPressure,
      laPressure: k.laPressure,
      strain: k.currentStrain,
      mitralOpen: k.mitralOpen,
      aorticOpen: k.aorticOpen,
      phaseName: k.phaseName
    });
  }
  return points;
}

/**
 * Maps AHA 17-segment strain value (% strain) to Hex / RGB Color
 * Normal (< -18%): Vibrant Emerald / Cyan
 * Borderline (-14% to -18%): Yellow / Amber
 * Severely reduced / Akinesia (> -10%): Crimson / Red
 */
export function getStrainColor(strainVal) {
  // strainVal is negative (e.g. -22% normal, -8% akinetic)
  const s = typeof strainVal === "number" ? strainVal : -18;
  if (s <= -19) {
    return "#00f0ff"; // Vibrant Cyan
  } else if (s <= -16) {
    return "#00e676"; // Emerald Green
  } else if (s <= -12) {
    return "#ffea00"; // Golden Amber
  } else if (s <= -8) {
    return "#ff9100"; // Orange
  } else {
    return "#ff1744"; // Severe Crimson Red
  }
}
