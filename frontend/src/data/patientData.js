/**
 * Patient & Clinical Study Metadata Registry
 * Maps cohort and backend study IDs to patient records, clinical histories, and risk levels.
 */

export const DEMO_PATIENTS = [
  {
    id: "PT-84920",
    mrn: "MRN-0048291",
    name: "Eleanor Vance",
    age: 68,
    sex: "Female",
    dob: "1958-04-12",
    avatar: "EV",
    primaryDiagnosis: "Ischemic Cardiomyopathy (HFrEF)",
    riskLevel: "critical", // "critical" | "warning" | "stable"
    room: "Cardio-ICU Bed 4",
    attending: "Dr. Sarah Chen, MD",
    assignedStudent: "Alex Rivera (MS4 Clinical Sub-I)",
    assignedResident: "Dr. Maya Lin, MD (Cardiology Fellow)",
    recentVitals: { bp: "108/68", hr: "72 bpm", spo2: "96%", bnp: "1,240 pg/mL" },
    clinicalSummary:
      "68-year-old female post-anterior STEMI. Echocardiogram ordered for acute dyspnea on minimal exertion. Severely reduced LVEF with anterior/apical akinesis and elevated filling pressures.",
    studies: [
      {
        id: "0X2D1CE5FC57B6FBC1",
        date: "2026-09-12",
        modality: "TTE 2D + Doppler + Strain",
        indication: "Post-Infarct LV Function & Wall Motion",
        ef: 26.7,
        edv: 149.8,
        esv: 109.8,
        gls: -11.2,
        status: "scored",
        severity: "Severe LV Dysfunction",
        hasVideo: true
      },
      {
        id: "0X2D1CE5FC57B6FBC1-PRIOR",
        date: "2025-11-04",
        modality: "TTE Baseline",
        indication: "Initial CAD Evaluation",
        ef: 42.0,
        edv: 124.0,
        esv: 71.9,
        gls: -14.5,
        status: "archived",
        severity: "Moderate Impairment",
        hasVideo: false
      }
    ]
  },
  {
    id: "PT-73019",
    mrn: "MRN-0073019",
    name: "Marcus Brody",
    age: 74,
    sex: "Male",
    dob: "1952-08-23",
    avatar: "MB",
    primaryDiagnosis: "Severe Degenerative Aortic Stenosis",
    riskLevel: "critical",
    room: "Telemetry Ward 3B",
    attending: "Dr. Sarah Chen, MD",
    assignedStudent: "Emma Watson (MS3 Core Clerk)",
    assignedResident: "Dr. James Wilson, MD (Internal Medicine PGY-2)",
    recentVitals: { bp: "138/82", hr: "68 bpm", spo2: "98%", bnp: "680 pg/mL" },
    clinicalSummary:
      "74-year-old male with progressive exertional syncope and systolic murmur. Pre-TAVR anatomical workup and ventricular hypertrophy assessment.",
    studies: [
      {
        id: "0X1028E75995DC711E",
        date: "2026-09-10",
        modality: "TTE 2D + Color Doppler",
        indication: "Pre-TAVR Aortic Valve Sizing & LV Function",
        ef: 52.3,
        edv: 112.0,
        esv: 53.4,
        gls: -16.0,
        status: "scored",
        severity: "Severe AS (AVA 0.7cm²)",
        hasVideo: true
      }
    ]
  },
  {
    id: "PT-91823",
    mrn: "MRN-0091823",
    name: "David Kim",
    age: 58,
    sex: "Male",
    dob: "1968-01-15",
    avatar: "DK",
    primaryDiagnosis: "Mild Systolic Impairment (HFmrEF)",
    riskLevel: "warning",
    room: "Outpatient Cardiology",
    attending: "Dr. Sarah Chen, MD",
    assignedStudent: "Lucas Chang (MS4 Cardiology Sub-I)",
    assignedResident: "Dr. Anika Gupta, MD (Cardiology Fellow)",
    recentVitals: { bp: "124/76", hr: "64 bpm", spo2: "99%", bnp: "290 pg/mL" },
    clinicalSummary:
      "58-year-old male with hypertension on guideline-directed medical therapy. Routine 6-month surveillance echocardiogram to monitor ejection fraction recovery.",
    studies: [
      {
        id: "0X101026B90DAE7E95",
        date: "2026-09-08",
        modality: "TTE 2D + Doppler",
        indication: "GDMT Optimization Follow-up",
        ef: 46.8,
        edv: 93.2,
        esv: 49.6,
        gls: -16.8,
        status: "scored",
        severity: "Mid-Range EF (HFmrEF)",
        hasVideo: true
      }
    ]
  },
  {
    id: "PT-48201",
    mrn: "MRN-0048201",
    name: "Sophia Patel",
    age: 49,
    sex: "Female",
    dob: "1977-11-30",
    avatar: "SP",
    primaryDiagnosis: "Normal Preserved Cardiac Function",
    riskLevel: "stable",
    room: "Pre-Operative Clinic",
    attending: "Dr. Sarah Chen, MD",
    assignedStudent: "Chloe Zhang (MS3 Clerk)",
    assignedResident: "Dr. Marcus Reed, MD (Cardiology Fellow)",
    recentVitals: { bp: "116/72", hr: "62 bpm", spo2: "100%", bnp: "42 pg/mL" },
    clinicalSummary:
      "49-year-old female undergoing pre-operative cardiac clearance prior to elective orthopedic surgery. No personal or family history of heart disease.",
    studies: [
      {
        id: "0X1002E8FBACD08477",
        date: "2026-09-05",
        modality: "TTE Comprehensive 2D",
        indication: "Pre-Operative Risk Stratification",
        ef: 59.1,
        edv: 98.7,
        esv: 40.4,
        gls: -21.4,
        status: "scored",
        severity: "Normal Echo (Clearance Approved)",
        hasVideo: true
      }
    ]
  },
  {
    id: "PT-61944",
    mrn: "MRN-0061944",
    name: "Arthur Pendelton",
    age: 63,
    sex: "Male",
    dob: "1963-06-19",
    avatar: "AP",
    primaryDiagnosis: "Non-Ischemic Dilated Cardiomyopathy",
    riskLevel: "critical",
    room: "Cardiology Step-down 2A",
    attending: "Dr. Sarah Chen, MD",
    assignedStudent: "Zachary Miller (MS4 Sub-I)",
    assignedResident: "Dr. Elena Rostov, MD (Heart Failure Fellow)",
    recentVitals: { bp: "102/64", hr: "84 bpm", spo2: "95%", bnp: "1,850 pg/mL" },
    clinicalSummary:
      "63-year-old male with progressive biventricular dilation, 4-chamber enlargement, and moderate functional mitral regurgitation. Being evaluated for CRT-D device therapy.",
    studies: [
      {
        id: "0X103E5C8D0662D85D",
        date: "2026-09-02",
        modality: "TTE 2D + Strain + 3D",
        indication: "CRT-D Candidacy Assessment",
        ef: 31.2,
        edv: 178.4,
        esv: 122.7,
        gls: -10.8,
        status: "scored",
        severity: "Severe Dilation (LVEDD 6.8cm)",
        hasVideo: true
      }
    ]
  },
  {
    id: "PT-55210",
    mrn: "MRN-0055210",
    name: "Clara Schumann",
    age: 52,
    sex: "Female",
    dob: "1974-03-08",
    avatar: "CS",
    primaryDiagnosis: "Hypertrophic Cardiomyopathy (Asymmetric Septal)",
    riskLevel: "warning",
    room: "Outpatient Specialized Center",
    attending: "Dr. Sarah Chen, MD",
    assignedStudent: "Hannah Lee (MS3 Clerk)",
    assignedResident: "Dr. Maya Lin, MD (Cardiology Fellow)",
    recentVitals: { bp: "128/80", hr: "58 bpm", spo2: "99%", bnp: "410 pg/mL" },
    clinicalSummary:
      "52-year-old female with asymmetrical septal hypertrophy (IVSd 2.1cm) and dynamic LVOT obstruction. Monitoring response to mavacamten therapy.",
    studies: [
      {
        id: "0X102E245EB1864119",
        date: "2026-08-28",
        modality: "TTE 2D + CW Doppler LVOT",
        indication: "Mavacamten Therapy Surveillance",
        ef: 68.4,
        edv: 84.5,
        esv: 26.7,
        gls: -17.2,
        status: "scored",
        severity: "Hyperdynamic (LVOT Grad 34mmHg)",
        hasVideo: true
      }
    ]
  }
];

/**
 * Given a cohort list from the API, marries backend studies with patient demographic records.
 */
export function matchPatientForStudy(studyId, cohort = []) {
  if (!studyId) return null;
  // 1. Direct match in static registry
  for (const p of DEMO_PATIENTS) {
    if (p.studies.some((s) => s.id === studyId)) {
      return p;
    }
  }

  // 2. Synthesize a clean patient profile for any unmapped backend study
  const backendStudy = cohort.find((c) => c.id === studyId);
  const hash = Array.from(studyId).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const fakeNames = ["James Thornton", "Helen Keller", "Robert Zhao", "Grace Hopper", "Alan Turing"];
  const name = fakeNames[hash % fakeNames.length];
  const age = 45 + (hash % 38);
  const ef = backendStudy?.ef ? Math.round(backendStudy.ef * 10) / 10 : 55;

  return {
    id: `PT-${studyId.slice(-5)}`,
    mrn: `MRN-${studyId.slice(2, 9)}`,
    name,
    age,
    sex: hash % 2 === 0 ? "Male" : "Female",
    dob: `19${80 - (hash % 40)}-06-15`,
    avatar: name.split(" ").map((n) => n[0]).join(""),
    primaryDiagnosis: ef < 40 ? "Systolic Heart Failure (HFrEF)" : ef < 50 ? "Mild LV Dysfunction" : "Preserved LVEF",
    riskLevel: ef < 35 ? "critical" : ef < 50 ? "warning" : "stable",
    room: "Cardiology Service",
    attending: "Dr. Sarah Chen, MD",
    recentVitals: { bp: "120/78", hr: "70 bpm", spo2: "98%", bnp: "180 pg/mL" },
    clinicalSummary: `Patient presenting for comprehensive echocardiogram assessment (Study ${studyId}).`,
    studies: [
      {
        id: studyId,
        date: "2026-09-13",
        modality: "TTE 2D + Doppler",
        indication: "Clinical Diagnostic Workup",
        ef: ef,
        edv: backendStudy?.edv ? Math.round(backendStudy.edv * 10) / 10 : 100,
        esv: backendStudy?.esv ? Math.round(backendStudy.esv * 10) / 10 : 45,
        gls: -18.5,
        status: "scored",
        severity: ef < 40 ? "Severe Dysfunction" : ef < 50 ? "Mild Impairment" : "Normal Function",
        hasVideo: !!backendStudy?.video
      }
    ]
  };
}
