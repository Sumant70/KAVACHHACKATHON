import React, { useState, useEffect } from "react";
import {
  ShieldAlert, CheckCircle2, AlertTriangle, PhoneCall, Camera,
  MapPin, Clock, ArrowRight, Upload, Info, HeartHandshake, Eye,
  RefreshCw, Check, Sparkles, Volume2
} from "lucide-react";
import { API_BASE_URL } from "../KavachApp";
import { playEmergencyAlarm } from "../components/AudioAlerts";

export default function VillagerPortalView({ onNavigate }) {
  const [villages, setVillages] = useState([]);
  const [selectedVillageId, setSelectedVillageId] = useState("VIL-01");
  const [villageStatus, setVillageStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sighting Report Form State
  const [reportForm, setReportForm] = useState({
    reporter_name: "",
    reporter_contact: "",
    animal_reported: "Tiger",
    description: "",
    photo: null
  });
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportResult, setReportResult] = useState(null);

  // 1. Fetch Villages list
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/villages`)
      .then(r => r.json())
      .then(data => {
        if (data.villages) setVillages(data.villages);
      })
      .catch(err => console.warn("Failed to fetch villages:", err));
  }, []);

  // 2. Fetch Status for Selected Village
  const fetchVillageStatus = async (vId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/villager/status?village_id=${vId}`);
      const data = await res.json();
      if (data.success) {
        setVillageStatus(data);
        if (data.has_active_threat && data.threat_level === "DANGER") {
          try { playEmergencyAlarm(); } catch (e) {}
        }
      }
    } catch (err) {
      console.warn("Failed to load village status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVillageStatus(selectedVillageId);
    const interval = setInterval(() => {
      fetchVillageStatus(selectedVillageId);
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedVillageId]);

  // 3. Handle Citizen Sighting Submission
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setReportForm({ ...reportForm, photo: file });
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportForm.reporter_name) return;

    setSubmittingReport(true);
    setReportResult(null);

    const formData = new FormData();
    formData.append("reporter_name", reportForm.reporter_name);
    formData.append("reporter_contact", reportForm.reporter_contact);
    formData.append("animal_reported", reportForm.animal_reported);
    formData.append("village_id", selectedVillageId);
    formData.append("description", reportForm.description);
    if (reportForm.photo) {
      formData.append("photo", reportForm.photo);
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/reports/wildlife`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setReportResult(data);
        setReportForm({
          reporter_name: "",
          reporter_contact: "",
          animal_reported: "Tiger",
          description: "",
          photo: null
        });
        setPhotoPreview(null);
      }
    } catch (err) {
      console.warn("Report submission failed:", err);
    } finally {
      setSubmittingReport(false);
    }
  };

  const isThreat = villageStatus?.has_active_threat;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Village Header & Village Selector */}
      <div className="bg-slate-900/90 backdrop-blur-md p-6 rounded-3xl border border-slate-800 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
            <HeartHandshake className="w-7 h-7" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Gram Panchayat Community Safety
            </span>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              KAVACH Village Suraksha Portal
            </h1>
          </div>
        </div>

        {/* Village Selection Dropdown */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-medium">Select Your Village:</span>
          <select
            value={selectedVillageId}
            onChange={(e) => setSelectedVillageId(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white font-semibold text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500"
          >
            {villages.map((v) => (
              <option key={v.id} value={v.id}>
                📍 {v.name} ({v.district})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Village Status Banner */}
      {villageStatus && (
        <div
          className={`p-6 md:p-8 rounded-3xl border shadow-2xl transition-all ${
            isThreat
              ? "bg-gradient-to-br from-rose-950/80 via-red-900/40 to-slate-950 border-rose-600/80"
              : "bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-950 border-emerald-500/40"
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className={`w-3.5 h-3.5 rounded-full ${
                    isThreat ? "bg-rose-500 animate-ping" : "bg-emerald-400"
                  }`}
                />
                <span
                  className={`text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                    isThreat
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  }`}
                >
                  {isThreat ? "⚠️ ACTIVE WILDLIFE WARNING" : "🟢 AREA SECURE • ALL CLEAR"}
                </span>
              </div>

              <h2 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight">
                {isThreat
                  ? `${villageStatus.animal} Movement Alert near ${villageStatus.village?.name}`
                  : `Normal Conditions at ${villageStatus.village?.name}`}
              </h2>

              <p className="text-slate-300 text-base md:text-lg font-medium flex items-center gap-2">
                <MapPin className="w-5 h-5 text-amber-400 shrink-0" />
                <span>
                  Estimated Distance:{" "}
                  <strong className="text-white underline decoration-amber-500 font-bold">
                    {villageStatus.distance_str}
                  </strong>
                </span>
              </p>

              {villageStatus.detected_time && (
                <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span>Verified by AI Sensor: {villageStatus.detected_time} ({villageStatus.confidence}% confidence)</span>
                </div>
              )}
            </div>

            {/* Emergency Hotline Button */}
            <div className="flex flex-col gap-2 shrink-0">
              <a
                href="tel:18002330000"
                className="px-6 py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-bold text-base shadow-xl shadow-rose-600/30 flex items-center justify-center gap-3 transition"
              >
                <PhoneCall className="w-5 h-5 animate-bounce" />
                <span>Call Forest Emergency (1800-233-0000)</span>
              </a>
              <span className="text-[11px] text-center text-slate-400">Toll-free 24x7 Rapid Response Line</span>
            </div>
          </div>
        </div>
      )}

      {/* Safety Guidance & Advisory Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Do's and Don'ts Card */}
        <div className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Essential Safety Protocol</h3>
          </div>

          <div className="space-y-2.5 text-sm">
            {villageStatus?.guidance?.map((step, idx) => (
              <div
                key={idx}
                className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 flex items-start gap-3 text-slate-200"
              >
                <span className="w-6 h-6 rounded-full bg-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <span className="leading-relaxed font-medium">{step}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Emergency Contacts Directory */}
        <div className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
              <PhoneCall className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Emergency Contacts & Helpline</h3>
          </div>

          <div className="space-y-3">
            {villageStatus?.emergency_contacts?.map((c, i) => (
              <div
                key={i}
                className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700 flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-white text-sm">{c.label}</div>
                  <div className="text-xs text-slate-400">{c.desc}</div>
                </div>
                <a
                  href={`tel:${c.number}`}
                  className="px-3.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>{c.number}</span>
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Citizen Wildlife Sighting Report Form */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 p-6 md:p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Report a Wildlife Sighting</h3>
              <p className="text-xs text-slate-400">
                Spotted an animal? Submit details and an optional photo. Our YOLO neural engine will verify species automatically!
              </p>
            </div>
          </div>
        </div>

        {/* Report Result Confirmation Banner */}
        {reportResult && (
          <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-600/60 flex items-start gap-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-base font-bold text-emerald-200">
                Sighting Report #{reportResult.report_id} Submitted!
              </h4>
              <p className="text-sm text-emerald-300/80">{reportResult.message}</p>
              {reportResult.ai_verified_species && (
                <div className="mt-2 inline-flex items-center gap-2 bg-emerald-900/60 px-3 py-1.5 rounded-lg border border-emerald-500/30 text-xs font-semibold text-emerald-200">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>
                    AI Photo Verification: {reportResult.ai_verified_species} ({reportResult.ai_confidence}% confidence)
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleReportSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300">Your Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Patil"
                value={reportForm.reporter_name}
                onChange={(e) => setReportForm({ ...reportForm, reporter_name: e.target.value })}
                className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300">Mobile Number (For Alerts)</label>
              <input
                type="tel"
                placeholder="e.g. +91 94221 00000"
                value={reportForm.reporter_contact}
                onChange={(e) => setReportForm({ ...reportForm, reporter_contact: e.target.value })}
                className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300">Animal Spotted</label>
              <select
                value={reportForm.animal_reported}
                onChange={(e) => setReportForm({ ...reportForm, animal_reported: e.target.value })}
                className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
              >
                <option value="Tiger">Tiger (वाघ)</option>
                <option value="Leopard">Leopard (बिबट्या)</option>
                <option value="Asian Elephant">Asian Elephant (हत्ती)</option>
                <option value="Sloth Bear">Sloth Bear (अस्वल)</option>
                <option value="Wild Boar">Wild Boar (रानडुक्कर)</option>
                <option value="Other">Other Wildlife</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">Description & Landmark</label>
            <textarea
              rows={3}
              placeholder="e.g. Spotted tiger moving towards north canal near farm border at around 7 PM."
              value={reportForm.description}
              onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
              className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Photo Upload Area */}
          <div>
            <label className="text-xs font-semibold text-slate-300">Attach Photo (Optional for AI Verification)</label>
            <div className="mt-1 flex items-center gap-4">
              <label className="cursor-pointer px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-medium text-slate-200 flex items-center gap-2 transition">
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>Upload Sighting Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </label>

              {photoPreview && (
                <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-emerald-500/50">
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submittingReport}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition"
            >
              {submittingReport ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing AI Verification & Submitting...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Submit Sighting to Forest Department</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
