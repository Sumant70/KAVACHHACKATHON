import React, { useState, useEffect } from "react";
import {
  Camera, Radio, Video, Search, Filter, ShieldAlert, Eye,
  MapPin, CheckCircle2, Clock, X, ExternalLink, RefreshCw
} from "lucide-react";
import { API_BASE_URL } from "../KavachApp";

export default function DetectionHistoryView({ onNavigate }) {
  const [detections, setDetections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState("ALL"); // "ALL" | "IMAGE" | "LIVE_CAMERA" | "CCTV"
  const [speciesFilter, setSpeciesFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDetection, setSelectedDetection] = useState(null);

  const fetchDetections = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/detections?limit=100`);
      const data = await res.json();
      if (data.success && data.detections) {
        setDetections(data.detections);
      }
    } catch (err) {
      console.warn("Failed to load detection events:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetections();
  }, []);

  const filtered = detections.filter(d => {
    if (sourceFilter !== "ALL") {
      const src = d.source || "IMAGE";
      if (src !== sourceFilter) return false;
    }
    if (speciesFilter !== "ALL") {
      if (d.species !== speciesFilter) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        d.id?.toLowerCase().includes(q) ||
        d.species?.toLowerCase().includes(q) ||
        d.village_name?.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                Raw AI Detection Telemetry Stream
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">
                  {detections.length} RAW DETECTIONS
                </span>
              </h1>
              <p className="text-slate-400 text-sm mt-0.5">
                Granular optical telemetry from uploaded images, browser webcam frames & automated CCTV background worker loops
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchDetections}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-sm font-medium transition flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Refresh Log
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Modality Source Filter Pills */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
          {[
            { id: "ALL", label: "All Modalities" },
            { id: "IMAGE", label: "📷 Image Upload" },
            { id: "LIVE_CAMERA", label: "🎥 Live Camera" },
            { id: "CCTV", label: "📹 CCTV Ingest" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSourceFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                sourceFilter === tab.id
                  ? "bg-purple-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by ID, species, village..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3.5 py-1.5 text-white text-xs focus:outline-none focus:border-purple-500 w-56"
            />
          </div>

          <select
            value={speciesFilter}
            onChange={(e) => setSpeciesFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-purple-500"
          >
            <option value="ALL">All Species</option>
            <option value="Tiger">Tiger</option>
            <option value="Leopard">Leopard</option>
            <option value="Asian Elephant">Asian Elephant</option>
            <option value="Lion">Lion</option>
            <option value="Wild Boar">Wild Boar</option>
            <option value="Sloth Bear">Sloth Bear</option>
          </select>
        </div>
      </div>

      {/* Detections Table */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3.5">ID / Time</th>
                <th className="p-3.5">Ingest Source</th>
                <th className="p-3.5">Target Species</th>
                <th className="p-3.5">AI Confidence</th>
                <th className="p-3.5">Village Settlement</th>
                <th className="p-3.5">Risk Score</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No raw detection logs found matching criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((det) => {
                  const source = det.source || "IMAGE";
                  return (
                    <tr key={det.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3.5">
                        <div className="font-mono font-bold text-white">{det.id}</div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{det.timestamp}</span>
                        </div>
                      </td>

                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          source === "LIVE_CAMERA"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : source === "CCTV"
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                            : "bg-purple-500/10 text-purple-400 border-purple-500/30"
                        }`}>
                          {source === "LIVE_CAMERA" ? <Radio className="w-3 h-3" /> :
                           source === "CCTV" ? <Video className="w-3 h-3" /> :
                           <Camera className="w-3 h-3" />}
                          <span>{source}</span>
                        </span>
                      </td>

                      <td className="p-3.5">
                        <div className="font-bold text-white">{det.species}</div>
                        <div className="text-[10px] text-slate-400 font-mono">class: {det.class_name}</div>
                      </td>

                      <td className="p-3.5">
                        <div className="font-mono font-bold text-emerald-400">{det.confidence}%</div>
                        <div className="text-[10px] text-slate-500">YOLO 5-class/11n</div>
                      </td>

                      <td className="p-3.5">
                        <div className="font-medium text-slate-200 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>{det.village_name || "Forest Buffer Zone"}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {det.lat?.toFixed(3)}°N, {det.lng?.toFixed(3)}°E
                        </div>
                      </td>

                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                          det.risk_level === "CRITICAL"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            : det.risk_level === "HIGH"
                            ? "bg-orange-500/10 text-orange-400 border-orange-500/30"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        }`}>
                          {det.risk_score || 50}/100 ({det.risk_level || "MEDIUM"})
                        </span>
                      </td>

                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => setSelectedDetection(det)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" /> Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detection Inspection Modal */}
      {selectedDetection && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-purple-400 font-bold">{selectedDetection.id}</span>
                <span className="text-white font-bold text-sm">• {selectedDetection.species} ({selectedDetection.confidence}%)</span>
              </div>
              <button
                onClick={() => setSelectedDetection(null)}
                className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Snapshot image preview if available */}
              {selectedDetection.image_path && (
                <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
                  <img
                    src={`${API_BASE_URL}${selectedDetection.image_path}`}
                    alt="Snapshot"
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                  <span className="text-slate-400">Ingest Source:</span>
                  <div className="text-white font-bold mt-0.5">{selectedDetection.source || "IMAGE"}</div>
                </div>
                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                  <span className="text-slate-400">Captured At:</span>
                  <div className="text-white font-bold mt-0.5">{selectedDetection.timestamp}</div>
                </div>
                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                  <span className="text-slate-400">Target Village:</span>
                  <div className="text-white font-bold mt-0.5">{selectedDetection.village_name || "Buffer Zone"}</div>
                </div>
                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                  <span className="text-slate-400">Risk Assessment:</span>
                  <div className="text-amber-400 font-bold mt-0.5">{selectedDetection.risk_score}/100 ({selectedDetection.risk_level})</div>
                </div>
              </div>

              {selectedDetection.bbox && selectedDetection.bbox.length > 0 && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400">
                  Bounding Box (y1, x1, y2, x2): {JSON.stringify(selectedDetection.bbox)}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedDetection(null)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold transition"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
