/**
 * Anatomical Node Metadata Catalog
 * Provides clinical and functional descriptions for all interactive 3D cardiac components
 */

export const CARDIAC_NODES = {
  lv: {
    id: "lv",
    name: "Left Ventricle (LV)",
    category: "Ventricular Chamber",
    role: "Systemic Pumping Chamber",
    pressure: "120 / 8 mmHg (Systolic / End-Diastolic)",
    description:
      "Primary thick-walled muscular chamber that generates high systolic pressure to pump oxygenated blood into systemic circulation via the aorta.",
    clinicalNotes:
      "Assessed clinically via Ejection Fraction (EF, normal 55–70%), Global Longitudinal Strain (GLS), and End-Diastolic/Systolic Volumes (EDV/ESV)."
  },
  rv: {
    id: "rv",
    name: "Right Ventricle (RV)",
    category: "Ventricular Chamber",
    role: "Pulmonary Pumping Chamber",
    pressure: "25 / 4 mmHg (Systolic / End-Diastolic)",
    description:
      "Thin-walled crescent-shaped chamber that pumps deoxygenated venous return through the pulmonary valve into the low-resistance pulmonary circulation.",
    clinicalNotes:
      "Includes the inflow body and the smooth-walled Infundibulum (Conus Arteriosus) outflow tract leading to the pulmonic valve."
  },
  la: {
    id: "la",
    name: "Left Atrium (LA)",
    category: "Atrial Chamber",
    role: "Pulmonary Venous Reservoir",
    pressure: "6–12 mmHg",
    description:
      "Posterior heart chamber that receives oxygen-rich blood from the four pulmonary veins and delivers it to the left ventricle during diastole.",
    clinicalNotes:
      "Dilates in response to chronic mitral regurgitation, diastolic dysfunction, or elevated LV filling pressures."
  },
  laa: {
    id: "laa",
    name: "Left Atrial Appendage (LAA / Auricle)",
    category: "Atrial Structure",
    role: "Endocrine & Decompression Pouch",
    description:
      "Curved, muscular finger-like pouch extending from the left atrium over the proximal circumflex artery.",
    clinicalNotes:
      "Primary site (>90%) of intracardiac thrombus formation in non-valvular atrial fibrillation; target for surgical or percutaneous closure (Watchman)."
  },
  ra: {
    id: "ra",
    name: "Right Atrium (RA)",
    category: "Atrial Chamber",
    role: "Systemic Venous Reservoir",
    pressure: "2–6 mmHg",
    description:
      "Chamber located on the right superior border of the heart that collects deoxygenated blood from the Superior Vena Cava (SVC), Inferior Vena Cava (IVC), and Coronary Sinus.",
    clinicalNotes:
      "Contains the Sinoatrial (SA) node pacemaker in its high posterior wall near the SVC junction."
  },
  raa: {
    id: "raa",
    name: "Right Atrial Appendage (RAA / Auricle)",
    category: "Atrial Structure",
    role: "Muscular Auricular Pouch",
    description:
      "Triangular, pectinate-rich pouch projecting anteriorly and medially, overlapping the right anterior aspect of the ascending aorta.",
    clinicalNotes:
      "Rich in pectinate muscles; helps decompress the right atrium during rapid volume loading."
  },
  aorta: {
    id: "aorta",
    name: "Ascending Aorta & Arch",
    category: "Great Artery",
    role: "Primary Systemic Conduit",
    pressure: "120 / 80 mmHg",
    description:
      "Largest systemic elastic artery arising from the left ventricle, arching superiorly and posteriorly to distribute pulsatile arterial flow to the systemic circulation.",
    clinicalNotes:
      "Windkessel compliance dampens systolic pressure spikes and maintains diastolic coronary perfusion pressure."
  },
  aorta_sinus: {
    id: "aorta_sinus",
    name: "Sinuses of Valsalva (Aortic Root)",
    category: "Great Artery Root",
    role: "Aortic Root Reservoir & Coronary Takeoff",
    description:
      "Tri-lobed anatomical bulges at the base of the ascending aorta corresponding to the Left, Right, and Non-Coronary aortic valve cusps.",
    clinicalNotes:
      "Houses the ostia for the Left Main and Right Coronary Arteries. Prevents aortic valve leaflets from occluding coronary ostia during peak systole."
  },
  brachiocephalic: {
    id: "brachiocephalic",
    name: "Brachiocephalic Artery (Innominate)",
    category: "Supra-Aortic Trunk",
    role: "Head, Neck & Right Arm Supply",
    description:
      "First and largest branch of the aortic arch, which bifurcates into the Right Subclavian and Right Common Carotid arteries."
  },
  carotid: {
    id: "carotid",
    name: "Left Common Carotid Artery",
    category: "Supra-Aortic Trunk",
    role: "Cerebral & Left Head Perfusion",
    description:
      "Second branch of the aortic arch, ascending into the left neck to supply arterial blood to the left hemisphere of the brain, face, and neck."
  },
  subclavian: {
    id: "subclavian",
    name: "Left Subclavian Artery",
    category: "Supra-Aortic Trunk",
    role: "Left Upper Extremity Supply",
    description:
      "Third branch of the aortic arch, supplying oxygenated blood to the left arm and sending branches (vertebral artery) to the posterior brainstem."
  },
  pulmonary_trunk: {
    id: "pulmonary_trunk",
    name: "Pulmonary Trunk & Outflow",
    category: "Great Artery",
    role: "Pulmonary Arterial Conduit",
    pressure: "25 / 10 mmHg",
    description:
      "Arises from the Right Ventricular Outflow Tract (Infundibulum), crosses anterior to the ascending aorta, and bifurcates into the Left and Right Pulmonary Arteries.",
    clinicalNotes:
      "Evaluated for pulmonary hypertension via Doppler flow velocity profiles and acceleration times."
  },
  lpa: {
    id: "lpa",
    name: "Left Pulmonary Artery (LPA)",
    category: "Pulmonary Artery Branch",
    role: "Left Lung Perfusion",
    description:
      "Shorter and smaller branch arching leftward beneath the aortic arch and anterior to the descending aorta into the hilum of the left lung."
  },
  rpa: {
    id: "rpa",
    name: "Right Pulmonary Artery (RPA)",
    category: "Pulmonary Artery Branch",
    role: "Right Lung Perfusion",
    description:
      "Longer branch coursing horizontally behind the ascending aorta and Superior Vena Cava (SVC) into the hilum of the right lung."
  },
  lad: {
    id: "lad",
    name: "Left Anterior Descending (LAD) Artery",
    category: "Coronary Circulation",
    role: "Anterior LV & Septal Perfusion",
    description:
      "Courses down the anterior interventricular sulcus to the apex. Supplies the anterior 2/3 of the interventricular septum, anterior LV wall, and apical vortex.",
    clinicalNotes:
      "Crucial coronary vessel often called the 'widow maker' when occluded proximally. Corresponds to AHA segments 1, 2, 7, 8, 13, 14, and 17."
  },
  lad_d1: {
    id: "lad_d1",
    name: "First Diagonal Branch (D1)",
    category: "Coronary Circulation",
    role: "Anterolateral LV Perfusion",
    description:
      "Major lateral branch of the LAD supplying the basal-to-mid anterolateral free wall of the left ventricle."
  },
  lad_d2: {
    id: "lad_d2",
    name: "Second Diagonal Branch (D2)",
    category: "Coronary Circulation",
    role: "Mid-to-Apical Lateral Perfusion",
    description:
      "Distal diagonal branch off the LAD supplying the mid and apical lateral LV myocardium."
  },
  rca: {
    id: "rca",
    name: "Right Coronary Artery (RCA)",
    category: "Coronary Circulation",
    role: "RV, RA, Inferior Wall & Nodal Perfusion",
    description:
      "Originates from the right aortic sinus and courses through the right atrioventricular groove. Supplies the right ventricle, right atrium, SA node (60%), AV node (90%), and inferior LV wall.",
    clinicalNotes:
      "Occlusion causes inferior myocardial infarction and high-grade AV heart block."
  },
  rca_marginal: {
    id: "rca_marginal",
    name: "Acute Marginal Artery",
    category: "Coronary Circulation",
    role: "Right Ventricle Free Wall Perfusion",
    description:
      "Branches off the RCA along the acute margin (margo acutus) of the heart to provide arterial perfusion to the anterior and lateral RV wall."
  },
  lcx: {
    id: "lcx",
    name: "Left Circumflex (LCx) Artery",
    category: "Coronary Circulation",
    role: "Lateral & Posterior LV Perfusion",
    description:
      "Originates from the Left Main bifurcation and curves around the left atrioventricular groove. Supplies the lateral and inferolateral walls of the left ventricle.",
    clinicalNotes:
      "Corresponds to AHA segments 5, 6, 11, 12, and 16."
  },
  gcv: {
    id: "gcv",
    name: "Great Cardiac Vein & Coronary Sinus",
    category: "Cardiac Venous System",
    role: "Myocardial Venous Drainage",
    description:
      "Ascends the anterior interventricular sulcus alongside the LAD, then wraps into the left AV groove to form the Coronary Sinus, draining deoxygenated blood into the right atrium."
  },
  svc: {
    id: "svc",
    name: "Superior Vena Cava (SVC)",
    category: "Systemic Vein",
    role: "Upper Body Venous Return",
    description:
      "Large systemic vein that carries deoxygenated blood from the head, neck, upper extremities, and chest back to the right atrium."
  },
  ivc: {
    id: "ivc",
    name: "Inferior Vena Cava (IVC)",
    category: "Systemic Vein",
    role: "Lower Body Venous Return",
    description:
      "Large systemic vein that carries deoxygenated blood from the lower extremities, abdomen, and pelvis into the posteroinferior right atrium.",
    clinicalNotes:
      "IVC diameter and inspiratory collapsibility on ultrasound are used to estimate Central Venous Pressure (CVP) and right atrial pressure."
  },
  pulmonary_veins: {
    id: "pulmonary_veins",
    name: "Pulmonary Veins (4 Ostia)",
    category: "Pulmonary Venous System",
    role: "Oxygenated Blood Inlets",
    description:
      "Four vessels (Left Superior, Left Inferior, Right Superior, Right Inferior) that return oxygen-rich blood from both lungs directly into the left atrium."
  },
  mitral_valve: {
    id: "mitral_valve",
    name: "Mitral Valve (Bicuspid)",
    category: "Atrioventricular Valve",
    role: "LV Inflow Control",
    description:
      "Bicuspid valve composed of Anterior and Posterior leaflets supported by a fibrous annulus, chordae tendineae, and papillary muscles.",
    clinicalNotes:
      "Opens in diastole (E-wave and A-wave) and seals tight during systole to prevent regurgitation into the left atrium."
  },
  aortic_valve: {
    id: "aortic_valve",
    name: "Aortic Valve (Semilunar)",
    category: "Semilunar Outflow Valve",
    role: "LV Outflow Gating",
    description:
      "Tricuspid semilunar valve (Left, Right, and Non-Coronary cusps) located between the left ventricle and the ascending aorta.",
    clinicalNotes:
      "Opens during rapid systolic ejection (aortic pressure > 80 mmHg) and snaps shut at aortic valve closure (S2 heart sound, dicrotic notch)."
  },
  papillary_muscles: {
    id: "papillary_muscles",
    name: "Papillary Muscles & Chordae Tendineae",
    category: "Internal Valvular Support",
    role: "Leaflet Coaptation Tension",
    description:
      "Anterolateral and Posteromedial muscular pillars arising from the LV cavity wall. Tethered via fibrous chordae tendineae to the free margins of the mitral valve leaflets.",
    clinicalNotes:
      "Tension during systole prevents the mitral leaflets from prolapsing or inverting backward into the left atrium under high LV systolic pressures."
  }
};
