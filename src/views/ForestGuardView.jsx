import React, { useState, useEffect } from "react";
import {
  ShieldCheck, AlertTriangle, CheckCircle2, Clock, MapPin,
  Camera, MessageSquare, ArrowRight, UserCheck, RefreshCw,
  Send, FileText, Check, Layers, Radio
} from "lucide-react";
import { API_BASE_URL } from "../KavachApp";

export default function ForestGuardView({ onNavigate }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("ACTIVE"); // "ACTIVE" | "RESOLVED" | "ALL"
  const [selectedIncident, setSelectedIncident] = useState(null);

  // Lifecycle Update Form State
  const [guardNotes, setGuardNotes] = useState("");
  const [guardName, setGuardName] = useState("Beat Guard S. Jadhav (Range 4)");
  const [updating, setUpdating] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);

  const fetchIncidents = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/incidents`);
      const data = await res.json();
      if (data.success && data.incidents) {
        setIncidents(data.incidents);
        if (!selectedIncident && data.incidents.length > 0) {
          setSelectedIncident(data.incidents[0]);
        }
      }
    } catch (err) {
      console.warn("Failed to load incidents:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 8000);
    return () => clearInterval(interval);
  }, []);

  // Update Incident Lifecycle
  const advanceLifecycle = async (newStage) => {
    if (!selectedIncident) return;
    setUpdating(true);
    setActionSuccess(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/incidents/${selectedIncident.id}/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: newStage,
          officer_name: guardName,
          notes: guardNotes || `Guard advanced status to ${newStage}`
        })
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(`Status updated to ${newStage} successfully.`);
        setGuardNotes("");
        await fetchIncidents();
        // Update local selected incident state
        setSelectedIncident(prev => ({
          ...prev,
          status: newStage
        }));
      }
    } catch (err) {
      console.warn("Lifecycle transition failed:", err);
    } finally {
      setUpdating(false);
    }
  };

  const filtered = incidents.filter(i => {
    if (activeFilter === "ACTIVE") return i.status !== "RESOLVED";
    if (activeFilter === "RESOLVED") return i.status === "RESOLVED";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Guard Header */}
      <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              Forest Beat Guard Field Action Terminal
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                ACTIVE ON BEAT PATROL
              </span>
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Field officer response queue: verify sightings, update investigation status & resolve community conflict alerts
            </p>
          </div>
        </div>

        {/* Guard Identity Badge */}
        <div className="flex items-center gap-3 bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700">
          <UserCheck className="w-4 h-4 text-emerald-400" />
          <div className="text-xs">
            <span className="text-slate-400">Officer:</span>{" "}
            <span className="text-white font-semibold">{guardName}</span>
          </div>
        </div>
      </div>

      {/* Incident Queue & Lifecycle Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Incident List Column */}
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center bg-slate-900 p-1.5 rounded-xl border border-slate-800 gap-1">
            <button
              onClick={() => setActiveFilter("ACTIVE")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeFilter === "ACTIVE"
                  ? "bg-emerald-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Active Tasks ({incidents.filter(i => i.status !== "RESOLVED").length})
            </button>
            <button
              onClick={() => setActiveFilter("RESOLVED")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeFilter === "RESOLVED"
                  ? "bg-emerald-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Resolved ({incidents.filter(i => i.status === "RESOLVED").length})
            </button>
            <button
              onClick={() => setActiveFilter("ALL")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeFilter === "ALL"
                  ? "bg-emerald-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              All ({incidents.length})
            </button>
          </div>

          {/* Incidents Scrollable List */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 text-center text-slate-400 text-xs">
                No incidents match the selected filter.
              </div>
            ) : (
              filtered.map((inc) => {
                const isSelected = selectedIncident?.id === inc.id;
                return (
                  <div
                    key={inc.id}
                    onClick={() => setSelectedIncident(inc)}
                    className={`p-4 rounded-2xl border cursor-pointer transition ${
                      isSelected
                        ? "bg-slate-800 border-emerald-500/80 shadow-lg shadow-emerald-500/10"
                        : "bg-slate-900/70 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-emerald-400 font-bold">
                        {inc.incident_code || inc.id}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        inc.status === "RESOLVED"
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                          : inc.status === "INVESTIGATING"
                          ? "bg-blue-500/10 text-blue-300 border-blue-500/30"
                          : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                      }`}>
                        {inc.status}
                      </span>
                    </div>

                    <h4 className="font-bold text-white text-sm mt-1">{inc.title || `${inc.animal} Movement`}</h4>
                    
                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{inc.village_name || "Buffer Zone"}</span>
                      <span>•</span>
                      <span>{inc.timestamp}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Incident Detail & Lifecycle Action Card */}
        <div className="lg:col-span-2 space-y-4">
          {selectedIncident ? (
            <div className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">
                      {selectedIncident.incident_code || selectedIncident.id}
                    </span>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                      selectedIncident.risk_level === "CRITICAL"
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    }`}>
                      {selectedIncident.risk_level} RISK
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-white mt-1.5">{selectedIncident.title}</h2>
                </div>

                <div className="text-left sm:text-right text-xs text-slate-400">
                  <div>First Detected: <span className="text-white font-medium">{selectedIncident.timestamp}</span></div>
                  <div>Reported By: <span className="text-white font-medium">{selectedIncident.reporter}</span></div>
                </div>
              </div>

              {/* Status Stepper Lifecycle Visualizer */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Guard Response Lifecycle Progression
                </div>
                <div className="grid grid-cols-5 gap-1.5 text-center text-xs font-semibold">
                  {[
                    { label: "1. ALERT", stage: "NEW" },
                    { label: "2. ACKNOWLEDGED", stage: "ACKNOWLEDGED" },
                    { label: "3. INVESTIGATING", stage: "INVESTIGATING" },
                    { label: "4. CONFIRMED", stage: "CONFIRMED" },
                    { label: "5. RESOLVED", stage: "RESOLVED" }
                  ].map((step, idx) => {
                    const isDone =
                      (selectedIncident.status === "RESOLVED") ||
                      (selectedIncident.status === "CONFIRMED" && idx <= 3) ||
                      (selectedIncident.status === "INVESTIGATING" && idx <= 2) ||
                      (selectedIncident.status === "ACKNOWLEDGED" && idx <= 1) ||
                      (selectedIncident.status === "NEW" && idx === 0);

                    const isCurrent =
                      (selectedIncident.status === step.stage) ||
                      (selectedIncident.status === "NEW" && idx === 0);

                    return (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-xl border transition ${
                          isCurrent
                            ? "bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-600/30"
                            : isDone
                            ? "bg-emerald-950/40 text-emerald-300 border-emerald-800"
                            : "bg-slate-800 text-slate-500 border-slate-700"
                        }`}
                      >
                        <div className="text-[10px] opacity-80">{step.label.split(" ")[0]}</div>
                        <div className="text-xs font-bold truncate">{step.label.split(" ")[1]}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Success Alert */}
              {actionSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-600/60 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{actionSuccess}</span>
                </div>
              )}

              {/* Guard Action Form */}
              <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800/80 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Execute Field Action
                </h4>

                <div>
                  <label className="text-xs text-slate-400 font-medium">Field Verification Notes / Observations</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Verified pugmarks heading east. Alerted Rajpur village patrol and deployed acoustic sirens."
                    value={guardNotes}
                    onChange={(e) => setGuardNotes(e.target.value)}
                    className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Lifecycle Advance Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => advanceLifecycle("ACKNOWLEDGED")}
                    disabled={updating}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
                  >
                    Mark Acknowledged
                  </button>
                  <button
                    onClick={() => advanceLifecycle("INVESTIGATING")}
                    disabled={updating}
                    className="px-3.5 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-semibold transition"
                  >
                    Start Investigating (On-Site)
                  </button>
                  <button
                    onClick={() => advanceLifecycle("CONFIRMED")}
                    disabled={updating}
                    className="px-3.5 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold transition"
                  >
                    Confirm Sighting
                  </button>
                  <button
                    onClick={() => advanceLifecycle("RESOLVED")}
                    disabled={updating}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 ml-auto"
                  >
                    <Check className="w-3.5 h-3.5" /> Mark Resolved
                  </button>
                </div>
              </div>

              {/* Incident Timeline Audit Log */}
              {selectedIncident.timeline && selectedIncident.timeline.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Audit Timeline
                  </h4>
                  <div className="space-y-2">
                    {selectedIncident.timeline.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-slate-800/40 rounded-xl border border-slate-700/40 flex items-start gap-3 text-xs"
                      >
                        <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-white">{item.stage}</span>{" "}
                          <span className="text-slate-400 text-[11px]">({item.time})</span>
                          <p className="text-slate-300 text-xs mt-0.5">{item.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-900/60 p-12 rounded-3xl border border-slate-800 text-center text-slate-400">
              Select an incident from the queue to view details and execute response.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
