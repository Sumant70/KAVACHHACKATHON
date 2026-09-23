import React, { useState, useEffect, useRef } from "react";
import {
  Camera, CameraOff, RefreshCw, Zap, ShieldAlert, AlertTriangle,
  CheckCircle2, MapPin, Radio, Activity, Eye, ArrowRight, Volume2,
  Sliders, Compass, Layers, Info
} from "lucide-react";
import { API_BASE_URL } from "../KavachApp";
import { playEmergencyAlarm } from "../components/AudioAlerts";
import { isAllowedWildlife, getWildlifeEmoji } from "../allowedWildlife";

export default function LiveCameraView({ apiBaseUrl, userGps, onNavigate, onDetectionAdded }) {
  const effectiveApiUrl = apiBaseUrl || API_BASE_URL;
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState(null);
  const [facingMode, setFacingMode] = useState("environment"); // "user" or "environment"
  const [continuousDetect, setContinuousDetect] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Telemetry & Results
  const [fps, setFps] = useState(0);
  const [latencyMs, setLatencyMs] = useState(0);
  const [latestDetection, setLatestDetection] = useState(null);
  const [detectionHistory, setDetectionHistory] = useState([]);
  const [activeAlert, setActiveAlert] = useState(null);
  const [frameCount, setFrameCount] = useState(0);

  // Confidence & Sensitivity
  const [confThreshold, setConfThreshold] = useState(25);

  const fpsTrackerRef = useRef({ count: 0, lastTime: performance.now() });
  const continuousTimerRef = useRef(null);
  const lastSirenTimeRef = useRef(0); // 10-second debounce cooldown for siren

  // 1. Initialize Browser Camera Stream
  const startCamera = async () => {
    setStreamError(null);
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setIsStreaming(true);
        };
      }
    } catch (err) {
      console.warn("Camera access failed:", err);
      setStreamError(
        err.name === "NotAllowedError"
          ? "Camera permission was denied. Please allow camera access in your browser settings."
          : `Unable to access video device (${err.message || err.name}).`
      );
      setIsStreaming(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    clearOverlay();
  };

  const toggleFacingMode = () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    if (isStreaming) {
      stopCamera();
      setTimeout(startCamera, 300);
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      if (continuousTimerRef.current) clearInterval(continuousTimerRef.current);
    };
  }, [facingMode]);

  // FPS measurement ticker
  useEffect(() => {
    const fpsInterval = setInterval(() => {
      const now = performance.now();
      const elapsed = (now - fpsTrackerRef.current.lastTime) / 1000;
      if (elapsed >= 1.0) {
        setFps(Math.round(fpsTrackerRef.current.count / elapsed));
        fpsTrackerRef.current.count = 0;
        fpsTrackerRef.current.lastTime = now;
      }
    }, 1000);
    return () => clearInterval(fpsInterval);
  }, []);

  // 2. Capture Frame and Send to /api/detect/live-frame
  const captureAndDetect = async () => {
    if (!videoRef.current || !isStreaming || isProcessing) return;
    if (videoRef.current.videoWidth === 0) return;

    setIsProcessing(true);
    const startTime = performance.now();

    try {
      const hiddenCanvas = canvasRef.current || document.createElement("canvas");
      hiddenCanvas.width = videoRef.current.videoWidth;
      hiddenCanvas.height = videoRef.current.videoHeight;
      const ctx = hiddenCanvas.getContext("2d");
      ctx.drawImage(videoRef.current, 0, 0, hiddenCanvas.width, hiddenCanvas.height);

      hiddenCanvas.toBlob(async (blob) => {
        if (!blob) {
          setIsProcessing(false);
          return;
        }

        const formData = new FormData();
        formData.append("file", blob, "live_frame.jpg");
        if (userGps?.lat) formData.append("lat", userGps.lat.toString());
        if (userGps?.lng) formData.append("lng", userGps.lng.toString());
        formData.append("device_id", "BROWSER-LIVE-CAM");
        formData.append("camera_name", "Live Browser Camera Feed");

        try {
          const res = await fetch(`${effectiveApiUrl}/api/detect/live-frame`, {
            method: "POST",
            body: formData
          });
          const data = await res.json();
          const elapsed = Math.round(performance.now() - startTime);
          setLatencyMs(elapsed);
          fpsTrackerRef.current.count += 1;
          setFrameCount(c => c + 1);

          if (data.success && data.detected && data.detections?.length > 0 && isAllowedWildlife(data.species)) {
            setLatestDetection(data);
            setDetectionHistory(prev => [data, ...prev.slice(0, 9)]);
            if (onDetectionAdded) {
              onDetectionAdded(data);
            }

            // Draw bounding boxes on HUD overlay canvas
            drawBoundingBoxes(data.detections, hiddenCanvas.width, hiddenCanvas.height);

            // Trigger emergency siren ONLY for confirmed allowed wildlife, debounced with 10s cooldown
            const now = Date.now();
            if (now - lastSirenTimeRef.current >= 10000) {
              lastSirenTimeRef.current = now;
              setActiveAlert(data);
              try { playEmergencyAlarm(); } catch (e) {}
            }
          } else {
            clearOverlay();
            setLatestDetection(null);
          }
        } catch (err) {
          console.warn("Live inference network error:", err);
        } finally {
          setIsProcessing(false);
        }
      }, "image/jpeg", 0.75);
    } catch (err) {
      console.warn("Capture error:", err);
      setIsProcessing(false);
    }
  };

  // Continuous detection loop
  useEffect(() => {
    if (continuousDetect && isStreaming) {
      continuousTimerRef.current = setInterval(() => {
        captureAndDetect();
      }, 1500);
    } else {
      if (continuousTimerRef.current) clearInterval(continuousTimerRef.current);
    }
    return () => {
      if (continuousTimerRef.current) clearInterval(continuousTimerRef.current);
    };
  }, [continuousDetect, isStreaming, userGps]);

  // 3. Render HUD Bounding Boxes on Overlay Canvas
  const drawBoundingBoxes = (detections, videoW, videoH) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    canvas.width = videoW;
    canvas.height = videoH;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    detections.forEach((det) => {
      const [x1, y1, x2, y2] = det.bbox;
      const width = Math.max(0, x2 - x1);
      const height = Math.max(0, y2 - y1);

      // Color coding based on species threat
      const isApex = ["Tiger", "Lion", "Leopard", "Asian Elephant"].includes(det.species);
      const strokeColor = isApex ? "#EF4444" : "#F59E0B";
      const fillColor = isApex ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.2)";

      // Draw bounding box
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(x1, y1, width, height);

      // Draw corner accent brackets
      const bracketLen = Math.min(20, width / 3, height / 3);
      ctx.lineWidth = 5;
      // Top-left
      ctx.beginPath();
      ctx.moveTo(x1, y1 + bracketLen);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x1 + bracketLen, y1);
      ctx.stroke();

      // Top-right
      ctx.beginPath();
      ctx.moveTo(x2 - bracketLen, y1);
      ctx.lineTo(x2, y1);
      ctx.lineTo(x2, y1 + bracketLen);
      ctx.stroke();

      // Label background pill
      const label = `${det.species} ${det.confidence}%`;
      ctx.font = "bold 15px 'Outfit', sans-serif, system-ui";
      const textMetrics = ctx.measureText(label);
      const textWidth = textMetrics.width;
      const textHeight = 22;

      ctx.fillStyle = strokeColor;
      ctx.fillRect(x1, y1 > textHeight + 6 ? y1 - textHeight - 6 : y1, textWidth + 14, textHeight + 6);

      // Label text
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(label, x1 + 7, y1 > textHeight + 6 ? y1 - 8 : y1 + 18);
    });
  };

  const clearOverlay = () => {
    const canvas = overlayCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Hardware-free demo simulation using bundled sample frame
  const simulateLiveWildDetection = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/sample_images/tiger.jpg`);
      const blob = await res.blob();
      const formData = new FormData();
      formData.append("file", blob, "simulated_tiger.jpg");
      if (userGps?.lat) formData.append("lat", userGps.lat.toString());
      if (userGps?.lng) formData.append("lng", userGps.lng.toString());
      formData.append("device_id", "SIMULATOR-01");
      formData.append("camera_name", "Demo Wildlife Camera");

      const detRes = await fetch(`${API_BASE_URL}/api/detect/live-frame`, {
        method: "POST",
        body: formData
      });
      const data = await detRes.json();
      setLatestDetection(data);
      setDetectionHistory(prev => [data, ...prev.slice(0, 9)]);
      if (data.detections?.length > 0) {
        drawBoundingBoxes(data.detections, 1280, 720);
        setActiveAlert(data);
        try { playEmergencyAlarm(); } catch (e) {}
      }
    } catch (e) {
      console.warn("Simulation error:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                Live Device Camera Surveillance
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                  isStreaming
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 animate-pulse"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                }`}>
                  {isStreaming ? "● LIVE STREAM ACTIVE" : "○ STREAM OFFLINE"}
                </span>
              </h1>
              <p className="text-slate-400 text-sm mt-0.5">
                Edge frame ingestion via browser <code className="text-xs bg-slate-800 px-1 py-0.5 rounded text-emerald-400">getUserMedia()</code> with real-time YOLO HUD bounding boxes & village proximity
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {isStreaming ? (
            <button
              onClick={stopCamera}
              className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 rounded-xl text-sm font-medium transition flex items-center gap-2"
            >
              <CameraOff className="w-4 h-4" /> Stop Stream
            </button>
          ) : (
            <button
              onClick={startCamera}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition flex items-center gap-2 shadow-lg shadow-emerald-600/20"
            >
              <Camera className="w-4 h-4" /> Start Camera
            </button>
          )}

          <button
            onClick={toggleFacingMode}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-sm font-medium transition flex items-center gap-1.5"
            title="Switch Front / Back Camera"
          >
            <RefreshCw className="w-4 h-4" /> Switch Lens
          </button>

          <button
            onClick={simulateLiveWildDetection}
            disabled={isProcessing}
            className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-sm font-medium transition flex items-center gap-2 shadow-lg shadow-amber-600/20"
          >
            <Zap className="w-4 h-4" /> Simulate Apex Detection
          </button>
        </div>
      </div>

      {/* Stream Error Alert if any */}
      {streamError && (
        <div className="bg-rose-950/40 border border-rose-800/60 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-rose-200">Camera Access Notice</h4>
            <p className="text-xs text-rose-300/80 mt-1">{streamError}</p>
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={startCamera}
                className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-500 transition"
              >
                Retry Camera Access
              </button>
              <button
                onClick={simulateLiveWildDetection}
                className="px-3 py-1.5 bg-slate-800 text-amber-300 border border-slate-700 rounded-lg text-xs font-medium hover:bg-slate-700 transition"
              >
                Run Hardware-Free Simulation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Stream & Telemetry Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stream Canvas Viewport */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative bg-black rounded-2xl overflow-hidden border border-slate-800 aspect-video shadow-2xl flex items-center justify-center group">
            {/* Raw HTML Video element */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`w-full h-full object-cover ${!isStreaming ? "hidden" : ""}`}
            />

            {/* Live HUD Overlay Canvas for Bounding Boxes */}
            <canvas
              ref={overlayCanvasRef}
              className={`absolute inset-0 w-full h-full pointer-events-none ${!isStreaming ? "hidden" : ""}`}
            />

            {/* Hidden canvas for taking snapshot blobs */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Stream Inactive Placeholder */}
            {!isStreaming && (
              <div className="text-center p-8 space-y-3">
                <div className="w-16 h-16 bg-slate-800/80 rounded-2xl flex items-center justify-center mx-auto text-slate-500 border border-slate-700">
                  <CameraOff className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-base">Camera Stream Inactive</h3>
                  <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto">
                    Click "Start Camera" above to grant browser permissions, or use "Simulate Apex Detection" to test without hardware.
                  </p>
                </div>
                <button
                  onClick={startCamera}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition inline-flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" /> Enable Device Camera
                </button>
              </div>
            )}

            {/* Live Telemetry HUD Bar (Top of stream) */}
            {isStreaming && (
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs font-mono text-white">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="font-semibold text-emerald-400">REC [LIVE]</span>
                  <span className="text-slate-400">|</span>
                  <span>{fps > 0 ? `${fps} FPS` : "SYNCING..."}</span>
                  <span className="text-slate-400">|</span>
                  <span>{latencyMs > 0 ? `${latencyMs}ms` : "0ms"}</span>
                </div>

                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs text-white">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{userGps?.lat ? `${userGps.lat.toFixed(4)}°N, ${userGps.lng.toFixed(4)}°E` : "GPS Fixed (Tadoba Core)"}</span>
                </div>
              </div>
            )}

            {/* Processing Spinner Overlay */}
            {isProcessing && (
              <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-lg border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Running YOLO Neural Pass...</span>
              </div>
            )}
          </div>

          {/* Stream Controls Panel */}
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={continuousDetect}
                  onChange={(e) => setContinuousDetect(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 focus:ring-offset-slate-900 bg-slate-800 border-slate-700"
                />
                <span className="text-sm font-medium text-slate-200 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> Continuous Auto-Inference (1.5s)
                </span>
              </label>

              <button
                onClick={captureAndDetect}
                disabled={isProcessing || !isStreaming}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5 text-emerald-400" /> Capture & Analyze Frame Now
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">Min Conf: {confThreshold}%</span>
              <input
                type="range"
                min="10"
                max="80"
                value={confThreshold}
                onChange={(e) => setConfThreshold(Number(e.target.value))}
                className="w-24 accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Live Intelligence & Telemetry Sidebar */}
        <div className="space-y-4">
          {/* Active Detection Card */}
          {latestDetection && latestDetection.detected ? (
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 p-5 rounded-2xl border border-amber-500/40 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                  Target Identified
                </span>
                <span className="text-xs text-slate-400 font-mono">{latestDetection.timestamp}</span>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <span>🐾</span> {latestDetection.species}
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {latestDetection.confidence}% Conf
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Detected via live optical feed • {latestDetection.count} instance(s) framed
                </p>
              </div>

              {/* Proximity Badge */}
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80 flex items-center gap-3">
                <MapPin className="w-5 h-5 text-rose-400 shrink-0" />
                <div>
                  <div className="text-xs text-slate-400 font-medium">Nearest Habitation Proximity</div>
                  <div className="text-sm font-bold text-white">
                    {latestDetection.distance_str || `~${Math.round(latestDetection.distance_to_village_m || 800)} m from ${latestDetection.nearest_village || "Rajpur Village"}`}
                  </div>
                </div>
              </div>

              {/* Risk Level Gauge */}
              {latestDetection.risk && (
                <div className="space-y-2 pt-1 border-t border-slate-800">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">Conflict Risk Score</span>
                    <span className={`font-bold ${
                      latestDetection.risk.risk_level === "CRITICAL" ? "text-rose-400" :
                      latestDetection.risk.risk_level === "HIGH" ? "text-orange-400" : "text-amber-400"
                    }`}>
                      {latestDetection.risk.risk_score} / 100 ({latestDetection.risk.risk_level})
                    </span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        latestDetection.risk.risk_level === "CRITICAL" ? "bg-rose-500" :
                        latestDetection.risk.risk_level === "HIGH" ? "bg-orange-500" : "bg-amber-500"
                      }`}
                      style={{ width: `${Math.min(100, latestDetection.risk.risk_score)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed italic">
                    "{latestDetection.risk.recommendation || 'Notify beat patrol team and verify corridor buffer.'}"
                  </p>
                </div>
              )}

              {/* Quick Navigation Links */}
              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => onNavigate && onNavigate("gis")}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5"
                >
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" /> View on GIS Map
                </button>
                <button
                  onClick={() => onNavigate && onNavigate("incidents")}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5"
                >
                  <Activity className="w-3.5 h-3.5 text-amber-400" /> Track Incident
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-white font-semibold text-sm">No Wildlife Detected</h4>
                <p className="text-slate-400 text-xs mt-1">
                  Point camera at wildlife images or test cards. Camera stream processes continuously in real-time.
                </p>
              </div>
            </div>
          )}

          {/* Live Frame Audit Feed */}
          <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Recent Camera Detections</span>
              <span className="font-mono text-emerald-400">{detectionHistory.length} Recorded</span>
            </h4>

            {detectionHistory.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">No detections recorded in this session yet.</p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {detectionHistory.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-slate-800/60 hover:bg-slate-800 rounded-xl border border-slate-700/50 flex items-center justify-between text-xs transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <div>
                        <div className="font-semibold text-white">{item.species}</div>
                        <div className="text-[10px] text-slate-400">{item.distance_str || item.nearest_village}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-emerald-400 font-bold">{item.confidence}%</div>
                      <div className="text-[10px] text-slate-500">{item.timestamp}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
