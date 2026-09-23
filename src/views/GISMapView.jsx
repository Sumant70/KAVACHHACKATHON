import React, { useState, useEffect, useRef } from "react";
import {
  MapContainer, TileLayer, Marker, Popup, Circle, Polygon, Tooltip, useMap
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  Layers, MapPin, ZoomIn, ZoomOut, Compass, Search, Eye, Filter,
  ShieldAlert, AlertTriangle, CheckCircle2, Crosshair, Radio, RefreshCw,
  Video, Users, PhoneCall
} from "lucide-react";
import { API_BASE_URL } from "../KavachApp";

// Fix standard Leaflet default icon paths in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom Risk Marker
const createCustomMarker = (color, isCritical = false) => {
  return L.divIcon({
    className: "kavach-leaflet-marker",
    html: `
      <div style="
        position: relative;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: ${color};
        border: 2.5px solid #FFFFFF;
        box-shadow: 0 0 ${isCritical ? "16px #E54D4D" : "8px rgba(0,0,0,0.5)"};
        display: flex;
        align-items: center;
        justify-content: center;
        ${isCritical ? "animation: pulse 1.2s infinite;" : ""}
      ">
        <div style="width: 8px; height: 8px; border-radius: 50%; background: #FFFFFF;"></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });
};

// Custom Village Settlement Marker
const villageIcon = L.divIcon({
  className: "kavach-village-marker",
  html: `
    <div style="
      position: relative;
      width: 32px;
      height: 32px;
      border-radius: 10px;
      background: #059669;
      border: 2px solid #FFFFFF;
      box-shadow: 0 0 12px rgba(5, 150, 105, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
      font-size: 16px;
    ">
      🏡
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

// Custom CCTV Camera Marker
const cctvCameraIcon = L.divIcon({
  className: "kavach-cctv-marker",
  html: `
    <div style="
      position: relative;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: #2563EB;
      border: 2px solid #FFFFFF;
      box-shadow: 0 0 12px rgba(37, 99, 235, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
      font-size: 14px;
    ">
      📹
    </div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -15]
});

const userLocationIcon = L.divIcon({
  className: "kavach-user-gps-marker",
  html: `
    <div style="
      position: relative;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #2196F3;
      border: 3px solid #FFFFFF;
      box-shadow: 0 0 14px rgba(33, 150, 243, 0.8);
    ">
      <div style="position: absolute; inset: -8px; border-radius: 50%; border: 2px solid rgba(33, 150, 243, 0.4); animation: pulse 2s infinite;"></div>
    </div>
  `,
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});

// Indian Forest Protected Areas
const PROTECTED_RESERVES = [
  {
    name: "Tadoba-Andhari Tiger Reserve",
    state: "Maharashtra",
    center: [20.2667, 79.4000],
    polygon: [
      [20.35, 79.30], [20.38, 79.48], [20.22, 79.52], [20.15, 79.35]
    ],
    color: "#2E7D32"
  },
  {
    name: "Jim Corbett National Park",
    state: "Uttarakhand",
    center: [29.5300, 78.7740],
    polygon: [
      [29.62, 78.68], [29.65, 78.90], [29.45, 78.95], [29.42, 78.72]
    ],
    color: "#2E7D32"
  },
  {
    name: "Sanjay Gandhi National Park",
    state: "Maharashtra",
    center: [19.2500, 72.9170],
    polygon: [
      [19.28, 72.88], [19.30, 72.95], [19.20, 72.96], [19.18, 72.90]
    ],
    color: "#388E3C"
  }
];

function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || 10, { animate: true });
    }
  }, [center, zoom, map]);
  return null;
}

export default function GISMapView({
  apiBaseUrl,
  detections = [],
  incidents = [],
  geofences = [],
  userGps,
  targetCoords
}) {
  const effectiveApiUrl = apiBaseUrl || API_BASE_URL;
  const [tileLayer, setTileLayer] = useState("satellite"); // "satellite" | "osm" | "topo"
  const [showReserves, setShowReserves] = useState(true);
  const [showVillages, setShowVillages] = useState(true);
  const [showCameras, setShowCameras] = useState(true);
  const [showDetections, setShowDetections] = useState(true);
  const [riskFilter, setRiskFilter] = useState("all");

  const [villages, setVillages] = useState([]);
  const [cameras, setCameras] = useState([]);

  const [mapCenter, setMapCenter] = useState(targetCoords || [20.2667, 79.4000]);
  const [mapZoom, setMapZoom] = useState(targetCoords ? 12 : 10);
  const [selectedItem, setSelectedItem] = useState(null);

  // Fetch Villages and CCTV Cameras from Backend
  useEffect(() => {
    fetch(`${effectiveApiUrl}/api/villages`)
      .then(r => r.json())
      .then(d => { if (d.villages) setVillages(d.villages); })
      .catch(e => console.warn("Failed to load villages for GIS:", e));

    fetch(`${effectiveApiUrl}/api/cameras`)
      .then(r => r.json())
      .then(d => { if (d.cameras) setCameras(d.cameras); })
      .catch(e => console.warn("Failed to load cameras for GIS:", e));
  }, [effectiveApiUrl]);

  useEffect(() => {
    if (targetCoords) {
      setMapCenter(targetCoords);
      setMapZoom(12);
    }
  }, [targetCoords]);

  const tileUrls = {
    satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    osm: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    topo: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
  };

  const filteredDetections = detections.filter(d => {
    if (riskFilter === "all") return true;
    return d.risk_level === riskFilter;
  });

  const getMarkerIcon = (riskLevel) => {
    switch (riskLevel?.toUpperCase()) {
      case "CRITICAL": return createCustomMarker("#E54D4D", true);
      case "HIGH": return createCustomMarker("#E55C5C");
      case "MEDIUM": return createCustomMarker("#D99A32");
      case "LOW":
      default: return createCustomMarker("#4CAF50");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "calc(100vh - 120px)", minHeight: 620 }}>
      {/* Top Map Control Bar */}
      <div className="kv-panel" style={{ padding: "10px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 16, color: "#EEF4EE", fontFamily: "'Rajdhani', sans-serif" }}>
            <Compass size={18} color="#D6A84F" />
            GEOSPATIAL WILDLIFE COMMAND GIS
          </div>

          <span style={{ fontSize: 11, color: "#8FA396", fontFamily: "'IBM Plex Mono', monospace" }}>
            {villages.length} VILLAGES • {cameras.length} CCTV • {filteredDetections.length} SIGHTINGS
          </span>
        </div>

        {/* Map Layers & Filters */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Tile Layer Selector */}
          <div style={{ display: "flex", background: "var(--panel-raised)", borderRadius: 4, border: "1px solid var(--line-soft)", padding: 2 }}>
            <button
              onClick={() => setTileLayer("satellite")}
              style={{
                background: tileLayer === "satellite" ? "#1B3B2B" : "transparent",
                border: "none",
                color: tileLayer === "satellite" ? "#4CAF50" : "#8FA396",
                padding: "4px 8px",
                borderRadius: 3,
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600
              }}
            >
              Satellite
            </button>
            <button
              onClick={() => setTileLayer("osm")}
              style={{
                background: tileLayer === "osm" ? "#1B3B2B" : "transparent",
                border: "none",
                color: tileLayer === "osm" ? "#4CAF50" : "#8FA396",
                padding: "4px 8px",
                borderRadius: 3,
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600
              }}
            >
              OSM Streets
            </button>
            <button
              onClick={() => setTileLayer("topo")}
              style={{
                background: tileLayer === "topo" ? "#1B3B2B" : "transparent",
                border: "none",
                color: tileLayer === "topo" ? "#4CAF50" : "#8FA396",
                padding: "4px 8px",
                borderRadius: 3,
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600
              }}
            >
              Terrain Topo
            </button>
          </div>

          {/* Layer Toggles */}
          <button
            onClick={() => setShowVillages(!showVillages)}
            style={{
              background: showVillages ? "#1B3B2B" : "transparent",
              border: "1px solid #234634",
              color: showVillages ? "#10B981" : "#8FA396",
              padding: "4px 8px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 11
            }}
          >
            Villages & Zones {showVillages ? "ON" : "OFF"}
          </button>

          <button
            onClick={() => setShowCameras(!showCameras)}
            style={{
              background: showCameras ? "#1B3B2B" : "transparent",
              border: "1px solid #234634",
              color: showCameras ? "#3B82F6" : "#8FA396",
              padding: "4px 8px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 11
            }}
          >
            CCTV Cameras {showCameras ? "ON" : "OFF"}
          </button>

          <button
            onClick={() => setShowDetections(!showDetections)}
            style={{
              background: showDetections ? "#1B3B2B" : "transparent",
              border: "1px solid #234634",
              color: showDetections ? "#EF4444" : "#8FA396",
              padding: "4px 8px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 11
            }}
          >
            Sightings {showDetections ? "ON" : "OFF"}
          </button>

          {/* Recenter button */}
          {userGps && (
            <button
              onClick={() => { setMapCenter([userGps.lat, userGps.lng]); setMapZoom(13); }}
              title="Fly to My Location"
              style={{
                background: "#1E382B",
                border: "1px solid #36664D",
                color: "#64B5F6",
                padding: "4px 10px",
                borderRadius: 4,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 600
              }}
            >
              <Crosshair size={13} /> My GPS
            </button>
          )}
        </div>
      </div>

      {/* Main Map Viewport */}
      <div style={{ flex: 1, position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid #1D3B2A" }}>
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ width: "100%", height: "100%" }}
          zoomControl={true}
        >
          <MapController center={mapCenter} zoom={mapZoom} />

          <TileLayer
            url={tileUrls[tileLayer]}
            attribution='&copy; KAVACH Wildlife GIS | OpenStreetMap | Esri'
            maxZoom={18}
          />

          {/* User Live GPS Marker */}
          {userGps && (
            <>
              <Marker position={[userGps.lat, userGps.lng]} icon={userLocationIcon}>
                <Popup>
                  <div style={{ color: "#0B1712", fontFamily: "sans-serif" }}>
                    <strong>Current Field Unit Location</strong><br />
                    Lat: {userGps.lat?.toFixed(5)}<br />
                    Lng: {userGps.lng?.toFixed(5)}<br />
                    Accuracy: ±{Math.round(userGps.accuracy)}m
                  </div>
                </Popup>
              </Marker>
              <Circle
                center={[userGps.lat, userGps.lng]}
                radius={userGps.accuracy || 20}
                pathOptions={{ color: "#2196F3", fillColor: "#2196F3", fillOpacity: 0.15, weight: 1 }}
              />
            </>
          )}

          {/* Protected Reserves Polygons */}
          {showReserves && PROTECTED_RESERVES.map((res) => (
            <Polygon
              key={res.name}
              positions={res.polygon}
              pathOptions={{
                color: "#4CAF50",
                fillColor: "#4CAF50",
                fillOpacity: 0.12,
                weight: 2,
                dashArray: "4, 6"
              }}
            >
              <Tooltip sticky>
                <div>
                  <strong>{res.name}</strong><br />
                  State: {res.state}
                </div>
              </Tooltip>
            </Polygon>
          ))}

          {/* Villages with Concentric Buffers (Safe, Warning, Danger) */}
          {showVillages && villages.map((v) => {
            if (!v.lat || !v.lng) return null;
            const center = [v.lat, v.lng];

            return (
              <React.Fragment key={v.id}>
                {/* 1. Safe Zone Outer Perimeter (3000m) */}
                <Circle
                  center={center}
                  radius={3000}
                  pathOptions={{
                    color: "#10B981",
                    fillColor: "#10B981",
                    fillOpacity: 0.04,
                    weight: 1,
                    dashArray: "6, 8"
                  }}
                />

                {/* 2. Warning Zone Concentric Buffer (1500m) */}
                <Circle
                  center={center}
                  radius={v.alert_radius_m || 1500}
                  pathOptions={{
                    color: "#F59E0B",
                    fillColor: "#F59E0B",
                    fillOpacity: 0.08,
                    weight: 1.5,
                    dashArray: "4, 6"
                  }}
                />

                {/* 3. Danger Zone Core Buffer (500m) */}
                <Circle
                  center={center}
                  radius={500}
                  pathOptions={{
                    color: "#EF4444",
                    fillColor: "#EF4444",
                    fillOpacity: 0.15,
                    weight: 2
                  }}
                />

                {/* Village Settlement Marker */}
                <Marker position={center} icon={villageIcon}>
                  <Popup>
                    <div style={{ color: "#0B1712", fontFamily: "sans-serif", maxWidth: 220 }}>
                      <h4 style={{ margin: "0 0 4px", color: "#059669", fontWeight: "bold" }}>{v.name}</h4>
                      <div style={{ fontSize: 11, color: "#444", marginBottom: 4 }}>
                        {v.district}, {v.state}
                      </div>
                      <div style={{ fontSize: 11, marginBottom: 2 }}>
                        👥 Population: <strong>{v.registered_users || 120} residents</strong>
                      </div>
                      <div style={{ fontSize: 11, marginBottom: 4 }}>
                        🚨 Active Threats: <strong>{v.active_alerts_count || 0}</strong>
                      </div>
                      <div style={{ fontSize: 11, marginBottom: 2 }}>
                        📞 Helpline: <strong style={{ color: "#059669" }}>{v.emergency_contact}</strong>
                      </div>
                      <div style={{ fontSize: 10, color: "#666", marginTop: 4, paddingTop: 4, borderTop: "1px solid #eee" }}>
                        Concentric Zones: 500m Danger / 1500m Warning / 3000m Safe
                      </div>
                    </div>
                  </Popup>
                  <Tooltip sticky>
                    <strong>{v.name}</strong> ({v.active_alerts_count > 0 ? "⚠️ Alert" : "🟢 Secure"})
                  </Tooltip>
                </Marker>
              </React.Fragment>
            );
          })}

          {/* CCTV Camera Markers */}
          {showCameras && cameras.map((cam) => {
            if (!cam.lat || !cam.lng) return null;
            const isLive = cam.is_streaming || cam.status === "ONLINE";

            return (
              <Marker
                key={cam.id}
                position={[cam.lat, cam.lng]}
                icon={cctvCameraIcon}
              >
                <Popup>
                  <div style={{ color: "#0B1712", fontFamily: "sans-serif", width: 220 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <strong style={{ color: "#2563EB" }}>{cam.name}</strong>
                      <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: isLive ? "#DCFCE7" : "#FEE2E2", color: isLive ? "#166534" : "#991B1B", fontWeight: 700 }}>
                        {isLive ? "ONLINE" : "OFFLINE"}
                      </span>
                    </div>

                    <div style={{ fontSize: 11, color: "#555", marginBottom: 6 }}>
                      {cam.forest_range} • {cam.fps || 15} FPS
                    </div>

                    {isLive && (
                      <div style={{ borderRadius: 6, overflow: "hidden", background: "#000", height: 110, marginBottom: 4 }}>
                        <img
                          src={`${API_BASE_URL}/api/cameras/${cam.id}/frame?t=${Date.now()}`}
                          alt={cam.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </div>
                    )}

                    {cam.latest_detection && (
                      <div style={{ fontSize: 10, color: "#D97706", fontWeight: "bold" }}>
                        Latest: {cam.latest_detection} ({cam.latest_confidence || 88}%)
                      </div>
                    )}
                  </div>
                </Popup>
                <Tooltip sticky>
                  <span>{cam.name} ({cam.id})</span>
                </Tooltip>
              </Marker>
            );
          })}

          {/* Wildlife Detection Markers */}
          {showDetections && filteredDetections.map((det) => {
            if (!det.lat || !det.lng) return null;
            return (
              <Marker
                key={det.id}
                position={[det.lat, det.lng]}
                icon={getMarkerIcon(det.risk_level)}
                eventHandlers={{
                  click: () => setSelectedItem(det)
                }}
              >
                <Popup>
                  <div style={{ color: "#0B1712", fontFamily: "sans-serif", maxWidth: 220 }}>
                    <h4 style={{ margin: "0 0 4px", color: "#1B3B2B" }}>{det.species}</h4>
                    <div style={{ fontSize: 11, marginBottom: 4 }}>
                      Confidence: <strong>{det.confidence}%</strong>
                    </div>
                    <div style={{ fontSize: 11, marginBottom: 4 }}>
                      Risk Level: <strong style={{ color: det.risk_level === "HIGH" ? "#D32F2F" : "#F57C00" }}>{det.risk_level} ({det.risk_score}/100)</strong>
                    </div>
                    {det.distance_str && (
                      <div style={{ fontSize: 11, color: "#166534", marginBottom: 4, fontWeight: "bold" }}>
                        📍 {det.distance_str}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>
                      Detection source: {det.camera_id ? `Camera ${det.camera_id} (Approximate camera location)` : `${det.source || "Image Upload"} (Approximate location)`}<br />
                      Timestamp: {det.timestamp}
                    </div>
                    {det.image_path && (
                      <img src={`${effectiveApiUrl}${det.image_path}`} alt={det.species} style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 4, marginTop: 6 }} />
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Map Legend Overlay */}
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: 16,
            zIndex: 1000,
            background: "rgba(10, 20, 15, 0.92)",
            backdropFilter: "blur(6px)",
            border: "1px solid #1E382A",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 11,
            color: "#EEF4EE",
            display: "flex",
            flexDirection: "column",
            gap: 5
          }}
        >
          <div style={{ fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#8FA396", marginBottom: 2 }}>
            GIS CONCENTRIC GEO-FENCE LEGEND
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14 }}>🏡</span>
            <span>Village Settlement</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#EF4444" }} />
            <span>500m Danger Zone Buffer</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#F59E0B" }} />
            <span>1500m Warning Zone Buffer</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#10B981" }} />
            <span>3000m Safe Zone Perimeter</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14 }}>📹</span>
            <span>CCTV / RTSP Camera Post</span>
          </div>
        </div>
      </div>
    </div>
  );
}
