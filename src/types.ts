export interface LandRecord {
  id: string;
  date: string;
  fileName: string;
  bgTenure: string; // भू-धारणा पद्धती
  village: string;  // गाव
  taluka: string;   // तालुका
  district: string;  // जिल्हा
  totalArea: string; // Total Area (क्षेत्र)
  lastMutation: string; // शेवटचा फेरफार क्रमांक
  
  // High Priority Legal Keywords (YES/NO)
  ceiling: "YES" | "NO"; // सीलिंग
  forest: "YES" | "NO"; // Forest / वन / फॉरेस्ट / वने
  inam: "YES" | "NO"; // इनाम
  bhoodan: "YES" | "NO"; // भूदान
  gaothan: "YES" | "NO"; // गावठाण
  kul: "YES" | "NO"; // कुळ
  watan: "YES" | "NO"; // वतन
  newCondition: "YES" | "NO"; // नवीन शर्त
  encroachment: "YES" | "NO"; // अतिक्रमण
  grazing: "YES" | "NO"; // गुरे चरण/चरई
  devasthan: "YES" | "NO"; // देवस्थान
  tribal: "YES" | "NO"; // कलम 36/36 अ आदिवासी
  rehabilitation: "YES" | "NO"; // पुनर्वसन
  leasehold: "YES" | "NO"; // भाडेपट्टा
  waqf: "YES" | "NO"; // वक्फ
  fragmentLimit: "YES" | "NO"; // तुकडा/तुकडेबंदी
  apk: "YES" | "NO"; // अ पा क
  ekuk: "YES" | "NO"; // एकुक
  hypothecation: "YES" | "NO"; // नजर गहाण
  bunding: "YES" | "NO"; // बडिंग
  bhumidhari: "YES" | "NO"; // भूमीधारी हक्क
  tagai: "YES" | "NO"; // तगाई
  cultivation: "YES" | "NO"; // वहिवाट

  // Metadata
  isVerified: boolean;
  notes?: string;
  confidenceScore?: number; // Simulated AI extraction confidence based on matches
  fileData?: string; // Base64 file data for viewing
  fileType?: string; // MIME type of the file
}

export type LandRecordFieldName = keyof Omit<LandRecord, "id" | "isVerified" | "notes" | "confidenceScore">;

export const COLUMN_KEYS: { label: string; field: LandRecordFieldName }[] = [
  { label: "Date", field: "date" },
  { label: "File Name", field: "fileName" },
  { label: "भू-धारणा पद्धती", field: "bgTenure" },
  { label: "गाव", field: "village" },
  { label: "तालुका", field: "taluka" },
  { label: "जिल्हा", field: "district" },
  { label: "Total Area (क्षेत्र)", field: "totalArea" },
  { label: "शेवटचा फेरफार क्रमांक", field: "lastMutation" },
  { label: "सीलिंग", field: "ceiling" },
  { label: "Forest / वन / फॉरेस्ट / वने", field: "forest" },
  { label: "इनाम", field: "inam" },
  { label: "भूदान", field: "bhoodan" },
  { label: "गावठाण", field: "gaothan" },
  { label: "कुळ", field: "kul" },
  { label: "वतन", field: "watan" },
  { label: "नवीन शर्त", field: "newCondition" },
  { label: "अतिक्रमण", field: "encroachment" },
  { label: "गुरे चरण/चरई", field: "grazing" },
  { label: "देवस्थान", field: "devasthan" },
  { label: "कलम 36/36 अ आदिवासी", field: "tribal" },
  { label: "पुनर्वसन", field: "rehabilitation" },
  { label: "भाडेपट्टा", field: "leasehold" },
  { label: "वक्फ", field: "waqf" },
  { label: "तुकडा/तुकडेबंदी", field: "fragmentLimit" },
  { label: "अ पा क", field: "apk" },
  { label: "एकुक", field: "ekuk" },
  { label: "नजर गहाण", field: "hypothecation" },
  { label: "बडिंग", field: "bunding" },
  { label: "भूमीधारी हक्क", field: "bhumidhari" },
  { label: "तगाई", field: "tagai" },
  { label: "वहिवाट", field: "cultivation" },
];
