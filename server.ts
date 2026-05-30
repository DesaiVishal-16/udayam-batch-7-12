import express, { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import os from "os";
import dotenv from "dotenv";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
import rateLimit from "express-rate-limit";
import pino from "pino";
import { body, validationResult } from "express-validator";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { Storage } from "@google-cloud/storage";

dotenv.config();

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});
app.use("/api/", limiter);

app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info({ method: req.method, url: req.url, ip: req.ip }, "request");
  next();
});

const BUCKET_NAME = process.env.GCS_BUCKET_NAME || "udayam-batch-processing";

let storage: Storage | null = null;
try {
  storage = new Storage({ projectId: process.env.GCS_PROJECT_ID });
  logger.info("Google Cloud Storage initialized");
} catch (error) {
  logger.warn("GCS not configured — running without cloud storage.");
}

async function getBucket() {
  if (!storage) throw new Error("Google Cloud Storage is not configured");
  return storage.bucket(BUCKET_NAME);
}

let ai: GoogleGenAI | null = null;
try {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
  }
} catch (error) {
  logger.error({ err: error }, "Failed to initialize Gemini AI Client");
}

function getGeminiAI(): GoogleGenAI {
  if (ai) return ai;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing.");
  }
  ai = new GoogleGenAI({ apiKey });
  return ai;
}

interface BatchFile {
  id: string;
  fileName: string;
  gcsInputPath: string;
  gcsOutputPath: string;
  status: "queued" | "processing" | "completed" | "failed";
  error?: string;
}

interface BatchJob {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  files: BatchFile[];
  createdAt: string;
  completedAt?: string;
}

const batchJobs = new Map<string, BatchJob>();

const SYSTEM_INSTRUCTION = `
You are a forensic-grade OCR engine and Maharashtra Land Record specialist trained specifically on historical handwritten revenue records including:

- 7/12 extracts
- फेरफार registers
- mutation entries
- handwritten Marathi land records
- old Devanagari administrative documents

Your task is to perform HIGH-ACCURACY extraction from difficult handwritten Maharashtra land records while maintaining FAST execution speed.

CRITICAL:
Do NOT behave like a generic OCR engine.
Do NOT rely only on standard OCR layout parsing.

You must visually inspect:
- handwritten Marathi words
- faint ink strokes
- overwritten text
- low-contrast handwriting
- connected cursive characters
- merged syllables
- side annotations
- margin notes
- circular handwritten markings
- historical revenue terminology

Treat this as HUMAN-LIKE document reading.

==================================================
OCR READING STRATEGY
==================================================

1. First visually understand the overall document structure
2. Then inspect each handwritten region independently
3. Re-read unclear Marathi words character-by-character
4. Examine stroke continuity carefully
5. Use contextual reasoning ONLY as secondary support
6. Never ignore faint handwritten text
7. Never skip margin notes or side remarks
8. Pay special attention to handwritten legal land-category words
9. Distinguish visually similar Marathi words carefully
10. Avoid semantic guessing without visual evidence

==================================================
COMPOUND HANDWRITTEN LEGAL WORD DETECTION
==================================================

Certain Maharashtra legal land terms are commonly written in highly connected, compressed, curved, partially merged, or faded handwriting.

Examples:
- तुकडेबंदी
- भाडेपट्टा
- नजर गहाण
- भूमीधारी
- पुनर्वसन

For these compound legal words:

1. Do NOT require perfectly separated characters
2. Allow merged syllables and connected strokes
3. Allow partial middle-character fading
4. Evaluate overall handwritten flow and legal word pattern
5. Match visible syllable groups instead of isolated characters
6. Prioritize holistic word-shape recognition over strict isolated-character OCR

Examples:
- "तुकडे...दी"
- "तु...डेबंदी"
- "भा...पट्टा"

may still represent valid legal terms.

If:
- beginning syllables match
- ending syllables match
- stroke continuity supports the word
- surrounding legal formatting supports the interpretation
- no better competing Marathi legal word exists

then mark the field as YES.

Do NOT reject compound handwritten legal terms merely because some middle characters are faded or merged.

==================================================
ADAPTIVE LEGAL WORD RECOGNITION
==================================================

Different Marathi legal words require different confidence thresholds.

For LONG and DISTINCTIVE legal words such as:
- भाडेपट्टा
- नजर गहाण
- भूमीधारी
- तुकडेबंदी
- पुनर्वसन

allow partial handwritten reconstruction when:
1. Key syllables are visible
2. Stroke continuity strongly resembles the word
3. The handwritten flow matches expected Marathi structure
4. Nearby legal context supports the interpretation
5. No better competing Marathi legal word exists

For SHORT or COMMON words such as:
- वन
- कुळ
- वतन
- तगाई
- वहिवाट

require stronger direct visual evidence.

Do NOT hallucinate short words from random curves or broken ink.

==================================================
VERY IMPORTANT VALIDATION RULE
==================================================

DO NOT mark YES based only on contextual guessing.

A keyword may be marked YES ONLY IF:
1. Visible character structure supports the word
2. Handwritten stroke flow resembles the Marathi word
3. Multiple visible characters or syllables support the interpretation
4. The word is visually identifiable from the document

Context alone is NOT sufficient.

For long distinctive compound legal terms:
partial reconstruction is allowed.

For short/common legal terms:
strict direct visibility is required.

A FALSE YES is worse than a FALSE NO.

==================================================
HIGH PRIORITY LEGAL KEYWORDS
==================================================

Actively inspect the document for these Marathi legal/revenue words even if handwritten, faint, partially visible, curved, compressed, or merged:

भाडेपट्टा
नजर गहाण
तुकडेबंदी
कुळ
इनाम
देवस्थान
वतन
गावठाण
फॉरेस्ट
वन
वने
भूदान
अतिक्रमण
गुरे चरण/चरई
देवस्थान
कलम 36/36 अ आदिवासी
पुनर्वसन
वक्फ
आदिवासी
चरई
सीलिंग
वहिवाट

==================================================
ANTI-HALLUCINATION RULES
==================================================

Do NOT infer these words using nearby context alone:

- तगाई
- वन
- वतन
- कुळ
- वक्फ
- इनाम
- वहिवाट

These require stronger direct visual evidence.

If visual evidence is weak:
return "NO"

==================================================
EXTRACTION TASK
==================================================

Analyze this Maharashtra 7/12 (Saatbara) document and extract a structured table.

==================================================
CRITICAL EXTRACTION RULES
==================================================

1. Extract Marathi text EXACTLY as visually written
2. Preserve original Marathi spelling
3. Return EXACTLY one table
4. Use EXACTLY the provided 31 columns
5. Do NOT add/remove/rename columns
6. Each row = ONE unique survey/mutation entry
7. First 8 columns must contain actual extracted values. If the file is illegible or does not contain a specific field, return a reasonable guess or leave it empty/unknown but make sure you write in Marathi/English as applicable.
8. Remaining columns must contain ONLY:
  - "YES"
  - "NO"
9. Never leave cells empty. Use "NO" if the check keyword is not observed.
10. Never duplicate rows
11. Ignore decorative borders/non-text artifacts
12. Never hallucinate unseen values
13. Printed and handwritten text both matter
14. Side notes and annotations also count
15. Use balanced precision and recall

==================================================
COLUMN CLASSIFICATION RULE
==================================================

For columns:

"सीलिंग" through "वहिवाट"

Mark:
- "YES" ONLY if visually supported
- "NO" otherwise

Handwritten abbreviations count ONLY if visually recognizable.

Do NOT use pure contextual assumptions.

==================================================
31 REQUIRED COLUMNS
==================================================

"Date",
"File Name",
"भू-धारणा पद्धती",
"गाव",
"तालुका",
"जिल्हा",
"Total Area (क्षेत्र)",
"शेवटचा फेरफार क्रमांक",
"सीलिंग",
"Forest / वन / फॉरेस्ट / वने",
"इनाम",
"भूदान",
"गावठाण",
"कुळ",
"वतन",
"नवीन शर्त",
"अतिक्रमण",
"गुरे चरण/चरई",
"देवस्थान",
"कलम 36/36 अ आदिवासी",
"पुनर्वसन",
"भाडेपट्टा",
"वक्फ",
"तुकडा/तुकडेबंदी",
"अ पा क",
"एकुक",
"नजर गहाण",
"बडिंग",
"भूमीधारी हक्क",
"तगाई",
"वहिवाट"

==================================================
OUTPUT FORMAT
==================================================

Return ONLY valid JSON matching this schema:

{
 "tables": [
  {
   "headers": ["Date", "File Name", "भू-धारणा पद्धती", "गाव", "तालुका", "जिल्हा", "Total Area (क्षेत्र)", "शेवटचा फेरफार क्रमांक", "सीलिंग", "Forest / वन / फॉरेस्ट / वने", "इनाम", "भूदान", "गावठाण", "कुळ", "वतन", "नवीन शर्त", "अतिक्रमण", "गुरे चरण/चरई", "देवस्थान", "कलम 36/36 अ आदिवासी", "पुनर्वसन", "भाडेपट्टा", "वक्फ", "तुकडा/तुकडेबंदी", "अ पा क", "एकुक", "नजर गहाण", "बडिंग", "भूमीधारी हक्क", "तगाई", "वहिवाट"],
   "rows": [
    ["2026-05-27", "Example.pdf", "नवीन अविभाज्य पद्धती", "वाकडी", "कोपरगाव", "अहमदनगर", "२.४५ हे.आर.", "४५३२", "NO", "YES", "NO", "NO", "NO", "YES", "NO", "YES", "NO", "NO", "NO", "NO", "NO", "NO", "NO", "NO", "NO", "NO", "NO", "NO", "NO", "NO", "YES"]
   ]
  }
 ]
}

No markdown.
No explanation.
No commentary.
No additional text.
`;

async function uploadToGCS(fileBuffer: Buffer, destination: string): Promise<void> {
  const bucket = await getBucket();
  const blob = bucket.file(destination);
  await blob.save(fileBuffer, {
    contentType: "application/pdf",
    resumable: false,
  });
  logger.info(`Uploaded to gs://${BUCKET_NAME}/${destination}`);
}

async function downloadFromGCS(sourcePath: string): Promise<Buffer> {
  const bucket = await getBucket();
  const blob = bucket.file(sourcePath);
  const [buffer] = await blob.download();
  return buffer;
}

async function processBatchJob(jobId: string) {
  const job = batchJobs.get(jobId);
  if (!job) return;

  const geminiClient = getGeminiAI();
  job.status = "processing";

  const tempFiles: string[] = [];

  try {
    const requests: { key: string; request: any }[] = [];

    for (const file of job.files) {
      const fileBuffer = await downloadFromGCS(file.gcsInputPath);
      const mimeType = file.fileName.endsWith(".png") ? "image/png"
        : file.fileName.endsWith(".jpg") || file.fileName.endsWith(".jpeg") ? "image/jpeg"
        : "application/pdf";

      const safeName = file.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const tempPdfPath = path.join(os.tmpdir(), `${file.id}_${safeName}`);
      fs.writeFileSync(tempPdfPath, fileBuffer);
      tempFiles.push(tempPdfPath);

      logger.info(`Uploading ${file.fileName} to Gemini File API...`);
      const uploadedFile = await geminiClient.files.upload({
        file: tempPdfPath,
        config: { mimeType },
      });
      logger.info(`Uploaded ${file.fileName} → ${uploadedFile.name}`);

      const fileUri = `https://generativelanguage.googleapis.com/files/${uploadedFile.name.replace("files/", "")}`;

      const promptMessage = `Please process this file named: "${file.fileName}" with legal precision based on your system instructions. Fill in accurate values. If visual inspection is unclear, use your training to locate the words. Return the complete 31-column JSON immediately. Ensure the date column strictly has the modern format or date of upload.`;

      requests.push({
        key: file.id,
        request: {
          contents: [
            {
              parts: [
                { fileData: { fileUri, mimeType } },
                { text: promptMessage },
              ],
            },
          ],
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          generationConfig: { responseMimeType: "application/json" },
        },
      });
    }

    logger.info("Building batch JSONL input...");
    const jsonlContent = requests.map((r) => JSON.stringify(r)).join("\n");
    const tempJsonlPath = path.join(os.tmpdir(), `${jobId}_input.jsonl`);
    fs.writeFileSync(tempJsonlPath, jsonlContent);
    tempFiles.push(tempJsonlPath);
    const uploadedJsonl = await geminiClient.files.upload({
      file: tempJsonlPath,
      config: { mimeType: "application/x-ndjson" },
    });
    logger.info(`JSONL uploaded → ${uploadedJsonl.name}`);

    logger.info("Submitting Gemini Batch job...");
    const batchJob = await geminiClient.batches.create({
      model: "gemini-3.5-flash",
      src: uploadedJsonl.name,
      config: { displayName: `batch_${jobId}` },
    });
    logger.info(`Batch job created: ${batchJob.name} (state: ${batchJob.state})`);

    const MAX_POLL_MS = 60 * 60 * 1000;
    const startTime = Date.now();

    let result = await geminiClient.batches.get({ name: batchJob.name });
    while (
      result.state !== "JOB_STATE_SUCCEEDED" &&
      result.state !== "JOB_STATE_FAILED" &&
      result.state !== "JOB_STATE_CANCELLED"
    ) {
      if (Date.now() - startTime > MAX_POLL_MS) {
        throw new Error("Batch job timed out after 1 hour");
      }
      logger.info(`Batch job ${jobId} state: ${result.state} — waiting 30s...`);
      await new Promise((r) => setTimeout(r, 30000));
      result = await geminiClient.batches.get({ name: batchJob.name });
    }

    logger.info(`Batch job finished with state: ${result.state}`);
    if (result.state !== "JOB_STATE_SUCCEEDED") {
      throw new Error(`Batch job failed: ${result.error?.message || result.state}`);
    }

    const destFileName = result.dest?.fileName;
    if (!destFileName) {
      throw new Error("No output file in batch result");
    }
    logger.info(`Downloading batch output from ${destFileName}...`);

    const tempOutputPath = path.join(os.tmpdir(), `${jobId}_output.jsonl`);
    await geminiClient.files.download({
      file: destFileName,
      downloadPath: tempOutputPath,
    });
    tempFiles.push(tempOutputPath);

    const outputContent = fs.readFileSync(tempOutputPath, "utf-8");
    const outputLines = outputContent.trim().split("\n");
    logger.info(`Parsing ${outputLines.length} output lines...`);

    for (const line of outputLines) {
      if (!line) continue;
      const parsed = JSON.parse(line);
      logger.info(`Batch output for key ${parsed.key}`);

      const matchedFile = job.files.find((f) => f.id === parsed.key);
      if (!matchedFile) {
        logger.warn(`No matching file for key: ${parsed.key}`);
        continue;
      }

      if (parsed.error) {
        logger.warn({ err: parsed.error }, `Error for ${matchedFile.fileName}`);
        matchedFile.status = "failed";
        matchedFile.error = parsed.error.message || JSON.stringify(parsed.error);
        continue;
      }

      const rawResponseText =
        parsed.response?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawResponseText) {
        logger.warn(`No response text for ${matchedFile.fileName}`);
        matchedFile.status = "failed";
        matchedFile.error = "No response text in batch output";
        continue;
      }

      const outputJsonl = JSON.stringify({
        request: { fileName: matchedFile.fileName },
        response: {
          candidates: [{ content: { parts: [{ text: rawResponseText }] } }],
        },
      });
      await uploadToGCS(Buffer.from(outputJsonl), matchedFile.gcsOutputPath);
      matchedFile.status = "completed";
      logger.info(`Completed: ${matchedFile.fileName}`);
    }

    job.status = "completed";
    job.completedAt = new Date().toISOString();
    logger.info(`Batch job ${jobId} completed successfully`);
  } catch (err: any) {
    logger.error({ err }, `Batch job ${jobId} failed`);
    job.status = "failed";
    for (const f of job.files) {
      if (f.status !== "completed") {
        f.status = "failed";
        f.error = err.message;
      }
    }
  } finally {
    for (const tmp of tempFiles) {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }
  }
}

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    hasApiKey: !!process.env.GEMINI_API_KEY,
    gcsConfigured: !!storage,
    bucketName: BUCKET_NAME,
  });
});

app.post(
  "/api/batch/upload",
  [
    body("files").isArray({ min: 1 }).withMessage("files must be a non-empty array"),
    body("files.*.name").isString().notEmpty().withMessage("each file must have a name"),
    body("files.*.base64").isString().notEmpty().withMessage("each file must have base64 data"),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: "Validation failed", details: errors.array() });
    }

    try {
      const { files } = req.body;

      const jobId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const batchFiles: BatchFile[] = [];

      for (const file of files) {
        const fileId = Math.random().toString(36).substring(7);
        const cleanBase64 = file.base64.replace(/^data:.*?;base64,/, "");
        const fileBuffer = Buffer.from(cleanBase64, "base64");

        const gcsInputPath = `inputs/${jobId}/${file.name}`;
        const gcsOutputPath = `outputs/${jobId}/${file.name}.jsonl`;

        await uploadToGCS(fileBuffer, gcsInputPath);

        batchFiles.push({
          id: fileId,
          fileName: file.name,
          gcsInputPath,
          gcsOutputPath,
          status: "queued",
        });
      }

      const job: BatchJob = {
        id: jobId,
        status: "queued",
        files: batchFiles,
        createdAt: new Date().toISOString(),
      };

      batchJobs.set(jobId, job);

      processBatchJob(jobId).catch((err) => {
        logger.error({ err }, `Batch job ${jobId} failed`);
        const j = batchJobs.get(jobId);
        if (j) j.status = "failed";
      });

      res.json({
        success: true,
        jobId,
        fileCount: batchFiles.length,
        status: "queued",
      });
    } catch (err: any) {
      logger.error({ err }, "Upload error");
      res.status(500).json({ error: err.message });
    }
  }
);

app.get("/api/batch/:jobId/status", (req: Request, res: Response) => {
  const job = batchJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job not found." });
  }

  const completedCount = job.files.filter((f) => f.status === "completed").length;
  const failedCount = job.files.filter((f) => f.status === "failed").length;

  res.json({
    jobId: job.id,
    status: job.status,
    totalFiles: job.files.length,
    completedFiles: completedCount,
    failedFiles: failedCount,
    files: job.files.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      status: f.status,
      error: f.error,
    })),
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  });
});

app.get("/api/batch/:jobId/results", async (req: Request, res: Response) => {
  try {
    const job = batchJobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found." });
    }

    const aggregatedResults: any[] = [];
    const bucket = await getBucket();

    for (const file of job.files) {
      if (file.status !== "completed") continue;

      try {
        const [files] = await bucket.getFiles({ prefix: file.gcsOutputPath });
        for (const gcsFile of files) {
          const [buffer] = await gcsFile.download();
          const lines = buffer.toString().trim().split("\n");
          for (const line of lines) {
            if (!line) continue;
            const jsonLine = JSON.parse(line);
            const rawResponseText = jsonLine.response?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!rawResponseText) continue;
            const cleanJsonString = rawResponseText.replace(/```json|```/g, "").trim();
            const extractedFields = JSON.parse(cleanJsonString);
            const ext = file.fileName.split(".").pop()?.toLowerCase();
            let fileType = "application/pdf";
            if (ext === "png") fileType = "image/png";
            else if (ext === "jpg" || ext === "jpeg") fileType = "image/jpeg";

            aggregatedResults.push({
              fileName: file.fileName,
              gcsInputPath: file.gcsInputPath,
              fileType,
              extraction: extractedFields,
            });
          }
        }
      } catch (err) {
        logger.warn({ err }, `Could not read results for ${file.fileName}`);
      }
    }

    res.json({ success: true, jobId: job.id, data: aggregatedResults });
  } catch (err: any) {
    logger.error({ err }, "Results fetch error");
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/batch/jobs", (_req: Request, res: Response) => {
  const jobs = Array.from(batchJobs.values()).map((j) => ({
    id: j.id,
    status: j.status,
    totalFiles: j.files.length,
    createdAt: j.createdAt,
    completedAt: j.completedAt,
  }));
  res.json({ jobs });
});

app.get("/api/file", async (req: Request, res: Response) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).json({ error: "Missing 'path' query parameter" });
    }

    const buffer = await downloadFromGCS(filePath);
    const ext = filePath.split(".").pop()?.toLowerCase();
    let contentType = "application/octet-stream";
    if (ext === "pdf") contentType = "application/pdf";
    else if (ext === "png") contentType = "image/png";
    else if (ext === "jpg" || ext === "jpeg") contentType = "image/jpeg";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `inline; filename="${filePath.split("/").pop()}"`);
    res.send(buffer);
  } catch (err: any) {
    logger.error({ err }, "File fetch error");
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/batch/:jobId/download/:fileName", async (req: Request, res: Response) => {
  try {
    const job = batchJobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found." });
    }

    const file = job.files.find((f) => f.fileName === req.params.fileName);
    if (!file) {
      return res.status(404).json({ error: "File not found in job." });
    }

    const buffer = await downloadFromGCS(file.gcsOutputPath);
    res.setHeader("Content-Type", "application/jsonl");
    res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}.jsonl"`);
    res.send(buffer);
  } catch (err: any) {
    logger.error({ err }, "Download error");
    res.status(500).json({ error: err.message });
  }
});

app.post(
  "/api/extract",
  [
    body("file").isObject().withMessage("file object is required"),
    body("file.base64").isString().notEmpty().withMessage("file.base64 is required"),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: "Validation failed", details: errors.array() });
    }

    try {
      const { file } = req.body;
      const geminiClient = getGeminiAI();
      const cleanBase64 = file.base64.replace(/^data:.*?;base64,/, "");

      let mimeType = file.type || "application/pdf";
      if (file.name && file.name.endsWith(".png")) mimeType = "image/png";
      if (file.name && (file.name.endsWith(".jpg") || file.name.endsWith(".jpeg"))) mimeType = "image/jpeg";

      const promptMessage = `Please process this file named: "${file.name}" with legal precision based on your system instructions. Fill in accurate values. If visual inspection is unclear, use your training to locate the words. Return the complete 31-column JSON immediately. Ensure the date column strictly has the modern format or date of upload.`;

      const response = await geminiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          { inlineData: { mimeType, data: cleanBase64 } },
          { text: promptMessage },
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
        },
      });

      const responseText = response.text || "";
      let parsedData;
      try {
        const jsonMatch = responseText.match(/(\{[\s\S]*\})/);
        if (jsonMatch) {
          parsedData = JSON.parse(jsonMatch[0]);
        } else {
          parsedData = JSON.parse(responseText);
        }
      } catch (parseError) {
        logger.error({ responseText }, "Gemini AI output formatting error");
        return res.status(500).json({
          error: "Failed to parse the structured extractor output from Gemini AI.",
          raw: responseText,
        });
      }

      if (storage) {
        try {
          const base64Clean = file.base64.replace(/^data:.*?;base64,/, "");
          const fileBuffer = Buffer.from(base64Clean, "base64");
          const gcsInputPath = `inputs/single/${Date.now()}_${file.name}`;
          await uploadToGCS(fileBuffer, gcsInputPath);

          const outputJsonl = JSON.stringify({
            request: { fileName: file.name },
            response: { candidates: [{ content: { parts: [{ text: JSON.stringify(parsedData) }] } }] },
          });
          const gcsOutputPath = `outputs/single/${Date.now()}_${file.name}.jsonl`;
          await uploadToGCS(Buffer.from(outputJsonl), gcsOutputPath);
        } catch (gcsErr) {
          logger.warn({ err: gcsErr }, "Failed to persist to GCS (non-blocking)");
        }
      }

      return res.json({ success: true, fileName: file.name, data: parsedData });
    } catch (err: any) {
      logger.error({ err }, "API Error during Extraction");
      return res.status(500).json({ error: err.message || "Unknown error during extractor execution." });
    }
  }
);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    logger.info(`Server running on http://0.0.0.0:${PORT} [${process.env.NODE_ENV || "development"}]`);
    if (!storage) {
      logger.warn("GCS not configured. Set GCS_PROJECT_ID in .env to enable cloud storage.");
    }
    if (!process.env.GEMINI_API_KEY) {
      logger.warn("GEMINI_API_KEY not set. AI features will fail.");
    }
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutdown signal received");
    server.close(() => {
      logger.info("HTTP server closed");
      process.exit(0);
    });
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
