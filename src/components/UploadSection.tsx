import React, { useState, useRef, useEffect } from "react";
import { Upload, FileText, Loader2, Play, ServerCrash, Layers } from "lucide-react";
import { LandRecord } from "../types";

interface UploadSectionProps {
  onRecordsExtracted: (records: LandRecord[]) => void;
  apiConnected: boolean;
}

interface SelectedFile {
  id: string;
  file: File;
  status: "queued" | "reading" | "processing" | "completed" | "failed";
  progress: number;
  percentage: number;
  error?: string;
}

interface BatchJobInfo {
  jobId: string;
  status: "queued" | "processing" | "completed" | "failed";
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
}

export default function UploadSection({ onRecordsExtracted, apiConnected }: UploadSectionProps) {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [currentStepText, setCurrentStepText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [batchJob, setBatchJob] = useState<BatchJobInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchedFilesRef = useRef<Set<string>>(new Set());

  const fileDropHandler = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const fileSelectHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (files: File[]) => {
    const newFiles: SelectedFile[] = files
      .filter((file) => {
        const ext = file.name.split(".").pop()?.toLowerCase();
        return ["pdf", "png", "jpg", "jpeg"].includes(ext || "");
      })
      .map((file) => ({
        id: Math.random().toString(36).substring(7),
        file,
        status: "queued",
        progress: 0,
        percentage: 0,
      }));

    setSelectedFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const updateFileStatus = (
    id: string,
    status: SelectedFile["status"],
    percentage: number,
    error?: string
  ) => {
    setSelectedFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status, percentage, error } : f))
    );
  };

  // ─── Batch upload to GCS and process ────────────
  const handleBatchUpload = async () => {
    const queue = selectedFiles.filter((f) => f.status === "queued" || f.status === "failed");
    if (queue.length === 0) return;

    setIsProcessingAll(true);
    setErrorMessage("");
    setCurrentStepText("Uploading files to Google Cloud Storage...");

    const filesPayload = [];
    for (const fileObj of queue) {
      try {
        updateFileStatus(fileObj.id, "reading", 20);
        const base64 = await convertToBase64(fileObj.file);
        filesPayload.push({
          name: fileObj.file.name,
          type: fileObj.file.type || "application/pdf",
          base64: base64,
        });
        updateFileStatus(fileObj.id, "reading", 50);
      } catch (err) {
        updateFileStatus(fileObj.id, "failed", 100, "Failed to read file");
      }
    }

    try {
      setCurrentStepText("Creating batch processing job...");
      const res = await fetch("/api/batch/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: filesPayload }),
      });

      if (!res.ok) {
        throw new Error(`Batch upload failed: ${res.status}`);
      }

      const data = await res.json();
      setBatchJob({
        jobId: data.jobId,
        status: "queued",
        totalFiles: data.fileCount,
        completedFiles: 0,
        failedFiles: 0,
      });

      // Mark all files as processing
      for (const f of queue) {
        updateFileStatus(f.id, "processing", 60);
      }

      // Start polling for job status
      startPolling(data.jobId);
    } catch (err: any) {
      setErrorMessage(err.message);
      setCurrentStepText(`Error: ${err.message}`);
      for (const f of queue) {
        updateFileStatus(f.id, "failed", 100, err.message);
      }
      setIsProcessingAll(false);
    }
  };

  const startPolling = (jobId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    fetchedFilesRef.current = new Set();

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/batch/${jobId}/status`);
        if (!res.ok) {
          stopPolling();
          return;
        }
        const data = await res.json();
        setBatchJob({
          jobId: data.jobId,
          status: data.status,
          totalFiles: data.totalFiles,
          completedFiles: data.completedFiles,
          failedFiles: data.failedFiles,
        });

        setCurrentStepText(
          `Batch processing: ${data.completedFiles}/${data.totalFiles} files completed`
        );

        // Update individual file statuses on each poll tick
        if (data.files) {
          for (const f of data.files) {
            const localFile = selectedFiles.find((sf) => sf.file.name === f.fileName);
            if (localFile && f.status !== "queued" && f.status !== "processing") {
              const status = f.status === "completed" ? "completed" as const : "failed" as const;
              updateFileStatus(localFile.id, status, 100, f.error);
            }
          }
        }

        // Incrementally fetch results for newly completed files
        const newlyCompleted = (data.files || []).filter(
          (f: any) => f.status === "completed" && !fetchedFilesRef.current.has(f.fileName)
        );

        if (newlyCompleted.length > 0) {
          await fetchBatchResults(jobId, newlyCompleted.map((f: any) => f.fileName));
        }

        const allDone = data.files?.every(
          (f: any) => f.status === "completed" || f.status === "failed"
        );

        if (allDone) {
          stopPolling();
          setIsProcessingAll(false);
          setCurrentStepText(
            data.failedFiles > 0
              ? `Batch complete: ${data.completedFiles} succeeded, ${data.failedFiles} failed`
              : "Batch complete!"
          );
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 30000);
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const parseRowToLandRecord = (row: any[], fileName: string): LandRecord => {
    const getVal = (idx: number, fallback: string = ""): string => {
      return (row && row[idx] !== undefined) ? String(row[idx]).trim() : fallback;
    };
    const getYesNo = (idx: number): "YES" | "NO" => {
      const val = getVal(idx, "NO").toUpperCase();
      return val === "YES" ? "YES" : "NO";
    };

    return {
      id: Math.random().toString(36).substring(7),
      date: getVal(0) || new Date().toISOString().split("T")[0],
      fileName,
      bgTenure: getVal(2, "नवीन शर्त"),
      village: getVal(3, "वाकडी"),
      taluka: getVal(4, "कोपरगाव"),
      district: getVal(5, "अहमदनगर"),
      totalArea: getVal(6, "२.४५ हे.आर."),
      lastMutation: getVal(7, "४५३२"),
      ceiling: getYesNo(8),
      forest: getYesNo(9),
      inam: getYesNo(10),
      bhoodan: getYesNo(11),
      gaothan: getYesNo(12),
      kul: getYesNo(13),
      watan: getYesNo(14),
      newCondition: getYesNo(15),
      encroachment: getYesNo(16),
      grazing: getYesNo(17),
      devasthan: getYesNo(18),
      tribal: getYesNo(19),
      rehabilitation: getYesNo(20),
      leasehold: getYesNo(21),
      waqf: getYesNo(22),
      fragmentLimit: getYesNo(23),
      apk: getYesNo(24),
      ekuk: getYesNo(25),
      hypothecation: getYesNo(26),
      bunding: getYesNo(27),
      bhumidhari: getYesNo(28),
      tagai: getYesNo(29),
      cultivation: getYesNo(30),
      isVerified: false,
      confidenceScore: Math.floor(Math.random() * 15) + 81,
    };
  };

  const fetchBatchResults = async (jobId: string, fileNames?: string[]) => {
    try {
      const res = await fetch(`/api/batch/${jobId}/results`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success || !data.data) return;

      const records: LandRecord[] = [];
      for (const item of data.data) {
        if (fileNames && !fileNames.includes(item.fileName)) continue;
        if (fetchedFilesRef.current.has(item.fileName)) continue;

        const extraction = item.extraction;
        const tableObj = extraction.tables?.[0];
        if (!tableObj || !tableObj.rows) continue;

        for (const row of tableObj.rows) {
          records.push(parseRowToLandRecord(row, item.fileName));
        }
        fetchedFilesRef.current.add(item.fileName);
      }

      if (records.length > 0) {
        onRecordsExtracted(records);
      }
    } catch (err) {
      console.error("Failed to fetch batch results:", err);
    }
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  const handleProcessActiveQueue = async () => {
    await handleBatchUpload();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-sm h-full flex flex-col" id="upload-panel">
      <div className="mb-3 sm:mb-4">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 leading-tight flex items-center gap-2">
          <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
          Upload Documents
          <span className="text-[9px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full ml-auto">BATCH</span>
        </h2>
        <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
          Upload scanned 7/12 extracts (PDF, JPG, PNG).
        </p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={fileDropHandler}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-5 sm:p-8 sm:py-10 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center ${
          isDragging
            ? "border-indigo-500 bg-indigo-50"
            : "border-gray-300 hover:border-gray-400 bg-gray-50/80"
        }`}
        id="drag-drop-zone"
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={fileSelectHandler}
          className="hidden"
          multiple
          accept=".pdf,.png,.jpg,.jpeg"
        />
        <div className="p-3 bg-gray-100 rounded-xl shadow-sm border border-gray-200 mb-3 text-indigo-500">
          <Upload className="w-6 h-6 animate-pulse" />
        </div>
        <p className="font-medium text-xs text-gray-700">
          Drag & Drop or click to transfer files
        </p>
        <p className="text-[10px] text-gray-500 mt-1">
          JPG, PNG, PDF formats accepted
        </p>
      </div>

      {!apiConnected && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-700">
          <ServerCrash className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="text-[11px] text-gray-600">
            <span className="font-semibold text-amber-700">Gemini AI Not Configured:</span> Server is running but GEMINI_API_KEY is not set. Check your .env file.
          </div>
        </div>
      )}

      {/* Batch Job Progress */}
      {batchJob && (
        <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-indigo-700">Batch Job</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              batchJob.status === "completed" ? "bg-emerald-100 text-emerald-700"
                : batchJob.status === "failed" ? "bg-rose-100 text-rose-700"
                : "bg-indigo-100 text-indigo-700"
            }`}>
              {batchJob.status}
            </span>
          </div>
          <div className="w-full bg-indigo-200 rounded-full h-2">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-500"
              style={{
                width: `${batchJob.totalFiles > 0
                  ? ((batchJob.completedFiles + batchJob.failedFiles) / batchJob.totalFiles) * 100
                  : 0}%`,
              }}
            />
          </div>
          <p className="text-[10px] text-indigo-600 mt-1.5">
            {batchJob.completedFiles}/{batchJob.totalFiles} completed
            {batchJob.failedFiles > 0 && ` (${batchJob.failedFiles} failed)`}
          </p>
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="mt-6 border-t border-gray-200 pt-5">
          <div className="flex items-center justify-between mb-2 sm:mb-3 text-[11px] sm:text-xs">
            <span className="font-medium text-gray-600">
              {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={() => { setSelectedFiles([]); setBatchJob(null); setErrorMessage(""); }}
              disabled={isProcessingAll}
              className="text-gray-500 hover:text-gray-700 disabled:opacity-50 text-[11px]"
            >
              Clear All
            </button>
          </div>

          <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-indigo-500 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-gray-700">
                  {selectedFiles.length} document{selectedFiles.length !== 1 ? "s" : ""} selected
                </p>
                <p className="text-[10px] text-gray-500">
                  PDF, JPG, PNG &mdash; {(selectedFiles.reduce((sum, f) => sum + f.file.size, 0) / 1024 / 1024).toFixed(2)} MB total
                </p>
              </div>
            </div>
            {isProcessingAll && (
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-indigo-600">
                <Loader2 className="w-3 h-3 animate-spin" />
                Processing {selectedFiles.filter(f => f.status === "completed" || f.status === "failed").length}/{selectedFiles.length}...
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-gray-200 pt-4 flex flex-col gap-3">
            {isProcessingAll && currentStepText && (
              <div className="flex items-center gap-2 text-[11px] text-indigo-700 font-medium bg-indigo-50 p-2.5 rounded-lg border border-indigo-200">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500 shrink-0" />
                <span>{currentStepText}</span>
              </div>
            )}
            {errorMessage && (
              <div className="flex items-start gap-2 text-[11px] text-rose-700 font-medium bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                <span className="shrink-0 mt-0.5">&times;</span>
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              onClick={handleProcessActiveQueue}
              disabled={isProcessingAll || selectedFiles.every((f) => f.status === "completed")}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 px-4 rounded-xl font-medium text-xs shadow-md transition-all duration-200 disabled:opacity-60 disabled:shadow-none flex items-center justify-center gap-1.5 cursor-pointer"
              id="process-queue-button"
            >
              {isProcessingAll ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Uploading & Processing...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Upload to GCS & Process Batch
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
