import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { adaptStudy } from "../../data/panEchoData";
import { matchPatientForStudy } from "../../data/patientData";
import { getCardiacKinematics, generateWiggersTelemetry } from "../../data/kinematics";
import { api } from "../../lib/api";

export function useCardiacTwinDashboard() {
  const [doctor, setDoctor] = useState(null);
  const [currentView, setCurrentView] = useState("login");
  const [selectedPatient, setSelectedPatient] = useState(null);

  const [cohort, setCohort] = useState([]);
  const [currentStudy, setCurrentStudy] = useState(null);
  const [studyDetail, setStudyDetail] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [inferring, setInferring] = useState(false);

  const [displayMode, setDisplayMode] = useState("wireframe");
  const [viewMode, setViewMode] = useState("none");
  const [cameraPreset, setCameraPreset] = useState("anterior");
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showValves, setShowValves] = useState(true);
  const [showSimpsonTracings, setShowSimpsonTracings] = useState(false);
  const [highlightSegment, setHighlightSegment] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [phase, setPhase] = useState(0.0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [bpm, setBpm] = useState(70);
  const [speedMultiplier, setSpeedMultiplier] = useState(1.0);
  const [activeTab, setActiveTab] = useState("video");

  useEffect(() => {
    api.listStudies(60)
      .then((rows) => {
        setCohort(rows);
        if (rows.length && !currentStudy) {
          setCurrentStudy(rows[0]);
        }
      })
      .catch((error) => setApiError(String(error)));
  }, []);

  useEffect(() => {
    if (!currentStudy?.id) return;
    setStudyDetail(null);
    api.getStudy(currentStudy.id)
      .then(setStudyDetail)
      .catch((error) => setApiError(String(error)));
  }, [currentStudy?.id]);

  const activePatient = useMemo(() => {
    if (selectedPatient) return selectedPatient;
    return matchPatientForStudy(currentStudy?.id, cohort);
  }, [selectedPatient, currentStudy?.id, cohort]);

  useEffect(() => {
    if (activePatient?.recentVitals?.hr) {
      const parsedBpm = Number.parseInt(activePatient.recentVitals.hr, 10);
      if (!Number.isNaN(parsedBpm) && parsedBpm > 0) {
        setBpm(parsedBpm);
      }
    }
  }, [activePatient]);

  const runInference = useCallback(async () => {
    if (!currentStudy) return;
    setInferring(true);
    try {
      await api.inferStudy(currentStudy.id);
      const [detail, rows] = await Promise.all([api.getStudy(currentStudy.id), api.listStudies(60)]);
      setStudyDetail(detail);
      setCohort(rows);
    } catch (error) {
      setApiError(String(error));
    } finally {
      setInferring(false);
    }
  }, [currentStudy?.id]);

  const studyResults = useMemo(() => adaptStudy(studyDetail), [studyDetail]);
  const video0 = studyDetail?.videos?.[0];
  const videoSrc = api.absolute(video0?.stream);
  const videoFps = video0?.fps || 50;
  const videoFrames = video0?.frame_count || 200;

  const studyParams = useMemo(() => {
    const ef = studyResults.ef ?? currentStudy?.ef ?? 55;
    const edv = studyResults.edv ?? currentStudy?.edv ?? 100;
    const esv = studyResults.esv ?? currentStudy?.esv ?? 45;
    return {
      ef,
      edv,
      esv,
      gls: studyResults.gls ?? -18.5,
      heartRate: bpm,
      strokeVolume: edv - esv,
    };
  }, [currentStudy, studyResults, bpm]);

  const kinematics = useMemo(() => getCardiacKinematics(phase, studyParams), [phase, studyParams]);
  const telemetryData = useMemo(() => generateWiggersTelemetry(studyParams, 100), [studyParams]);

  const lastTimeRef = useRef(performance.now());
  const isPlayingRef = useRef(isPlaying);
  const bpmRef = useRef(bpm);
  const speedRef = useRef(speedMultiplier);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    bpmRef.current = bpm;
    speedRef.current = speedMultiplier;
  }, [isPlaying, bpm, speedMultiplier]);

  useEffect(() => {
    let animId;
    const animate = (time) => {
      const deltaSec = (time - lastTimeRef.current) / 1000.0;
      lastTimeRef.current = time;

      if (isPlayingRef.current) {
        const cycleDurationSec = 60.0 / bpmRef.current;
        const phaseDelta = (deltaSec / cycleDurationSec) * speedRef.current;
        setPhase((prev) => (prev + phaseDelta) % 1.0);
      }

      animId = requestAnimationFrame(animate);
    };

    lastTimeRef.current = performance.now();
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleSeekPhase = useCallback((targetPhase) => {
    setPhase(((targetPhase % 1) + 1) % 1);
  }, []);

  const handleStepPhase = useCallback((delta) => {
    setPhase((prev) => ((prev + delta) % 1 + 1) % 1);
  }, []);

  const handleSelectSegment = useCallback((segment) => {
    setHighlightSegment((prev) => (prev === segment.id ? null : segment.id));
  }, []);

  const handleSelectNode = useCallback((node) => {
    setSelectedNode((prev) => (prev?.id === node?.id ? null : node));
  }, []);

  const handleLoginSuccess = useCallback((doctorProfile) => {
    setDoctor(doctorProfile);
    setCurrentView("directory");
  }, []);

  const handleSelectStudyFromDirectory = useCallback((study, patient) => {
    setCurrentStudy(study);
    setSelectedPatient(patient);
    setCurrentView("workstation");
  }, []);

  const handleBackToDirectory = useCallback(() => {
    setCurrentView("directory");
  }, []);

  const handleLogout = useCallback(() => {
    setDoctor(null);
    setCurrentView("login");
  }, []);

  return {
    doctor,
    currentView,
    selectedPatient,
    cohort,
    currentStudy,
    studyDetail,
    apiError,
    inferring,
    displayMode,
    setDisplayMode,
    viewMode,
    setViewMode,
    cameraPreset,
    setCameraPreset,
    showHeatmap,
    setShowHeatmap,
    showValves,
    setShowValves,
    showSimpsonTracings,
    setShowSimpsonTracings,
    highlightSegment,
    selectedNode,
    setSelectedNode,
    sidebarCollapsed,
    setSidebarCollapsed,
    phase,
    setPhase,
    isPlaying,
    setIsPlaying,
    bpm,
    setBpm,
    speedMultiplier,
    setSpeedMultiplier,
    activeTab,
    setActiveTab,
    activePatient,
    runInference,
    studyResults,
    videoSrc,
    videoFps,
    videoFrames,
    studyParams,
    kinematics,
    telemetryData,
    handleSeekPhase,
    handleStepPhase,
    handleSelectSegment,
    handleSelectNode,
    handleLoginSuccess,
    handleSelectStudyFromDirectory,
    handleBackToDirectory,
    handleLogout,
    setCurrentView,
  };
}
