import React from "react";
import { FolderHeart } from "lucide-react";

/**
 * Study Selector for switching between clinical patient profiles
 */
export function StudySelector({
  cohort = [],
  selectedStudyId = "",
  onSelectStudy = () => {}
}) {

  return (
    <div className="study-selector-container">
      <div className="study-selector-label-row">
        <FolderHeart size={14} className="text-muted" />
        <span className="study-selector-title">Study:</span>
      </div>

      <select
        value={selectedStudyId}
        onChange={(e) => {
          const study = cohort.find((c) => c.id === e.target.value);
          if (study) onSelectStudy(study);
        }}
        className="study-dropdown"
      >
        {cohort.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}{c.ef != null ? ` (EF ${c.ef.toFixed(1)}%` : ""}{c.ef_pred != null ? ` • PanEcho ${c.ef_pred.toFixed(1)}%` : ""}{c.ef != null ? ")" : ""}{c.n_done ? "" : " • not scored"}
          </option>
        ))}
      </select>
    </div>
  );
}
