import React, { useState } from "react";
import { PlusCircle } from "lucide-react";
import { LandRecord, COLUMN_KEYS } from "../types";

interface ManualRecordDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: LandRecord) => void;
}

export default function ManualRecordDialog({ isOpen, onClose, onSave }: ManualRecordDialogProps) {
  const [village, setVillage] = useState("");
  const [taluka, setTaluka] = useState("");
  const [district, setDistrict] = useState("");
  const [bgTenure, setBgTenure] = useState("नवीन अविभाज्य पद्धती");
  const [totalArea, setTotalArea] = useState("");
  const [lastMutation, setLastMutation] = useState("");
  
  // States for the 23 YES/NO checkboxes
  const [flags, setFlags] = useState<{ [key: string]: "YES" | "NO" }>({
    ceiling: "NO",
    forest: "NO",
    inam: "NO",
    bhoodan: "NO",
    gaothan: "NO",
    kul: "NO",
    watan: "NO",
    newCondition: "NO",
    encroachment: "NO",
    grazing: "NO",
    devasthan: "NO",
    tribal: "NO",
    rehabilitation: "NO",
    leasehold: "NO",
    waqf: "NO",
    fragmentLimit: "NO",
    apk: "NO",
    ekuk: "NO",
    hypothecation: "NO",
    bunding: "NO",
    bhumidhari: "NO",
    tagai: "NO",
    cultivation: "NO",
  });

  if (!isOpen) return null;

  const handleToggleFlag = (field: string) => {
    setFlags((prev) => ({
      ...prev,
      [field]: prev[field] === "YES" ? "NO" : "YES",
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!village || !taluka || !district) {
      alert("Please fill in गाव, तालुका, and जिल्हा fields.");
      return;
    }

    const newRow: LandRecord = {
      id: Math.random().toString(36).substring(7),
      date: new Date().toISOString().split("T")[0],
      fileName: "Manual Form Entry",
      bgTenure: bgTenure || "नवीन अविभाज्य पद्धती",
      village,
      taluka,
      district,
      totalArea: totalArea || "०.००",
      lastMutation: lastMutation || "—",
      ...flags,
      isVerified: true,
      confidenceScore: 100, // Manual entries are verified by default
    };

    onSave(newRow);
    
    // reset states
    setVillage("");
    setTaluka("");
    setDistrict("");
    setBgTenure("नवीन अविभाज्य पद्धती");
    setTotalArea("");
    setLastMutation("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4" id="manual-dialog-overlay">
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-fade-in">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <PlusCircle className="w-4 h-4 text-indigo-600" />
            Add Manual Land Record entry (नवीन नोंद)
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg font-bold p-1 hover:bg-gray-100 rounded-md cursor-pointer"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] text-zinc-500 font-medium mb-1">गाव (Village) *</label>
              <input
                type="text"
                required
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                className="w-full p-2 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g. वाकडी"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500 font-medium mb-1">तालुका (Taluka) *</label>
              <input
                type="text"
                required
                value={taluka}
                onChange={(e) => setTaluka(e.target.value)}
                className="w-full p-2 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g. कोपरगाव"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500 font-medium mb-1">जिल्हा (District) *</label>
              <input
                type="text"
                required
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full p-2 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g. अहमदनगर"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-[10px] text-zinc-500 font-medium mb-1">भू-धारणा पद्धती (Tenure Type)</label>
              <input
                type="text"
                value={bgTenure}
                onChange={(e) => setBgTenure(e.target.value)}
                className="w-full p-2 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="नवीन अविभाज्य पद्धती / भोगवटदार वर्ग"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500 font-medium mb-1">क्षेत्र (Total Area)</label>
              <input
                type="text"
                value={totalArea}
                onChange={(e) => setTotalArea(e.target.value)}
                className="w-full p-2 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                placeholder="e.g. २.४५ हे.आर."
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 font-medium mb-1">शेवटचा फेरफार क्रमांक</label>
            <input
              type="text"
              value={lastMutation}
              onChange={(e) => setLastMutation(e.target.value)}
              className="w-full p-2 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
              placeholder="e.g. ४५३२"
            />
          </div>

          {/* YES/NO checkbox triggers */}
          <div>
            <label className="block text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-2 border-b border-gray-200 pb-1">
              Active Legal Flags / Limitations
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-[185px] overflow-y-auto pr-1">
              {COLUMN_KEYS.slice(8).map((col) => {
                const isActive = flags[col.field] === "YES";
                return (
                  <button
                    key={col.field}
                    type="button"
                    onClick={() => handleToggleFlag(col.field)}
                    className={`p-2 rounded-lg border text-[11px] font-semibold text-left transition-all duration-150 flex items-center justify-between cursor-pointer ${
                      isActive
                        ? "bg-red-50 text-red-600 border-red-200"
                        : "bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className="truncate">{col.label}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase font-mono ${
                      isActive ? "bg-red-100 text-red-600 border border-red-200" : "bg-gray-100 text-gray-500"
                    }`}>
                      {flags[col.field]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 flex items-center justify-end gap-2 bg-gray-50 -mx-5 -mb-5 p-4 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-md transition cursor-pointer"
            >
              Confirm and Save Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
