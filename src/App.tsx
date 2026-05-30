import React, { useState, useEffect } from "react";
import { 
  Globe,
  LayoutDashboard,
  History,
  ChevronLeft
} from "lucide-react";
import { LandRecord } from "./types";
import logoUrl from "../assets/logo.png";
import UploadSection from "./components/UploadSection";
import AnalysisPanel from "./components/AnalysisPanel";
import RecordsTable from "./components/RecordsTable";
import ManualRecordDialog from "./components/ManualRecordDialog";

export default function App() {
  const [dashboardRecords, setDashboardRecords] = useState<LandRecord[]>([]);
  const [historyRecords, setHistoryRecords] = useState<LandRecord[]>([]);
  const [apiConnected, setApiConnected] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "history">("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [utcDate, setUtcDate] = useState("");

  useEffect(() => {
    const updateDate = () => {
      const now = new Date();
      setUtcDate(now.toISOString().split("T")[0]);
    };
    updateDate();
    const interval = setInterval(updateDate, 60000);
    return () => clearInterval(interval);
  }, []);

  // Load per-browser data from localStorage on startup
  useEffect(() => {
    const cachedDashboard = localStorage.getItem("maharashtra_7_12_dashboard_records");
    if (cachedDashboard) {
      try {
        setDashboardRecords(JSON.parse(cachedDashboard));
      } catch (err) {
        console.error("Failed to parse cached dashboard records:", err);
      }
    }

    const cachedHistory = localStorage.getItem("maharashtra_7_12_history_records");
    if (cachedHistory) {
      try {
        setHistoryRecords(JSON.parse(cachedHistory));
      } catch (err) {
        console.error("Failed to parse cached history records:", err);
      }
    }

    // Ping Backend API Connection status checker
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "ok" && data.hasApiKey) {
          setApiConnected(true);
        }
      })
      .catch((err) => console.log("Host connection is offline, running local server fallbacks: ", err));
  }, []);

  // Sync dashboard cache
  const updateDashboardCache = (newRecords: LandRecord[]) => {
    setDashboardRecords(newRecords);
    localStorage.setItem("maharashtra_7_12_dashboard_records", JSON.stringify(newRecords));
  };

  // Sync history cache
  const updateHistoryCache = (newRecords: LandRecord[]) => {
    setHistoryRecords(newRecords);
    localStorage.setItem("maharashtra_7_12_history_records", JSON.stringify(newRecords));
  };

  // Callback: records extracted from UploadSection
  const handleRecordsExtracted = (newExtracted: LandRecord[]) => {
    setDashboardRecords(prev => {
      const updated = [...newExtracted, ...prev];
      localStorage.setItem("maharashtra_7_12_dashboard_records", JSON.stringify(updated));
      return updated;
    });
    setHistoryRecords(prev => {
      const updated = [...newExtracted, ...prev];
      localStorage.setItem("maharashtra_7_12_history_records", JSON.stringify(updated));
      return updated;
    });
  };

  // Callback: edit record in dashboard
  const handleUpdateDashboardRecord = (id: string, updatedRecord: LandRecord) => {
    const next = dashboardRecords.map((r) => (r.id === id ? updatedRecord : r));
    updateDashboardCache(next);
  };

  // Callback: edit record in history
  const handleUpdateHistoryRecord = (id: string, updatedRecord: LandRecord) => {
    const next = historyRecords.map((r) => (r.id === id ? updatedRecord : r));
    updateHistoryCache(next);
  };

  // Callback: delete records from dashboard only
  const handleDeleteDashboardRecords = (ids: string[]) => {
    const next = dashboardRecords.filter((r) => !ids.includes(r.id));
    updateDashboardCache(next);
  };

  // Callback: delete records from history only
  const handleDeleteHistoryRecords = (ids: string[]) => {
    const next = historyRecords.filter((r) => !ids.includes(r.id));
    updateHistoryCache(next);
  };

  // Callback: save manual entry (goes to both)
  const handleSaveManualRecord = (record: LandRecord) => {
    updateDashboardCache([record, ...dashboardRecords]);
    updateHistoryCache([record, ...historyRecords]);
  };

  return (
    <div className="min-h-screen bg-white text-gray-700 font-sans selection:bg-brand/[0.15] selection:text-brand antialiased flex" id="applet-container">
      
      {/* Sidebar — hidden on mobile */}
      <aside className={`${sidebarCollapsed ? "w-16" : "w-60"} shrink-0 bg-white border-r border-gray-200 hidden lg:flex flex-col h-screen sticky top-0 transition-all duration-200`} id="sidebar">
        {/* Logo Section */}
        <div className={`${sidebarCollapsed ? "p-3" : "p-5"} border-b border-gray-100`}>
          <div className={`flex ${sidebarCollapsed ? "justify-center" : "items-center gap-3"}`}>
            <div className="w-12 h-12 shrink-0 overflow-hidden">
              <img src={logoUrl} alt="Udayam AI Labs" className="w-full h-full object-contain" />
            </div>
            {!sidebarCollapsed && (
              <div>
                <p className="text-sm font-bold text-gray-900 leading-tight">Udayam AI Labs</p>
                <p className="text-[9px] text-gray-400 uppercase tracking-wider">Intelligence Redefined</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 ${sidebarCollapsed ? "p-2 space-y-2" : "p-3 space-y-1"}`}>
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`w-full flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"} px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
              activeTab === "dashboard"
                ? "bg-brand/[0.08] text-brand"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title={sidebarCollapsed ? "Dashboard" : undefined}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Dashboard</span>}
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`w-full flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"} px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
              activeTab === "history"
                ? "bg-brand/[0.08] text-brand"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title={sidebarCollapsed ? "History" : undefined}
          >
            <History className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>History</span>}
          </button>
        </nav>

        {/* Collapse Toggle */}
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`w-full flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"} px-3 py-2 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition-all duration-150 cursor-pointer`}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft className={`w-4 h-4 shrink-0 transition-transform duration-200 ${sidebarCollapsed ? "rotate-180" : ""}`} />
            {!sidebarCollapsed && <span className="text-xs">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 py-4 sm:py-6 px-4 sm:px-6 md:px-8 max-w-7xl mx-auto flex flex-col gap-4 sm:gap-6">
        
        {/* Mobile top nav — visible only when sidebar is hidden */}
        <div className="flex lg:hidden items-center justify-between -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8 py-2.5 bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <img src={logoUrl} alt="" className="w-7 h-7 object-contain" />
            <span className="text-sm font-bold text-gray-900 leading-tight">Udayam</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === "dashboard"
                  ? "bg-brand/[0.08] text-brand"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === "history"
                  ? "bg-brand/[0.08] text-brand"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              History
            </button>
          </div>
        </div>

        {activeTab === "dashboard" ? (
          <>
            {/* Dashboard Header */}
            <header className="border border-gray-200 bg-white rounded-2xl p-3 sm:p-5 shadow-sm flex items-center justify-between" id="dashboard-header">
              <h1 className="text-sm sm:text-xl md:text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-1.5 sm:gap-2">
                <LayoutDashboard className="w-4 h-4 sm:w-6 sm:h-6 text-brand" />
                <span className="hidden sm:inline">Dashboard</span>
                <span className="text-gray-300 font-light hidden sm:inline text-xl md:text-2xl">-</span>
                <span className="text-xs sm:text-base md:text-lg font-bold text-gray-900">7/12 Smart Scan</span>
                <span className="text-[10px] sm:text-xs font-medium text-brand bg-brand/[0.08] border border-brand/[0.2] px-2 py-0.5 rounded-full">Batch Mode</span>
              </h1>
              <div className="hidden sm:flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-xl px-3 py-1.5">
                <Globe className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-600 font-mono text-[10px]">{utcDate}</span>
              </div>
            </header>

            {/* Main split interactive section */}
            <main className="flex flex-col lg:flex-row gap-4 sm:gap-6" id="dashboard-main">
              <div className="lg:w-80 xl:w-96 shrink-0">
                <UploadSection 
                  onRecordsExtracted={handleRecordsExtracted} 
                  apiConnected={apiConnected}
                />
              </div>
              <div className="flex-1 min-w-0">
                <AnalysisPanel records={dashboardRecords} />
              </div>
            </main>

            {/* Interactive 31-column Editable Table View */}
            <section id="extraction-spreadsheet-section">
              <RecordsTable
                records={dashboardRecords}
                onUpdateRecord={handleUpdateDashboardRecord}
                onDeleteRecords={handleDeleteDashboardRecords}
                onAddManualRecord={() => setIsManualOpen(true)}
              />
            </section>

            {/* Manual Creation Slides dialog */}
            <ManualRecordDialog
              isOpen={isManualOpen}
              onClose={() => setIsManualOpen(false)}
              onSave={handleSaveManualRecord}
            />

            {/* Footer System Details */}
            <footer className="text-center py-4 text-xs text-gray-400 border-t border-gray-200 mt-4 flex flex-col sm:flex-row items-center justify-between gap-2" id="primary-footer">
              <p>© 2026 Udayam AI Labs. All rights reserved.</p>
              <p>
                Powered by{" "}
                <a href="https://udayam.co.in" target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand font-medium">
                  Udayam AI Labs
                </a>
              </p>
            </footer>
          </>
        ) : (
          <>
            {/* History Header */}
            <header className="border border-gray-200 bg-white rounded-2xl p-4 sm:p-5 shadow-sm flex items-center justify-between" id="history-header">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                <History className="w-5 h-5 sm:w-6 sm:h-6 text-brand" />
                History
              </h1>
              <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-xl px-3 py-1.5">
                <Globe className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-600 font-mono text-[10px]">{utcDate}</span>
              </div>
            </header>

            <section id="history-spreadsheet-section" className="flex-1">
              <RecordsTable
                records={historyRecords}
                onUpdateRecord={handleUpdateHistoryRecord}
                onDeleteRecords={handleDeleteHistoryRecords}
                onAddManualRecord={() => setIsManualOpen(true)}
              />
            </section>

            <footer className="text-center py-4 text-xs text-gray-400 border-t border-gray-200 mt-4 flex flex-col sm:flex-row items-center justify-between gap-2" id="history-footer">
              <p>© 2026 Udayam AI Labs. All rights reserved.</p>
              <p>
                Powered by{" "}
                <a href="https://udayam.co.in" target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand font-medium">
                  Udayam AI Labs
                </a>
              </p>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
