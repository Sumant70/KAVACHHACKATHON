import React, { useState, useRef, useEffect } from "react";
import {
  Upload, Camera, Video, Play, RefreshCw, AlertTriangle, CheckCircle2,
  MapPin, ShieldAlert, Sliders, ExternalLink, ArrowRight, Radio
} from "lucide-react";
import BoundingBoxCanvas from "../components/BoundingBoxCanvas";
import WebcamDetector from "../components/WebcamDetector";
import { SAMPLE_WILDLIFE_CASES } from "../assets/sample_animals";
import { playRadarPing, playEmergencyAlarm } from "../components/AudioAlerts";
import { API_BASE_URL } from "../KavachApp";
import { isAllowedWildlife, getWildlifeEmoji } from "../allowedWildlife";

export default function AnimalDetectionView({
  apiBaseUrl,
  userGps,
  onDetectionAdded,
  onNavigateToMap
}) {
  const effectiveApiUrl = apiBaseUrl || API_BASE_URL;

  const [activeTab, setActiveTab] = useState("upload"); // "upload" | "webcam" | "video" | "presets"
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [detectionResult, setDetectionResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState(50);
  const [selectedZone, setSelectedZone] = useState("Z-04");
  const [backendStatus, setBackendStatus] = useState("CHECKING"); // "ONLINE" | "OFFLINE" | "CHECKING"
  const [modelStatus, setModelStatus] = useState(null);
  const fileInputRef = useRef(null);

  // Periodically check backend health
  const checkBackendHealth = async () => {
    try {
      const res = await fetch(`${effectiveApiUrl}/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        setBackendStatus("ONLINE");
      } else {
        setBackendStatus("OFFLINE");
      }
    } catch {
      setBackendStatus("OFFLINE");
    }
  };

  useEffect(() => {
    checkBackendHealth();
    const interval = setInterval(checkBackendHealth, 8000);
    return () => clearInterval(interval);
  }, [effectiveApiUrl]);

  // Load model validation status (supported vs unsupported species)
  useEffect(() => {
    fetch(`${effectiveApiUrl}/api/model/status`)
      .then(r => r.json())
      .then(d => setModelStatus(d))
      .catch(() => null);
  }, [effectiveApiUrl]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMessage(null);
    setInfoMessage(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setDetectionResult(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setErrorMessage(null);
      setInfoMessage(null);
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setDetectionResult(null);
    }
  };

  const handlePresetSelect = async (preset) => {
    setErrorMessage(null);
    setPreviewUrl(preset.imageUrl);
    setSelectedZone(preset.zoneId);

    // Fetch the sample image blob so it can be sent to YOLO backend
    try {
      const resp = await fetch(preset.imageUrl);
      if (!resp.ok) throw new Error(`Could not fetch ${preset.imageUrl}`);
      const blob = await resp.blob();
      const file = new File([blob], `${preset.species.toLowerCase().replace(/\s+/g, '_')}_sample.jpg`, { type: "image/jpeg" });
      setSelectedFile(file);
      // Run detection
      runDetection(file, preset.lat, preset.lng, preset.zoneId);
    } catch (err) {
      console.warn("Using preset image fetch error:", err);
      setErrorMessage(`Failed to load preset sample image: ${err.message}`);
    }
  };

  const handleWebcamCapture = (capturedFile) => {
    setSelectedFile(capturedFile);
    setPreviewUrl(URL.createObjectURL(capturedFile));
    runDetection(capturedFile, userGps?.lat, userGps?.lng);
  };

  const runDetection = async (fileToRun, overrideLat, overrideLng, overrideZone) => {
    const file = fileToRun || selectedFile;
    if (!file) {
      setErrorMessage("Please select or capture a wildlife image first.");
      return;
    }

    setAnalyzing(true);
    setErrorMessage(null);
    setInfoMessage(null);

    // Strict rule: Uploaded photos must NEVER default to user's desk GPS.
    // Use explicit coordinates if provided (e.g. live webcam or test preset); otherwise sanctuary baseline.
    const lat = overrideLat !== undefined ? overrideLat : 20.2667;
    const lng = overrideLng !== undefined ? overrideLng : 79.4000;
    const zone = overrideZone ?? selectedZone ?? "Z-04";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("lat", lat.toString());
    formData.append("lng", lng.toString());
    formData.append("zone_id", zone);
    formData.append("accuracy", (userGps?.accuracy || 10).toString());

    try {
      const response = await fetch(`${effectiveApiUrl}/api/detect/image`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        let customMsg = errData.detail || errData.message;
        if (response.status === 400) {
          if (customMsg?.toLowerCase().includes("format") || customMsg?.toLowerCase().includes("extension")) {
            customMsg = "Invalid image format. Supported formats: JPG, JPEG, PNG, WEBP.";
          } else if (customMsg?.toLowerCase().includes("size") || customMsg?.toLowerCase().includes("25mb")) {
            customMsg = "Image is too large. Maximum supported image size is 25MB.";
          }
        } else if (response.status === 500) {
          if (customMsg?.toLowerCase().includes("yolo") || customMsg?.toLowerCase().includes("model")) {
            customMsg = "YOLO model could not be loaded or executed by backend.";
          }
        }
        throw new Error(customMsg || `Detection failed (Server returned HTTP ${response.status})`);
      }

      const data = await response.json();
      setBackendStatus("ONLINE");
      setDetectionResult(data);

      if (data.detected && isAllowedWildlife(data.species)) {
        playRadarPing();
        if (data.risk?.risk_level === "HIGH" || data.risk?.risk_level === "CRITICAL") {
          playEmergencyAlarm();
        }
        onDetectionAdded?.(data);
      } else {
        setInfoMessage("No Wildlife Detected");
      }
    } catch (err) {
      console.error("Detection failed:", err);
      let friendlyMsg = "";
      if (err.name === "TypeError" || (err.message && err.message.toLowerCase().includes("fetch"))) {
        setBackendStatus("OFFLINE");
        friendlyMsg = `Detection server is offline. Unable to connect to KAVACH backend at ${effectiveApiUrl}. Please start backend with: python backend/predict.py`;
      } else {
        friendlyMsg = err.message || "Detection failed. Please check backend connection and retry.";
      }
      setErrorMessage(friendlyMsg);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Studio Header */}
      <div className="kv-panel" style={{ padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 24, fontWeight: 700, margin: 0, color: "#EEF4EE", letterSpacing: "0.04em" }}>
              AI WILDLIFE DETECTION STUDIO
            </h1>
            {/* Live Backend Connection Indicator */}
            {backendStatus === "ONLINE" && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(76, 175, 80, 0.15)", border: "1px solid #4CAF50", padding: "3px 10px", borderRadius: 20, fontSize: 11, color: "#81C784", fontWeight: 700 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4CAF50", boxShadow: "0 0 8px #4CAF50" }}></span>
                Detection Server Connected
              </span>
            )}
            {backendStatus === "OFFLINE" && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(229, 77, 77, 0.15)", border: "1px solid #E54D4D", padding: "3px 10px", borderRadius: 20, fontSize: 11, color: "#FF8A80", fontWeight: 700 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#E54D4D", boxShadow: "0 0 8px #E54D4D" }}></span>
                Detection Server Offline
              </span>
            )}
            {backendStatus === "CHECKING" && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(214, 168, 79, 0.15)", border: "1px solid #D6A84F", padding: "3px 10px", borderRadius: 20, fontSize: 11, color: "#D6A84F", fontWeight: 600 }}>
                <RefreshCw size={10} style={{ animation: "spin 1s linear infinite" }} />
                Checking Server...
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: "#8FA396", marginTop: 4 }}>
            Ultralytics YOLO inference engine with automated spatial risk scoring & real-time community broadcast
          </div>

          {/* Model Capabilities & Supported Species Indicator */}
          {modelStatus && (
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, fontSize: 11 }}>
              <span style={{ color: "#8FA396", fontWeight: 700, textTransform: "uppercase" }}>TARGET SPECIES STATUS:</span>
              <span style={{ background: "rgba(76, 175, 80, 0.15)", border: "1px solid #4CAF50", color: "#81C784", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>
                ✓ SUPPORTED ({modelStatus.supported_count}): {modelStatus.supported_species?.map(s => s.canonical).join(", ")}
              </span>
              <span style={{ background: "rgba(143, 163, 150, 0.12)", border: "1px solid #3F5245", color: "#8FA396", padding: "2px 8px", borderRadius: 4 }} title="These species are absent from model weights and will return NO TARGET WILDLIFE DETECTED">
                ✗ UNSUPPORTED ({modelStatus.unsupported_count}): {modelStatus.unsupported_species?.map(s => s.canonical).join(", ")}
              </span>
            </div>
          )}
        </div>

        {/* Tab Switcher */}
        <div style={{ display: "flex", gap: 4, background: "var(--panel-raised)", padding: 4, borderRadius: 6, border: "1px solid var(--line-soft)" }}>
          <button
            onClick={() => setActiveTab("upload")}
            style={{
              background: activeTab === "upload" ? "#1B3B2B" : "transparent",
              border: `1px solid ${activeTab === "upload" ? "#2F6B4C" : "transparent"}`,
              color: activeTab === "upload" ? "#EEF4EE" : "#8FA396",
              padding: "6px 14px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <Upload size={14} /> Upload Image
          </button>

          <button
            onClick={() => setActiveTab("webcam")}
            style={{
              background: activeTab === "webcam" ? "#1B3B2B" : "transparent",
              border: `1px solid ${activeTab === "webcam" ? "#2F6B4C" : "transparent"}`,
              color: activeTab === "webcam" ? "#EEF4EE" : "#8FA396",
              padding: "6px 14px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <Camera size={14} /> Live Webcam
          </button>

          <button
            onClick={() => setActiveTab("presets")}
            style={{
              background: activeTab === "presets" ? "#1B3B2B" : "transparent",
              border: `1px solid ${activeTab === "presets" ? "#2F6B4C" : "transparent"}`,
              color: activeTab === "presets" ? "#D6A84F" : "#8FA396",
              padding: "6px 14px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <Play size={14} /> 1-Click Samples
          </button>
        </div>
      </div>

      {/* Main Studio Body */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 20 }}>
        {/* Left Column: Input & Canvas */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {activeTab === "upload" && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: "2px dashed #28543C",
                background: "rgba(18, 36, 26, 0.4)",
                borderRadius: 8,
                padding: "28px 20px",
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = "#4CAF50"}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = "#28543C"}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/bmp"
                onChange={handleFileSelect}
                style={{ display: "none" }}
              />
              <Upload size={36} color="#4CAF50" style={{ margin: "0 auto 10px" }} />
              <div style={{ fontWeight: 600, fontSize: 14, color: "#EEF4EE" }}>
                Click to browse or Drag & Drop Camera-Trap Image
              </div>
              <div style={{ fontSize: 12, color: "#8FA396", marginTop: 4 }}>
                Supports JPEG, PNG, WebP · Max 25MB
              </div>
            </div>
          )}

          {activeTab === "webcam" && (
            <WebcamDetector onFrameCaptured={handleWebcamCapture} isAnalyzing={analyzing} />
          )}

          {activeTab === "presets" && (
            <div className="kv-panel" style={{ padding: 16 }}>
              <div style={{ fontSize: 12, color: "#D6A84F", fontWeight: 600, marginBottom: 10, fontFamily: "'IBM Plex Mono', monospace" }}>
                SELECT HIGH-RESOLUTION TEST CASE (1-CLICK SIH DEMO):
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                {SAMPLE_WILDLIFE_CASES.map(preset => (
                  <div
                    key={preset.id}
                    onClick={() => handlePresetSelect(preset)}
                    style={{
                      border: "1px solid #234634",
                      background: "var(--panel-raised)",
                      borderRadius: 6,
                      overflow: "hidden",
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "#D6A84F"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "#234634"}
                  >
                    <div style={{ height: 80, overflow: "hidden" }}>
                      <img src={preset.imageUrl} alt={preset.species} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <div style={{ padding: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: "#EEF4EE" }}>{preset.species}</div>
                      <div style={{ fontSize: 10, color: "#8FA396", marginTop: 2 }}>{preset.zoneName}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bounding Box Image Preview Canvas */}
          {previewUrl && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <BoundingBoxCanvas
                imageUrl={previewUrl}
                detections={detectionResult?.detections || []}
                confidenceThreshold={confidenceThreshold}
                riskLevel={detectionResult?.risk?.risk_level || "HIGH"}
              />

              {/* Action Toolbar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--panel-raised)", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--line-soft)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#8FA396" }}>
                  <Sliders size={14} />
                  <span>Conf Threshold: <strong>{confidenceThreshold}%</strong></span>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                    style={{ accentColor: "#4CAF50", width: 100 }}
                  />
                </div>

                <button
                  onClick={() => runDetection()}
                  disabled={analyzing}
                  style={{
                    background: analyzing ? "#1B3B2B" : "#2E6B48",
                    border: "1px solid #4CAF50",
                    color: "#FFFFFF",
                    padding: "8px 18px",
                    borderRadius: 4,
                    cursor: analyzing ? "not-allowed" : "pointer",
                    fontSize: 13,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: "0 2px 8px rgba(46, 107, 72, 0.3)"
                  }}
                >
                  {analyzing ? (
                    <>
                      <RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} />
                      <span>Analyzing image...</span>
                    </>
                  ) : (
                    <>
                      <Play size={15} />
                      <span>DETECT WILDLIFE</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Info Banner when no wildlife is detected */}
          {infoMessage && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 16px", background: "rgba(76, 175, 80, 0.12)", border: "1px solid rgba(76, 175, 80, 0.4)", borderRadius: 6, color: "#A5D6A7", fontSize: 13 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={18} color="#4CAF50" style={{ flexShrink: 0 }} />
                <span>{infoMessage}</span>
              </div>
              <button
                onClick={() => { setInfoMessage(null); runDetection(); }}
                style={{ background: "#1B3B2B", border: "1px solid #4CAF50", color: "#EEF4EE", padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600 }}
              >
                Scan Again
              </button>
            </div>
          )}

          {/* Error / Diagnostic message with Retry */}
          {errorMessage && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 16px", background: "rgba(229, 77, 77, 0.12)", border: "1px solid rgba(229, 77, 77, 0.4)", borderRadius: 6, color: "#FFB0B0", fontSize: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <AlertTriangle size={18} color="#E54D4D" style={{ flexShrink: 0 }} />
                <div>{errorMessage}</div>
              </div>
              <button
                onClick={() => { checkBackendHealth(); runDetection(); }}
                style={{
                  background: "#E54D4D",
                  border: "none",
                  color: "#FFFFFF",
                  padding: "6px 14px",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  whiteSpace: "nowrap"
                }}
              >
                <RefreshCw size={12} />
                <span>Retry Detection</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Column: AI Detection & Conflict Risk Intelligence Results */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {detectionResult?.detected ? (
            <div className="kv-panel" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Header Badge */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#4CAF50", display: "flex", alignItems: "center", gap: 4 }}>
                    <CheckCircle2 size={13} /> DETECTION VERIFIED · ID: {detectionResult.detection_id}
                  </div>
                  <div style={{ fontSize: 12, color: "#8FA396", marginTop: 6, fontWeight: 600 }}>DETECTED ANIMAL:</div>
                  <h2 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 30, fontWeight: 800, margin: "2px 0 0", color: "#EEF4EE", display: "flex", alignItems: "center", gap: 8 }}>
                    <span>🐾</span> {detectionResult.species}
                  </h2>
                  <div style={{
                    marginTop: 6,
                    display: "inline-block",
                    padding: "3px 10px",
                    borderRadius: 4,
                    background: detectionResult.risk?.risk_level === "CRITICAL" || detectionResult.risk?.risk_level === "HIGH" ? "rgba(229, 77, 77, 0.2)" : "rgba(217, 154, 50, 0.2)",
                    border: `1px solid ${detectionResult.risk?.risk_level === "CRITICAL" || detectionResult.risk?.risk_level === "HIGH" ? "#E54D4D" : "#D99A32"}`,
                    color: detectionResult.risk?.risk_level === "CRITICAL" || detectionResult.risk?.risk_level === "HIGH" ? "#FF8A80" : "#F6D386",
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.05em"
                  }}>
                    STATUS: {detectionResult.status || `${detectionResult.risk?.risk_level || "HIGH"}-RISK WILDLIFE DETECTED`}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "#8FA396", fontWeight: 600 }}>CONFIDENCE:</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 26, fontWeight: 700, color: "#D6A84F" }}>
                    {detectionResult.confidence}%
                  </div>
                  <div style={{ fontSize: 10, color: "#8FA396" }}>YOLO INFERENCE</div>
                </div>
              </div>

              {/* Conflict Risk Score Banner */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 6,
                  background: detectionResult.risk?.risk_level === "CRITICAL" || detectionResult.risk?.risk_level === "HIGH"
                    ? "rgba(229, 77, 77, 0.12)"
                    : "rgba(217, 154, 50, 0.12)",
                  border: `1px solid ${
                    detectionResult.risk?.risk_level === "CRITICAL" || detectionResult.risk?.risk_level === "HIGH"
                      ? "rgba(229, 77, 77, 0.4)"
                      : "rgba(217, 154, 50, 0.4)"
                  }`
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#EEF4EE", display: "flex", alignItems: "center", gap: 6 }}>
                    <ShieldAlert size={16} color={detectionResult.risk?.risk_level === "HIGH" ? "#E54D4D" : "#D99A32"} />
                    CONFLICT RISK ASSESSMENT
                  </span>
                  <span
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontWeight: 800,
                      fontSize: 12,
                      padding: "2px 8px",
                      borderRadius: 3,
                      background: detectionResult.risk?.risk_level === "HIGH" ? "#E54D4D" : "#D99A32",
                      color: "#FFFFFF"
                    }}
                  >
                    {detectionResult.risk?.risk_level} ({detectionResult.risk?.risk_score}/100)
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#CCD8D0", lineHeight: 1.5 }}>
                  {detectionResult.risk?.reason}
                </div>
              </div>

              {/* Telemetry & Spatial Context */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ background: "var(--panel-raised)", padding: 10, borderRadius: 4, border: "1px solid var(--line-soft)" }}>
                  <div style={{ fontSize: 10, color: "#8FA396", fontFamily: "'IBM Plex Mono', monospace" }}>LOCATION COORDS</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#EEF4EE", marginTop: 2 }}>
                    {detectionResult.lat?.toFixed(4)}, {detectionResult.lng?.toFixed(4)}
                  </div>
                </div>

                <div style={{ background: "var(--panel-raised)", padding: 10, borderRadius: 4, border: "1px solid var(--line-soft)" }}>
                  <div style={{ fontSize: 10, color: "#8FA396", fontFamily: "'IBM Plex Mono', monospace" }}>DISTANCE TO SETTLEMENT</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#D6A84F", marginTop: 2 }}>
                    ~{detectionResult.geofence?.est_dist_to_settlement_m || 350} meters
                  </div>
                </div>
              </div>

              {/* Geofence Status */}
              <div style={{ background: "var(--panel-raised)", padding: 12, borderRadius: 4, border: "1px solid var(--line-soft)" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#8FA396", marginBottom: 4 }}>GEOFENCE STATUS:</div>
                {detectionResult.geofence?.has_breach ? (
                  <div style={{ color: "#E57373", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertTriangle size={14} /> Active Geofence Breach: {detectionResult.geofence.breached_geofences[0]?.name}
                  </div>
                ) : (
                  <div style={{ color: "#4CAF50", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <CheckCircle2 size={14} /> Within Designated Sanctuary Corridor (No Breach)
                  </div>
                )}
              </div>

              {/* Action Recommendation */}
              <div style={{ background: "rgba(46, 107, 72, 0.15)", border: "1px solid #2F6B48", padding: 12, borderRadius: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#A4C7B0", textTransform: "uppercase" }}>
                  RECOMMENDED RANGER DISPATCH
                </div>
                <div style={{ fontSize: 12, color: "#EEF4EE", marginTop: 4 }}>
                  {detectionResult.risk?.recommendation}
                </div>
              </div>

              {/* Navigation Button */}
              <button
                onClick={() => onNavigateToMap?.({ lat: detectionResult.lat, lng: detectionResult.lng })}
                style={{
                  background: "#1E3D2A",
                  border: "1px solid #3A7350",
                  color: "#D2E8DA",
                  padding: "10px 16px",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  marginTop: 4
                }}
              >
                <span>Plot & Track on Live GIS Map</span>
                <ArrowRight size={14} />
              </button>
            </div>
          ) : detectionResult && !detectionResult.detected ? (
            <div className="kv-panel" style={{ padding: 28, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 380, border: "1px solid #2F6B48" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(76, 175, 80, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <CheckCircle2 size={32} color="#4CAF50" />
              </div>
              <div style={{ fontSize: 12, color: "#8FA396", fontWeight: 700, textTransform: "uppercase" }}>SCAN STATUS:</div>
              <h3 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 24, fontWeight: 800, color: "#81C784", margin: "4px 0" }}>
                NO WILDLIFE DETECTED
              </h3>
              <div style={{
                marginTop: 6,
                padding: "3px 12px",
                borderRadius: 4,
                background: "rgba(76, 175, 80, 0.1)",
                border: "1px solid rgba(76, 175, 80, 0.3)",
                color: "#A5D6A7",
                fontSize: 11,
                fontWeight: 700
              }}>
                STATUS: NO TARGET WILDLIFE DETECTED
              </div>
              <p style={{ fontSize: 13, color: "#A4C7B0", maxWidth: 380, lineHeight: 1.6, marginTop: 12 }}>
                YOLO evaluated the image against the 10 target dangerous wildlife species at threshold {confidenceThreshold}%. No approved target was identified. Non-target animals/objects do not trigger alerts.
              </p>
              <div style={{ marginTop: 14, padding: "8px 16px", background: "var(--panel-raised)", borderRadius: 6, fontSize: 12, color: "#8FA396", fontFamily: "'IBM Plex Mono', monospace" }}>
                Risk Score: 0/100 (NONE) · Alert Dispatched: NONE
              </div>
            </div>
          ) : (
            <div className="kv-panel" style={{ padding: 32, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 380 }}>
              <Camera size={44} color="#2A4837" style={{ marginBottom: 12 }} />
              <h3 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 18, color: "#EEF4EE", margin: 0 }}>
                Awaiting Wildlife Observation
              </h3>
              <p style={{ fontSize: 12, color: "#8FA396", maxWidth: 320, lineHeight: 1.5, marginTop: 8 }}>
                Upload an image, activate your live camera, or click one of the preset wildlife samples above to execute YOLO detection and risk intelligence.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
