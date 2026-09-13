import React, { useState, useMemo } from "react";
import {
  PANECHO_TASK_METADATA,
  PANECHO_CATEGORIES,
  PANECHO_TASK_COUNT
} from "../../data/panEchoData";
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Stethoscope,
  Copy,
  Check,
  Filter,
  Sparkles,
  ChevronRight,
  FileCheck2,
  FileSpreadsheet
} from "lucide-react";

/**
 * Yale CarDS PanEcho 40-Task Clinical Diagnostic Report Drawer
 * Includes Executive Clinician AI Brief, Abnormality Triage, and 1-Click EHR Export.
 */
export function PanEchoDrawer({
  studyResults = {},
  onRunInference = null,
  inferring = false,
  onSelectFindingNode = null
}) {
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAbnormalOnly, setFilterAbnormalOnly] = useState(false);
  const [copiedEhr, setCopiedEhr] = useState(false);

  const predictions = studyResults.predictions || {};

  // Compute abnormality counts and severity levels
  const taskAnalysis = useMemo(() => {
    let criticalCount = 0;
    let warningCount = 0;
    let normalCount = 0;
    const abnormalList = [];

    PANECHO_TASK_METADATA.forEach((task) => {
      const pred = predictions[task.id];
      if (!pred) return;

      const labelLower = (pred.status || pred.label || "").toLowerCase();
      const isCritical =
        labelLower.includes("severe") ||
        labelLower.includes("akinetic") ||
        labelLower.includes("elevated") ||
        labelLower.includes("positive");
      const isWarning =
        labelLower.includes("mild") ||
        labelLower.includes("hypokinetic") ||
        labelLower.includes("moderate") ||
        labelLower.includes("borderline");

      if (isCritical) {
        criticalCount++;
        abnormalList.push({ ...task, pred, level: "critical" });
      } else if (isWarning) {
        warningCount++;
        abnormalList.push({ ...task, pred, level: "warning" });
      } else {
        normalCount++;
      }
    });

    return { criticalCount, warningCount, normalCount, abnormalList };
  }, [predictions]);

  // Synthesize AI Clinical Executive Impression
  const executiveImpression = useMemo(() => {
    const ef = studyResults.ef ?? 55;
    const gls = studyResults.gls ?? -18.5;

    let impressionLines = [];

    // 1. Systolic & Strain status
    if (ef < 35) {
      impressionLines.push(`Severely reduced LVEF (${ef}%) with global longitudinal strain impairment (GLS ${gls}%). Consistent with HFrEF.`);
    } else if (ef < 50) {
      impressionLines.push(`Mildly reduced LVEF (${ef}%, HFmrEF) with borderline longitudinal mechanics.`);
    } else {
      impressionLines.push(`Preserved LV systolic ejection fraction (LVEF ${ef}%) with normal global longitudinal strain (GLS ${gls}%).`);
    }

    // 2. Significant Valvular findings
    const as = predictions["AVStenosis"];
    const mr = predictions["MVRegurgitation"];
    const ar = predictions["AVRegurg"];
    const tv = predictions["TVRegurgitation"];

    if (as && as.label && !as.label.toLowerCase().includes("none")) {
      impressionLines.push(`Aortic Valve: ${as.label} stenosis detected.`);
    }
    if (mr && mr.label && !mr.label.toLowerCase().includes("none") && !mr.label.toLowerCase().includes("trace")) {
      impressionLines.push(`Mitral Valve: ${mr.label} regurgitation present.`);
    }
    if (ar && ar.label && !ar.label.toLowerCase().includes("none") && !ar.label.toLowerCase().includes("trace")) {
      impressionLines.push(`Aortic Valve: ${ar.label} regurgitation present.`);
    }
    if (tv && tv.label && !tv.label.toLowerCase().includes("none") && !tv.label.toLowerCase().includes("trace")) {
      impressionLines.push(`Tricuspid Valve: ${tv.label} regurgitation present.`);
    }

    // 3. Wall Motion
    const wma = predictions["LVWallMotionAbnormalities"];
    if (wma && (wma.status === "Present" || wma.label === "Present")) {
      impressionLines.push("Regional Left Ventricular wall motion abnormalities identified (apical/anterior territory).");
    }

    return impressionLines.join(" ");
  }, [studyResults, predictions]);

  const filteredTasks = useMemo(() => {
    return PANECHO_TASK_METADATA.filter((task) => {
      const pred = predictions[task.id];
      const matchesCategory =
        selectedCategory === "ALL" || task.category === selectedCategory;
      const matchesQuery =
        !searchQuery ||
        task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.id.toLowerCase().includes(searchQuery.toLowerCase());

      if (filterAbnormalOnly) {
        if (!pred) return false;
        const labelLower = (pred.status || pred.label || "").toLowerCase();
        const isAbnormal =
          labelLower.includes("severe") ||
          labelLower.includes("akinetic") ||
          labelLower.includes("elevated") ||
          labelLower.includes("positive") ||
          labelLower.includes("mild") ||
          labelLower.includes("hypokinetic") ||
          labelLower.includes("moderate");
        return matchesCategory && matchesQuery && isAbnormal;
      }

      return matchesCategory && matchesQuery;
    });
  }, [selectedCategory, searchQuery, filterAbnormalOnly, predictions]);

  // Copy structured EHR documentation to clipboard
  const handleCopyEHR = () => {
    const ef = studyResults.ef ?? 55;
    const edv = studyResults.edv ?? 100;
    const esv = studyResults.esv ?? 45;
    const gls = studyResults.gls ?? -18.5;

    const ehrText = `--- CAIRO CLINICAL ECHOCARDIOGRAM REPORT (PanEcho AI) ---
Date: ${new Date().toISOString().split("T")[0]}
Study ID: ${studyResults.id || "Echo-Study"}
Attending: Dr. Sarah Chen, MD (Cardiology)

QUANTITATIVE KINEMATICS & MEASUREMENTS:
• LV Ejection Fraction (LVEF): ${ef}%
• LV End-Diastolic Volume (LVEDV): ${edv} mL
• LV End-Systolic Volume (LVESV): ${esv} mL
• Global Longitudinal Strain (GLS): ${gls}%
• Stroke Volume: ${edv - esv} mL

AI EXECUTIVE IMPRESSION:
${executiveImpression}

TRIAGE STATUS:
• Critical Abnormalities: ${taskAnalysis.criticalCount}
• Moderate / Surveillance Findings: ${taskAnalysis.warningCount}
• Model Confidence: 40 Multitask Heads Evaluated (Yale CarDS PanEcho)
-------------------------------------------------------`;

    navigator.clipboard.writeText(ehrText);
    setCopiedEhr(true);
    setTimeout(() => setCopiedEhr(false), 2400);
  };

  return (
    <div className="panecho-drawer">
      {/* 1. Top Executive Clinician AI Brief Card */}
      <div className="clinician-brief-card">
        <div className="cbc-header">
          <div className="cbc-title-wrap">
            <Sparkles size={14} className="accent-sparkle" />
            <span className="cbc-title">Clinician AI Impression</span>
          </div>
          <button
            className={`copy-ehr-btn ${copiedEhr ? "copied" : ""}`}
            onClick={handleCopyEHR}
            title="Copy structured clinical note for hospital EHR"
          >
            {copiedEhr ? <Check size={12} /> : <Copy size={12} />}
            <span>{copiedEhr ? "Copied EHR Note ✓" : "Copy EHR Note"}</span>
          </button>
        </div>

        <p className="cbc-impression-text">{executiveImpression}</p>

        {/* Triage Count Chips */}
        <div className="cbc-triage-chips-row">
          <div
            className={`triage-chip chip-critical ${filterAbnormalOnly ? "active" : ""}`}
            onClick={() => setFilterAbnormalOnly(!filterAbnormalOnly)}
            title="Click to toggle only abnormal tasks"
          >
            <AlertCircle size={12} />
            <span>{taskAnalysis.criticalCount} Critical</span>
          </div>

          <div
            className="triage-chip chip-warning"
            onClick={() => setFilterAbnormalOnly(!filterAbnormalOnly)}
          >
            <AlertTriangle size={12} />
            <span>{taskAnalysis.warningCount} Moderate</span>
          </div>

          <div className="triage-chip chip-stable">
            <CheckCircle2 size={12} />
            <span>{taskAnalysis.normalCount} Preserved</span>
          </div>

          <button
            className={`abnormal-toggle-pill ${filterAbnormalOnly ? "active" : ""}`}
            onClick={() => setFilterAbnormalOnly(!filterAbnormalOnly)}
          >
            <Filter size={11} />
            <span>{filterAbnormalOnly ? "Showing Abnormal (Filter Active)" : "Filter Abnormal Only"}</span>
          </button>
        </div>
      </div>

      {/* 2. Header & Filter Controls */}
      <div className="panecho-header">
        <div className="panecho-title-row">
          <div className="panecho-logo-wrap">
            <Stethoscope size={15} className="text-muted" />
            <span className="panecho-title">PanEcho Diagnostic Heads</span>
          </div>
          <span className="panecho-badge">{filteredTasks.length} / {PANECHO_TASK_COUNT} Tasks</span>
        </div>

        {!studyResults.hasPredictions && onRunInference && (
          <button className="category-tab active" onClick={onRunInference} disabled={inferring}>
            {inferring ? "Running PanEcho on this study…" : "Run PanEcho now"}
          </button>
        )}

        {/* Search & Category Filter */}
        <div className="panecho-search-bar">
          <Search size={13} className="search-icon" />
          <input
            type="text"
            placeholder="Filter tasks (e.g. EF, Regurgitation, Stenosis, Volumes)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="panecho-search-input"
            aria-label="Filter clinical tasks"
          />
        </div>

        <div className="panecho-category-tabs">
          <button
            className={`category-tab ${selectedCategory === "ALL" ? "active" : ""}`}
            onClick={() => setSelectedCategory("ALL")}
          >
            All
          </button>
          {Object.values(PANECHO_CATEGORIES).map((cat) => (
            <button
              key={cat}
              className={`category-tab ${selectedCategory === cat ? "active" : ""}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Task List */}
      <div className="panecho-tasks-list">
        {filteredTasks.length === 0 ? (
          <div className="no-tasks-state">
            <span>No tasks match the active filters.</span>
            {filterAbnormalOnly && (
              <button
                className="btn-link"
                onClick={() => setFilterAbnormalOnly(false)}
              >
                Clear Abnormal Filter
              </button>
            )}
          </div>
        ) : (
          filteredTasks.map((task) => {
            const pred = predictions[task.id];
            const isRegression = task.type === "regression";

            let statusClass = "tag-normal";
            let Icon = CheckCircle2;

            if (pred) {
              const labelLower = (pred.status || pred.label || "").toLowerCase();
              if (pred.severe === false && labelLower === "normal") {
                /* keep tag-normal */
              } else if (
                labelLower.includes("severe") ||
                labelLower.includes("akinetic") ||
                labelLower.includes("elevated") ||
                labelLower.includes("positive")
              ) {
                statusClass = "tag-severe";
                Icon = AlertCircle;
              } else if (
                labelLower.includes("mild") ||
                labelLower.includes("hypokinetic") ||
                labelLower.includes("moderate") ||
                labelLower.includes("borderline")
              ) {
                statusClass = "tag-warning";
                Icon = AlertTriangle;
              }
            }

            return (
              <div key={task.id} className="panecho-task-card">
                <div className="task-header">
                  <span className="task-name">{task.name}</span>
                  <span className="task-category-tag">{task.category.split(" ")[0]}</span>
                </div>

                <div className="task-body">
                  {isRegression ? (
                    <div className="task-value-row">
                      <span className="task-number">{pred ? pred.value : "--"}</span>
                      <span className="task-unit">{task.unit}</span>
                      {pred && (
                        <span className={`task-status-tag ${statusClass}`}>
                          <Icon size={11} />
                          {pred.status}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="task-value-row">
                      <span className="task-label-text">{pred ? pred.label : "--"}</span>
                      {pred && (
                        <span className={`task-status-tag ${statusClass}`}>
                          <Icon size={11} />
                          {pred.status || pred.label}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Normal reference or probability */}
                  <div className="task-footer-info">
                    {isRegression ? (
                      <span className="task-ref">Ref: {task.normalRange}</span>
                    ) : (
                      <span className="task-ref">
                        Prob: {pred ? `${(pred.probability * 100).toFixed(0)}%` : "--"}
                      </span>
                    )}
                    {pred && pred.nVideos > 1 && (
                      <span className="task-conf">avg of {pred.nVideos} clips</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
