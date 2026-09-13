/**
 * Z-Anatomy node name -> CAIRO chamber ID.  Names are matched after normalisation
 * (see normaliseName in process.mjs): trailing ".001", ".l"/".r", and group/junction/text
 * suffixes ".g" ".j" ".t" are stripped and the result lower-cased.
 *
 * `stub: true` means the structure is a vessel leaving the heart: triangles farther than
 * STUB_RADIUS_FACTOR x heart radius from the heart centre are removed so only a short stub remains.
 */
export const CHAMBER_MAP = {
  // chambers
  "left ventricle": { id: "lv" },
  "right ventricle": { id: "rv" },
  "left atrium": { id: "la" },
  "right atrium": { id: "ra" },
  // papillary muscles
  "inferior papillary muscle of left ventricle": { id: "papillary_muscles" },
  "anterior papillary muscle of left ventricle": { id: "papillary_muscles" },
  "inferior papillary muscle of right ventricle": { id: "papillary_muscles" },
  "anterior papillary muscle of right ventricle": { id: "papillary_muscles" },
  "septal papillary muscle of right ventricle": { id: "papillary_muscles" },
  // valves
  "posterior leaflet of left atrioventricular valve": { id: "mitral_valve" },
  "anterior leaflet of left atrioventricular valve": { id: "mitral_valve" },
  "inferior leaflet of right atrioventricular valve": { id: "tricuspid_valve" },
  "septal leaflet of right atrioventricular valve": { id: "tricuspid_valve" },
  "anterior leaflet of right atrioventricular valve": { id: "tricuspid_valve" },
  "left coronary leaflet": { id: "aortic_valve" },
  "right coronary leaflet": { id: "aortic_valve" },
  "non-coronary leaflet": { id: "aortic_valve" },
  "anterior semilunar leaflet of pulmonary valve": { id: "pulmonary_valve" },
  "left semilunar leaflet of pulmonary valve": { id: "pulmonary_valve" },
  "right semilunar leaflet of pulmonary valve": { id: "pulmonary_valve" },
  // septa (present in Z-Anatomy full model, absent from the sample)
  "interventricular septum": { id: "septum" },
  "interatrial septum": { id: "septum" },
  // great vessels (stubs)
  "ascending aorta": { id: "aorta" },
  "aortic arch": { id: "aorta", stub: true },
  "root of aorta": { id: "aorta_sinus" },
  "brachiocephalic trunk": { id: "brachiocephalic", stub: true },
  "left common carotid artery": { id: "carotid", stub: true },
  "left subclavian artery": { id: "subclavian", stub: true },
  "pulmonary trunk": { id: "pulmonary_trunk" },
  "bifurcation of pulmonary trunk": { id: "pulmonary_trunk" },
  "left pulmonary artery": { id: "lpa", stub: true },
  "right pulmonary artery": { id: "rpa", stub: true },
  "superior vena cava": { id: "svc", stub: true },
  "inferior vena cava (thoracic part)": { id: "ivc", stub: true },
  "left superior pulmonary vein": { id: "pulmonary_veins", stub: true },
  "left inferior pulmonary vein": { id: "pulmonary_veins", stub: true },
  "right superior pulmonary vein": { id: "pulmonary_veins", stub: true },
  "right inferior pulmonary vein": { id: "pulmonary_veins", stub: true },
  // coronary arteries
  "left coronary artery": { id: "left_main" },
  "anterior interventricular artery": { id: "lad" },
  "septal branches of anterior interventricular artery": { id: "lad" },
  "circumflex artery of heart": { id: "lcx" },
  "right coronary artery": { id: "rca" },
  "right inferolateral branch of right coronary artery": { id: "rca_marginal" },
  // cardiac veins
  "great cardiac vein": { id: "gcv" },
  "coronary sinus": { id: "gcv" },
  "middle cardiac vein": { id: "gcv" },
  "inferior vein of left ventricle": { id: "gcv" },
  "inferior vein of left ventricle (//posterior '')": { id: "gcv" },
};

/** Chamber IDs the viewer's CARDIAC_NODES catalogue expects; reported if no node maps to them. */
export const EXPECTED_IDS = [
  "lv", "rv", "la", "laa", "ra", "raa", "aorta", "aorta_sinus", "brachiocephalic", "carotid", "subclavian",
  "pulmonary_trunk", "lpa", "rpa", "lad", "lad_d1", "lad_d2", "rca", "rca_marginal", "lcx", "gcv", "svc", "ivc",
  "pulmonary_veins", "mitral_valve", "aortic_valve", "papillary_muscles",
];

/** Explicitly dropped even though the name looks cardiac. */
export const DROP_NOTES = {
  "marginal artery": "colic (marginal artery of Drummond), not the acute marginal",
  "thoracic aorta": "beyond the arch",
  "abdominal aorta": "beyond the arch",
  "inferior vena cava (abdominal part)": "beyond the stub",
  "right common carotid artery": "beyond the brachiocephalic stub",
  "right subclavian artery": "beyond the brachiocephalic stub",
};
