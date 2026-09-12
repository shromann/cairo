/**
 * PanEcho (Yale CarDS, JAMA 2025) task catalogue — the 40 heads the deployed model actually emits,
 * keyed by the exact task_name stored in `video_predictions`. Source: PanEcho repo content/tasks.md.
 * Reference ranges are ASE adult guideline values, shown for context only.
 */

export const PANECHO_CATEGORIES = {
  SYSTOLIC: "LV Systolic & Strain Function",
  DIASTOLIC: "LV Diastolic Function",
  CHAMBER: "Chamber Morphology & Dimensions",
  VALVULAR: "Valvular Heart Disease",
  RIGHT: "Right Heart & Pressures",
  STRUCTURAL: "Structural & Pericardial",
};

const C = PANECHO_CATEGORIES;
const R = (id, name, category, unit, normalRange, low, high) =>
  ({ id, name, category, type: "regression", unit, normalRange, low, high });
const B = (id, name, category, positive) => ({ id, name, category, type: "binary", positive });
const M = (id, name, category, normalClass) => ({ id, name, category, type: "multiclass", normalClass });

export const PANECHO_TASK_METADATA = [
  // --- LV systolic ---
  R("EF", "LV Ejection Fraction", C.SYSTOLIC, "%", "52 – 72 %", 52, 72),
  R("GLS", "Global Longitudinal Strain (magnitude)", C.SYSTOLIC, "%", "≥ 18 %", 18, 30),
  M("LVSystolicFunction", "LV Systolic Function", C.SYSTOLIC, "Normal|Hyperdynamic"),
  B("LVWallMotionAbnormalities", "LV Wall Motion Abnormalities", C.SYSTOLIC, "Present"),
  R("LVSV", "LV Stroke Volume", C.SYSTOLIC, "mL", "60 – 100 mL", 60, 100),
  // --- LV diastolic ---
  M("LVDiastolicFunction", "LV Diastolic Function", C.DIASTOLIC, "Normal"),
  R("E|EAvg", "E / e′ ratio", C.DIASTOLIC, "", "< 14", 0, 14),
  // --- chambers ---
  R("LVEDV", "LV End-Diastolic Volume", C.CHAMBER, "mL", "62 – 150 mL", 62, 150),
  R("LVESV", "LV End-Systolic Volume", C.CHAMBER, "mL", "21 – 61 mL", 21, 61),
  M("LVSize", "LV Size", C.CHAMBER, "Normal"),
  R("LVIDd", "LV Internal Diameter, diastole", C.CHAMBER, "cm", "3.9 – 5.3 cm", 3.9, 5.3),
  R("LVIDs", "LV Internal Diameter, systole", C.CHAMBER, "cm", "2.0 – 4.0 cm", 2.0, 4.0),
  R("IVSd", "Septal Thickness, diastole", C.CHAMBER, "cm", "0.6 – 1.0 cm", 0.6, 1.0),
  R("LVPWd", "Posterior Wall Thickness, diastole", C.CHAMBER, "cm", "0.6 – 1.0 cm", 0.6, 1.0),
  B("LVWallThickness-increased-any", "LV Hypertrophy (any)", C.CHAMBER, "Increased"),
  B("LVWallThickness-increased-modsev", "LV Hypertrophy (moderate / severe)", C.CHAMBER, "Moderately|severely increased"),
  R("LVOTDiam", "LVOT Diameter", C.CHAMBER, "cm", "1.8 – 2.4 cm", 1.8, 2.4),
  M("LASize", "Left Atrial Size", C.CHAMBER, "Normal"),
  R("LAVol", "Left Atrial Volume", C.CHAMBER, "mL", "22 – 52 mL", 22, 52),
  R("LAIDs2D", "LA Internal Diameter, systole", C.CHAMBER, "cm", "2.7 – 4.0 cm", 2.7, 4.0),
  B("RASize", "Right Atrial Dilation", C.CHAMBER, "Dilated"),
  R("RADimensionM-L(cm)", "RA Major Dimension", C.CHAMBER, "cm", "≤ 4.4 cm", 0, 4.4),
  M("RVSize", "Right Ventricular Size", C.CHAMBER, "Normal"),
  R("RVIDd", "RV Internal Diameter, diastole", C.CHAMBER, "cm", "≤ 4.1 cm", 0, 4.1),
  R("AORoot", "Aortic Root Diameter", C.CHAMBER, "cm", "2.0 – 3.7 cm", 2.0, 3.7),
  // --- valves ---
  M("AVStenosis", "Aortic Stenosis", C.VALVULAR, "None"),
  M("AVRegurg", "Aortic Regurgitation", C.VALVULAR, "None|Trace"),
  B("AVStructure", "Bicuspid Aortic Valve", C.VALVULAR, "Bicuspid"),
  R("AVPkVel(m|s)", "Aortic Valve Peak Velocity", C.VALVULAR, "m/s", "< 2.5 m/s", 0, 2.5),
  B("LVOT20mmHg", "LVOT Gradient ≥ 20 mmHg", C.VALVULAR, "Present"),
  B("MVStenosis", "Mitral Stenosis", C.VALVULAR, "Mild|Moderate|Severe"),
  M("MVRegurgitation", "Mitral Regurgitation", C.VALVULAR, "None|Trace"),
  M("TVRegurgitation", "Tricuspid Regurgitation", C.VALVULAR, "None|Trace"),
  R("TVPkGrad", "Tricuspid Peak Gradient", C.VALVULAR, "mmHg", "< 31 mmHg", 0, 31),
  // --- right heart / pressures ---
  B("RVSystolicFunction", "RV Systolic Dysfunction", C.RIGHT, "Decreased"),
  R("TAPSE", "TAPSE", C.RIGHT, "cm", "≥ 1.7 cm", 1.7, 3.0),
  R("RVSVel", "RV S′ Velocity", C.RIGHT, "cm/s", "≥ 9.5 cm/s", 9.5, 20),
  R("RVSP", "RV Systolic Pressure (est.)", C.RIGHT, "mmHg", "< 36 mmHg", 0, 36),
  B("RAP-8-or-higher", "Elevated RA Pressure (≥ 8 mmHg)", C.RIGHT, "Present"),
  // --- structural ---
  B("pericardial-effusion", "Pericardial Effusion", C.STRUCTURAL, "mild_mod_severe"),
];

export const PANECHO_TASK_COUNT = PANECHO_TASK_METADATA.length;

const SEVERE = /severe|akinetic|decreased|dilated|increased|bicuspid|present|stenosis|effusion/i;
const WARN = /mild|moderate|hypokinetic|borderline|indeterminate/i;

/**
 * Convert one backend prediction ({task_type, value, class_probs}) into the shape the drawer renders:
 * regression -> { value, unit, status }, classification -> { label, probability, status }.
 */
export function adaptPrediction(task, p) {
  if (!p) return null;
  if (task.type === "regression") {
    if (p.value == null) return null;
    const v = p.value;
    let status = "Within reference";
    if (task.low != null && v < task.low) status = "Below reference";
    if (task.high != null && v > task.high) status = "Above reference";
    return { value: +v.toFixed(2), unit: task.unit, status, nVideos: p.n_videos };
  }
  if (task.type === "binary") {
    const prob = p.value ?? (p.class_probs ? Object.values(p.class_probs)[0] : null);
    if (prob == null) return null;
    const positive = prob >= 0.5;
    return {
      label: positive ? task.positive : `Not ${task.positive.toLowerCase()}`,
      probability: positive ? prob : 1 - prob,
      status: positive ? task.positive : "Normal",
      severe: positive,
      nVideos: p.n_videos,
    };
  }
  // multiclass: argmax over class_probs
  if (!p.class_probs) return null;
  const [label, prob] = Object.entries(p.class_probs).sort((a, b) => b[1] - a[1])[0];
  return {
    label,
    probability: prob,
    status: label === task.normalClass ? "Normal" : label,
    severe: label !== task.normalClass && SEVERE.test(label) && !WARN.test(label),
    nVideos: p.n_videos,
  };
}

/** Map the API study detail into the `studyResults` object the dashboard already consumes. */
export function adaptStudy(detail) {
  const preds = detail?.predictions || {};
  const predictions = {};
  for (const task of PANECHO_TASK_METADATA) {
    const a = adaptPrediction(task, preds[task.id]);
    if (a) predictions[task.id] = a;
  }
  const ef = preds.EF?.value ?? detail?.ef ?? null;
  const edv = preds.LVEDV?.value ?? detail?.edv ?? null;
  const esv = preds.LVESV?.value ?? detail?.esv ?? null;
  // PanEcho reports GLS as a positive magnitude; clinical convention is negative.
  const gls = preds.GLS?.value != null ? -Math.abs(preds.GLS.value) : null;
  return {
    studyId: detail?.id,
    label: detail?.label,
    ef, edv, esv, gls,
    strokeVolume: edv != null && esv != null ? edv - esv : null,
    predictions,
    hasPredictions: Object.keys(predictions).length > 0,
    labels: detail?.labels || {},
    // PanEcho has no per-segment strain head; give the bullseye/heatmap a uniform map derived from GLS
    // so the 3D twin still animates. Flagged in the UI as derived, not measured.
    aha17Strains: uniformStrains(gls, preds.LVWallMotionAbnormalities?.value),
  };
}

const AHA_NAMES = ["Basal Anterior", "Basal Anteroseptal", "Basal Inferoseptal", "Basal Inferior", "Basal Inferolateral",
  "Basal Anterolateral", "Mid Anterior", "Mid Anteroseptal", "Mid Inferoseptal", "Mid Inferior", "Mid Inferolateral",
  "Mid Anterolateral", "Apical Anterior", "Apical Septal", "Apical Inferior", "Apical Lateral", "Apex"];

function uniformStrains(gls, wmaProb) {
  const s = gls ?? -18.5;
  const wm = (wmaProb ?? 0) >= 0.5 ? "Hypokinetic" : "Normokinetic";
  return AHA_NAMES.map((name, i) => ({ segment: i + 1, name, strain: +s.toFixed(1), wallMotion: wm, derived: true }));
}
