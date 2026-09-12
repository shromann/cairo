import React, { useRef, useEffect } from "react";
import { Film, Play, Pause, Bookmark } from "lucide-react";

/**
 * Synchronized 2D Echocardiogram Video Player
 * Frame-locked with the 3D Cardiac Digital Twin.
 */
export function VideoSyncPlayer({
  videoSrc = "/videos/0X2D1CE5FC57B6FBC1.mp4",
  currentPhase = 0,
  isPlaying = false,
  fps = 50,
  totalFrames = 212,
  onSeekPhase = () => {}
}) {
  const videoRef = useRef(null);

  // Synchronize HTML5 video element time to currentPhase
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !video.duration) return;

    // Approximate cardiac cycle within the loop
    const targetTime = currentPhase * (video.duration || 3.46);
    if (Math.abs(video.currentTime - targetTime) > 0.08) {
      video.currentTime = targetTime;
    }
  }, [currentPhase]);

  // Current estimated frame
  const currentFrame = Math.round(currentPhase * totalFrames) % totalFrames;

  return (
    <div className="video-sync-card">
      <div className="video-sync-header">
        <div className="video-title-wrap">
          <Film size={15} className="text-cyan" />
          <span className="video-title">EchoNet-Dynamic Ingestion Clip</span>
        </div>
        <span className="video-frame-badge">
          Frame {currentFrame} / {totalFrames} ({fps} FPS)
        </span>
      </div>

      <div className="video-player-container">
        {videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            playsInline
            muted
            loop
            className="echo-video-element"
          />
        ) : (
          <div className="no-video-placeholder">
            <span>Synthetic Video Mode (Parameters Loaded)</span>
          </div>
        )}

        {/* Ultrasound Scan Fan Overlay */}
        <div className="echo-video-overlay-grid">
          <div className="transducer-tag">A4C View • 2.5 MHz</div>
          <div className="depth-tag">16 cm</div>
        </div>
      </div>

      {/* Frame Bookmarks for End-Diastole and End-Systole */}
      <div className="video-bookmarks-row">
        <button
          className="bookmark-btn"
          onClick={() => onSeekPhase(112 / totalFrames)}
          title="Jump to End-Diastolic Frame"
        >
          <Bookmark size={13} className="text-cyan" />
          <span>ED Frame 112</span>
        </button>

        <button
          className="bookmark-btn"
          onClick={() => onSeekPhase(134 / totalFrames)}
          title="Jump to End-Systolic Frame"
        >
          <Bookmark size={13} className="text-crimson" />
          <span>ES Frame 134</span>
        </button>
      </div>
    </div>
  );
}
