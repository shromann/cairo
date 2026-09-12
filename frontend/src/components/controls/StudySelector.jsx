import React from "react";
import heartData from "../../data/heartData.json";
import { FolderHeart } from "lucide-react";

/**
 * Study Selector for switching between clinical patient profiles
 */
export function StudySelector({
  selectedStudyId = "0X2D1CE5FC57B6FBC1",
  onSelectStudy = () => {}
}) {
  const cohort = heartData.cohort || [];

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
            {c.label} (EF {c.ef.toFixed(1)}% • EDV {c.edv.toFixed(0)}mL)
          </option>
        ))}
      </select>
    </div>
  );
}
