import React from "react";
import { LayoutGrid } from "lucide-react";
import { LandRecord } from "../types";

interface AnalysisPanelProps {
  records: LandRecord[];
}

export default function AnalysisPanel({ records }: AnalysisPanelProps) {
  const totalCount = records.length;

  // Legal Flags Extraction Breakdown — all columns from सीलिंग to वहिवाट
  const flagsMapping: { label: string; key: keyof LandRecord; count: number }[] = [
    "ceiling", "forest", "inam", "bhoodan", "gaothan", "kul",
    "watan", "newCondition", "encroachment", "grazing", "devasthan",
    "tribal", "rehabilitation", "leasehold", "waqf", "fragmentLimit",
    "apk", "ekuk", "hypothecation", "bunding", "bhumidhari", "tagai",
  ].map((key) => {
    const labels: Record<string, string> = {
      ceiling: "सीलिंग", forest: "वन/फॉरेस्ट",
      inam: "इनाम", bhoodan: "भूदान",
      gaothan: "गावठाण", kul: "कुळ",
      watan: "वतन", newCondition: "नवीन शर्त",
      encroachment: "अतिक्रमण", grazing: "गुरे चरण/चरई",
      devasthan: "देवस्थान", tribal: "कलम ३६ आदिवासी",
      rehabilitation: "पुनर्वसन", leasehold: "भाडेपट्टा",
      waqf: "वक्फ", fragmentLimit: "तुकडा/तुकडेबंदी",
      apk: "अ पा क", ekuk: "एकुक",
      hypothecation: "नजर गहाण", bunding: "बडिंग",
      bhumidhari: "भूमीधारी हक्क", tagai: "तगाई",
    };
    return {
      label: labels[key] || key,
      key: key as keyof LandRecord,
      count: records.filter((r) => r[key as keyof LandRecord] === "YES").length,
    };
  });

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 h-full flex flex-col justify-between animate-fade-in shadow-sm" id="analytics-panel">
      <div>
        {/* Module Header */}
        <div className="mb-4 sm:mb-5">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 leading-tight flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
            Land Record Intelligence
          </h2>
          <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
            Analytics parsed from uploaded extracts.
          </p>
        </div>



        {/* Legal Risk and Restrictions Monitoring */}
        <div className="mb-6">
          {totalCount === 0 ? (
            <div className="p-4 border border-dashed border-gray-300 rounded-xl text-center">
              <p className="text-[11px] text-gray-500">No active legal flags detected.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
              {flagsMapping.map((flag, index) => (
                <div
                  key={index}
                  className="p-2 rounded-lg border border-blue-200 bg-blue-50 text-gray-900 text-xs flex items-center justify-between transition-all hover:scale-[1.01]"
                >
                  <span className="font-medium truncate mr-1">{flag.label}</span>
                  <span className="font-bold text-xs font-mono shrink-0 px-2 py-0.5 bg-white border border-gray-300/60 rounded-md shadow-xs">
                    {flag.count} {flag.count === 1 ? "File" : "Files"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>


      </div>
    </div>
  );
}
