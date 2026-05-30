import React, { useState } from "react";
import { 
  FileSpreadsheet, 
  Search, 
  Trash2, 
  CheckSquare, 
  Filter, 
  Edit3, 
  Calendar, 
  Maximize2,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  FileText,
  Eye,
  X
} from "lucide-react";
import * as XLSX from "xlsx";
import { LandRecord, COLUMN_KEYS, LandRecordFieldName } from "../types";

interface RecordsTableProps {
  records: LandRecord[];
  onUpdateRecord: (id: string, updated: LandRecord) => void;
  onDeleteRecords: (ids: string[]) => void;
  onAddManualRecord: () => void;
}

export default function RecordsTable({ 
  records, 
  onUpdateRecord, 
  onDeleteRecords,
  onAddManualRecord
}: RecordsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("all");
  const [filterLegalFlag, setFilterLegalFlag] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editRecordId, setEditRecordId] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Toggle single selection
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Select all or none
  const handleSelectAll = (filteredRecords: LandRecord[]) => {
    const filteredIds = filteredRecords.map(r => r.id);
    const allSelected = filteredIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  // Bulk deep-verify action
  const handleBulkVerify = () => {
    if (selectedIds.length === 0) return;
    selectedIds.forEach(id => {
      const record = records.find(r => r.id === id);
      if (record) {
        onUpdateRecord(id, { ...record, isVerified: true });
      }
    });
    setSelectedIds([]);
  };

  // Bulk delete action
  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`Are you sure you want to delete the ${selectedIds.length} selected land record entries?`)) {
      onDeleteRecords(selectedIds);
      setSelectedIds([]);
    }
  };

  // View file — open in new tab via backend proxy
  const handleViewFile = (record: LandRecord) => {
    if (record.gcsInputPath) {
      window.open(`/api/file?path=${encodeURIComponent(record.gcsInputPath)}`, "_blank");
    } else {
      alert("No file associated with this record.");
    }
  };

  // In-table YES/NO badge togglers
  const handleToggleYesNo = (id: string, field: LandRecordFieldName) => {
    const record = records.find(r => r.id === id);
    if (record) {
      const currentVal = record[field] as "YES" | "NO";
      const newVal = currentVal === "YES" ? "NO" : "YES";
      onUpdateRecord(id, {
        ...record,
        [field]: newVal
      });
    }
  };

  // Get unique districts to populate filter dropdowns
  const uniqueDistricts = Array.from(new Set(records.map(r => r.district).filter(Boolean)));

  // Filter & Search records
  const filteredRecords = records.filter(record => {
    const textStr = `${record.village} ${record.taluka} ${record.district} ${record.bgTenure} ${record.fileName} ${record.lastMutation}`.toLowerCase();
    const matchesSearch = textStr.includes(searchQuery.toLowerCase());
    const matchesDistrict = filterDistrict === "all" || record.district === filterDistrict;
    
    let matchesFlag = true;
    if (filterLegalFlag !== "all") {
      matchesFlag = (record as any)[filterLegalFlag] === "YES";
    }

    return matchesSearch && matchesDistrict && matchesFlag;
  });

  // Calculate pagination window
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // SheetJS Excel Exporter implementation with column sizing
  const handleExportToExcel = () => {
    if (records.length === 0) {
      alert("No data records available to export.");
      return;
    }

    const headers = COLUMN_KEYS.filter(k => k.field !== "cultivation").map(k => k.label);
    const dataRows = filteredRecords.map(record => {
      return [
        record.date,
        record.fileName,
        record.bgTenure,
        record.village,
        record.taluka,
        record.district,
        record.totalArea,
        record.lastMutation,
        record.ceiling,
        record.forest,
        record.inam,
        record.bhoodan,
        record.gaothan,
        record.kul,
        record.watan,
        record.newCondition,
        record.encroachment,
        record.grazing,
        record.devasthan,
        record.tribal,
        record.rehabilitation,
        record.leasehold,
        record.waqf,
        record.fragmentLimit,
        record.apk,
        record.ekuk,
        record.hypothecation,
        record.bunding,
        record.bhumidhari,
        record.tagai
      ];
    });

    // Generate Sheet
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

    // Compute column widths mathematically (Auto Width Setup)
    const colWidths = headers.map((header, colIndex) => {
      let maxLen = header.length;
      dataRows.forEach(row => {
        const cellValue = row[colIndex] ? String(row[colIndex]) : "";
        if (cellValue.length > maxLen) {
          maxLen = cellValue.length;
        }
      });
      // Add safety padding, minimum 11, max width 42
      return { wch: Math.min(Math.max(maxLen + 3, 11), 42) };
    });
    ws["!cols"] = colWidths;

    // Build workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "extracted_record_sheets");

    // File Output Download trigger
    XLSX.writeFile(wb, `Maharashtra_7-12_Records_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // Selected edit record handle
  const editRecordObj = records.find(r => r.id === editRecordId);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm animate-fade-in h-full" id="records-panel">
      
      {/* Table Management Actions bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 mb-4 sm:mb-5">
        <div className="flex items-stretch sm:items-center gap-2 sm:gap-3 flex-1">
          <div className="relative flex-1 min-w-0">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 sm:pl-3 text-zinc-500">
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </span>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-8 sm:pl-9 pr-3 sm:pr-4 py-1.5 sm:py-2 bg-gray-50 border border-gray-200 rounded-xl text-[11px] sm:text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex items-stretch gap-1.5 sm:gap-2 shrink-0">
            <select
              value={filterDistrict}
              onChange={(e) => {
                setFilterDistrict(e.target.value);
                setCurrentPage(1);
              }}
              className="border border-gray-200 rounded-xl px-1.5 py-1.5 sm:px-2.5 sm:py-2 text-[10px] sm:text-[11px] text-gray-700 bg-gray-50 cursor-pointer focus:outline-none max-w-[90px] sm:max-w-none"
            >
              <option value="all">सर्व जिल्हा</option>
              {uniqueDistricts.map(dist => (
                <option key={dist} value={dist}>{dist}</option>
              ))}
            </select>

            <select
              value={filterLegalFlag}
              onChange={(e) => {
                setFilterLegalFlag(e.target.value);
                setCurrentPage(1);
              }}
              className="border border-gray-200 rounded-xl px-1.5 py-1.5 sm:px-2.5 sm:py-2 text-[10px] sm:text-[11px] text-gray-700 bg-gray-50 cursor-pointer focus:outline-none max-w-[90px] sm:max-w-none"
            >
              <option value="all">सर्व निर्बंध</option>
              {COLUMN_KEYS.slice(8).filter(c => c.field !== "cultivation").map((col) => (
                <option key={col.field} value={col.field}>{col.field === "forest" ? "वन" : col.label} : YES</option>
              ))}
            </select>
          </div>
        </div>

        {/* Toolbar Exports */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportToExcel}
            className="bg-indigo-600 hover:bg-indigo-500 text-white py-1.5 sm:py-2 px-2.5 sm:px-4 rounded-xl font-medium text-[11px] sm:text-xs flex items-center gap-1 sm:gap-1.5 shadow-md transition duration-150 cursor-pointer"
            id="export-excel-btn"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Export Excel</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>
      </div>

      {/* Bulk actions banner if rows selected */}
      {selectedIds.length > 0 && (
        <div className="p-2.5 sm:p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 mb-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold px-2 py-0.5 bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md">
              {selectedIds.length}
            </span>
            <p className="text-gray-600 text-[11px]">selected</p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={handleBulkVerify}
              className="py-1 sm:py-1.5 px-2 sm:px-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg flex items-center gap-1 font-medium text-[10px] sm:text-[11px] cursor-pointer"
            >
              <CheckSquare className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-500" />
              <span className="hidden sm:inline">Mark Verified</span>
              <span className="sm:hidden">Verify</span>
            </button>
            <button
              onClick={handleBulkDelete}
              className="py-1 sm:py-1.5 px-2 sm:px-3 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-600 rounded-lg flex items-center gap-1 font-medium text-[10px] sm:text-[11px] cursor-pointer"
            >
              <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">Remove Selected</span>
              <span className="sm:hidden">Remove</span>
            </button>
          </div>
        </div>
      )}

      {/* Interactive Main Records Sheet */}
      <div className="border border-gray-200 rounded-xl overflow-hidden relative shadow-sm" id="record-sheet-table">
        <div className="overflow-x-auto select-none">
          <table className="w-full text-left border-collapse table-fixed min-w-[2000px]">
            <thead>
              <tr className="bg-gray-100 text-gray-600 border-b border-gray-200 text-[10px] uppercase font-semibold font-mono">
                {/* Checkbox Header */}
                <th className="p-3 w-[50px] text-center sticky left-0 bg-white z-20 shadow-md border-r border-gray-200">
                  <input
                    type="checkbox"
                    checked={paginatedRecords.length > 0 && paginatedRecords.every(r => selectedIds.includes(r.id))}
                    onChange={() => handleSelectAll(paginatedRecords)}
                    className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer rounded"
                  />
                </th>

                {/* Left Sticky Primary geographical cols */}
                <th className="p-3 w-[150px] sticky left-[50px] bg-white z-20 border-r border-gray-200">गाव (Village)</th>
                <th className="p-3 w-[130px] bg-gray-50 border-r border-gray-200">तालुका (Taluka)</th>
                <th className="p-3 w-[130px] border-r border-gray-200">जिल्हा (District)</th>
                <th className="p-3 w-[160px] border-r border-gray-200">भू-धारणा पद्धती (Tenure)</th>
                <th className="p-3 w-[120px] border-r border-gray-200">एकूण क्षेत्र (Area)</th>
                <th className="p-3 w-[130px] border-r border-gray-200">फेरफार क्रमांक (Mutation)</th>
                <th className="p-3 w-[140px] border-r border-gray-200">File Name / Date</th>
                
                {/* 22 YES/NO Key Columns (वहिवाट excluded) */}
                {COLUMN_KEYS.slice(8).filter(c => c.field !== "cultivation").map((col) => (
                  <th key={col.field} className="p-3 w-[100px] text-center font-mono font-medium lowercase tracking-wider bg-gray-50 hover:bg-gray-100 border-r border-gray-200">
                    {col.label}
                  </th>
                ))}

                <th className="p-3 w-[150px] text-center sticky right-0 bg-white z-20 border-l border-gray-200">Actions</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-gray-200 text-xs">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={31} className="p-10 text-center text-gray-500 bg-white">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText className="w-8 h-8 text-gray-300 animate-bounce" />
                      <div>
                        <p className="font-semibold text-gray-600">No transcripts loaded</p>
                        <p className="text-[10px] text-gray-500">Initiate automated OCR extraction or add manual rows to begin.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((record) => (
                  <tr 
                    key={record.id} 
                    className={`hover:bg-gray-50 transition-all ${
                      record.isVerified ? "bg-emerald-50/50" : ""
                    } ${selectedIds.includes(record.id) ? "bg-indigo-50" : ""}`}
                  >
                    {/* Checkbox sticky */}
                    <td className="p-3 text-center sticky left-0 z-10 bg-white border-r border-gray-200">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(record.id)}
                        onChange={() => handleToggleSelect(record.id)}
                        className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer rounded"
                      />
                    </td>

                    {/* Sticky Village (गाव) */}
                    <td className="p-3 sticky left-[50px] z-10 bg-white border-r border-gray-200 font-medium text-gray-900 truncate shadow-[2px_0_5px_-2px_rgba(0,0,0,0.2)]">
                      {record.village}
                      {record.isVerified && (
                        <span className="ml-1 px-1.5 py-0.2 bg-emerald-50 text-[8px] text-emerald-600 font-bold rounded border border-emerald-200">
                          ✓ Verified
                        </span>
                      )}
                    </td>

                    {/* Geography parameters */}
                    <td className="p-3 text-gray-700 border-r border-gray-200">{record.taluka}</td>
                    <td className="p-3 text-gray-600 font-medium border-r border-gray-200">{record.district}</td>
                    
                    {/* Land tenure condition */}
                    <td className="p-3 text-gray-600 truncate border-r border-gray-200" title={record.bgTenure}>
                      {record.bgTenure}
                    </td>

                    {/* Area holding */}
                    <td className="p-3 font-mono font-semibold text-indigo-600 bg-gray-50 border-r border-gray-200">{record.totalArea}</td>
                    
                    {/* Last mutation index */}
                    <td className="p-3 font-mono text-emerald-600 font-semibold border-r border-gray-200">{record.lastMutation}</td>

                    {/* File Attachment context */}
                    <td className="p-3 border-r border-gray-200">
                      <div className="min-w-0" title={record.fileName}>
                        <p className="text-[10px] font-semibold text-gray-700 break-all leading-tight">{record.fileName}</p>
                        <p className="text-[9px] text-gray-500 mt-0.5 flex items-center gap-1 uppercase font-mono">
                          <Calendar className="w-2.5 h-2.5 text-gray-400" />
                          {record.date}
                        </p>
                      </div>
                    </td>

                    {/* Interactive YES/NO badge toggle triggers (वहिवाट excluded) */}
                    {COLUMN_KEYS.slice(8).filter(c => c.field !== "cultivation").map((col) => {
                      const value = record[col.field] as "YES" | "NO";
                      return (
                        <td key={col.field} className="p-3 text-center border-r border-gray-200">
                          <button
                            type="button"
                            onClick={() => handleToggleYesNo(record.id, col.field)}
                            className={`px-2.5 py-1 text-[10px] font-bold rounded-full transition-all duration-150 cursor-pointer select-none ${
                              value === "YES" 
                                ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200" 
                                : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-600"
                            }`}
                          >
                            {value}
                          </button>
                        </td>
                      );
                    })}

                    {/* Manual row editor triggers */}
                    <td className="p-2 text-center sticky right-0 z-10 bg-white border-l border-gray-200 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.2)]">
                      <div className="flex items-center justify-center gap-1 font-sans">
                        <button
                          onClick={() => handleViewFile(record)}
                          className="p-1.5 bg-gray-100 border border-gray-200 text-gray-500 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 rounded-md transition cursor-pointer"
                          title="View uploaded file"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditRecordId(record.id)}
                          className="p-1.5 bg-gray-100 border border-gray-200 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 rounded-md transition cursor-pointer"
                          title="Edit record"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this single entry?")) {
                              onDeleteRecords([record.id]);
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                          title="Delete row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between text-xs mt-4 font-mono text-gray-500">
        <p>
          Showing {filteredRecords.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to{" "}
          {Math.min(currentPage * itemsPerPage, filteredRecords.length)} of {filteredRecords.length} records
        </p>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="p-1.5 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 text-gray-500 disabled:opacity-30 transition cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          
          <span className="text-gray-600 px-2 font-semibold">
            Page {currentPage} / {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="p-1.5 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 text-gray-500 disabled:opacity-30 transition cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Slide-over Side Drawer Edit Card */}
      {editRecordId && editRecordObj && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex justify-end" id="edit-drawer-overlay">
          <div className="bg-white w-full max-w-xl h-full flex flex-col justify-between shadow-2xl relative border-l border-gray-200 overflow-hidden animate-slide-in max-sm:max-w-full">
            {/* Drawer Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-indigo-600" />
                  Record Sheet Editor
                </h3>
                <p className="text-[11px] text-gray-500 mt-1">
                  Editing file: <span className="font-mono text-gray-600">{editRecordObj.fileName}</span>
                </p>
              </div>
              <button 
                onClick={() => setEditRecordId(null)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold p-1 rounded-md hover:bg-gray-100 cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Form Fields Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-gray-700">
              {/* Part 1: Land Details Geo */}
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 mb-3 border-b border-gray-200 pb-1">
                  Primary Location & Geography
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-[10px] text-gray-500 font-medium mb-1">गाव (Village)</label>
                    <input
                      type="text"
                      value={editRecordObj.village}
                      onChange={(e) => onUpdateRecord(editRecordObj.id, { ...editRecordObj, village: e.target.value })}
                      className="w-full p-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 font-medium mb-1">तालुका (Taluka)</label>
                    <input
                      type="text"
                      value={editRecordObj.taluka}
                      onChange={(e) => onUpdateRecord(editRecordObj.id, { ...editRecordObj, taluka: e.target.value })}
                      className="w-full p-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 font-medium mb-1">जिल्हा (District)</label>
                    <input
                      type="text"
                      value={editRecordObj.district}
                      onChange={(e) => onUpdateRecord(editRecordObj.id, { ...editRecordObj, district: e.target.value })}
                      className="w-full p-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900"
                    />
                  </div>
                </div>
              </div>

              {/* Part 2: Tenure Assessment info */}
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 mb-3 border-b border-gray-200 pb-1">
                  Tenure, Area & Mutation
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] text-gray-500 font-medium mb-1">भू-धारणा पद्धती (Tenure Type)</label>
                    <input
                      type="text"
                      value={editRecordObj.bgTenure}
                      onChange={(e) => onUpdateRecord(editRecordObj.id, { ...editRecordObj, bgTenure: e.target.value })}
                      className="w-full p-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 font-medium mb-1">Total Area (क्षेत्र)</label>
                    <input
                      type="text"
                      value={editRecordObj.totalArea}
                      onChange={(e) => onUpdateRecord(editRecordObj.id, { ...editRecordObj, totalArea: e.target.value })}
                      className="w-full p-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 font-medium mb-1">फेरफार क्रमांक</label>
                    <input
                      type="text"
                      value={editRecordObj.lastMutation}
                      onChange={(e) => onUpdateRecord(editRecordObj.id, { ...editRecordObj, lastMutation: e.target.value })}
                      className="w-full p-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 font-medium mb-1">Record Date</label>
                    <input
                      type="date"
                      value={editRecordObj.date}
                      onChange={(e) => onUpdateRecord(editRecordObj.id, { ...editRecordObj, date: e.target.value })}
                      className="w-full p-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 font-medium mb-1">Verification Status</label>
                    <select
                      value={editRecordObj.isVerified ? "true" : "false"}
                      onChange={(e) => onUpdateRecord(editRecordObj.id, { ...editRecordObj, isVerified: e.target.value === "true" })}
                      className="w-full p-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none text-gray-900 cursor-pointer"
                    >
                      <option value="false">Pending Verification</option>
                      <option value="true">Deep Verified</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Part 3: Yes/No restrictions checkbox group */}
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 mb-3 border-b border-gray-200 pb-1">
                  Conditions & Legal Keywords
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[300px] overflow-y-auto pr-1">
                  {COLUMN_KEYS.slice(8).filter(c => c.field !== "cultivation").map((col) => {
                    const value = editRecordObj[col.field] as "YES" | "NO";
                    return (
                      <div key={col.field} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                        <span className="text-[11px] text-gray-700 font-medium truncate" title={col.label}>{col.label}</span>
                        <select
                          value={value}
                          onChange={(e) => onUpdateRecord(editRecordObj.id, { ...editRecordObj, [col.field]: e.target.value })}
                          className={`text-[10px] font-bold p-1 rounded-md text-center focus:outline-none cursor-pointer ${
                            value === "YES" ? "bg-red-50 text-red-600 border border-red-200" : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          <option value="YES">YES</option>
                          <option value="NO">NO</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-gray-200 bg-gray-50 text-right">
              <button
                onClick={() => setEditRecordId(null)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-md transition duration-150 cursor-pointer"
              >
                Close and Save Changes
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
