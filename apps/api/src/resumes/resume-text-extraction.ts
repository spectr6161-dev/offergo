import { extname } from "node:path";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

const pdfMimeType = "application/pdf";
const docxMimeType =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const txtMimeTypes = new Set(["text/plain", "text/markdown"]);
const mojibakePattern = /(?:Ð|Ñ|Â|[\u0080-\u009f])/;

export const supportedResumeMimeTypes = new Set([
  pdfMimeType,
  docxMimeType,
  ...txtMimeTypes,
]);

export function inferResumeMimeType(file: Express.Multer.File) {
  const mimeType = file.mimetype?.toLowerCase();
  const extension = extname(file.originalname).toLowerCase();

  if (supportedResumeMimeTypes.has(mimeType)) {
    return mimeType;
  }

  if (extension === ".pdf") {
    return pdfMimeType;
  }

  if (extension === ".docx") {
    return docxMimeType;
  }

  if (extension === ".txt" || extension === ".md") {
    return "text/plain";
  }

  return mimeType ?? "";
}

function countCyrillicCharacters(text: string) {
  return (text.match(/[А-Яа-яЁё]/g) ?? []).length;
}

function countMojibakeCharacters(text: string) {
  return (text.match(mojibakePattern) ?? []).length;
}

export function repairUtf8Mojibake(text: string) {
  if (!mojibakePattern.test(text)) {
    return text;
  }

  const repaired = Buffer.from(text, "latin1").toString("utf8");

  if (
    countCyrillicCharacters(repaired) > countCyrillicCharacters(text) &&
    countMojibakeCharacters(repaired) < countMojibakeCharacters(text)
  ) {
    return repaired;
  }

  return text;
}

export function normalizeUploadedFileName(fileName: string) {
  return repairUtf8Mojibake(fileName);
}

export function normalizeExtractedText(text: string) {
  return repairUtf8Mojibake(text)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

async function extractPdfText(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(buffer: Buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export async function extractResumeText(options: {
  buffer: Buffer;
  mimeType: string;
}) {
  let text: string;

  if (options.mimeType === pdfMimeType) {
    text = await extractPdfText(options.buffer);
  } else if (options.mimeType === docxMimeType) {
    text = await extractDocxText(options.buffer);
  } else if (txtMimeTypes.has(options.mimeType)) {
    text = options.buffer.toString("utf8");
  } else {
    throw new Error("Unsupported resume file type.");
  }

  return normalizeExtractedText(text);
}
