import {PDFParse} from "pdf-parse";
// Pre-load the pdfjs-dist worker so the fake-worker setup finds
// WorkerMessageHandler on globalThis and skips the broken dynamic import().
// This is a safety net alongside serverExternalPackages in next.config.ts.
import * as pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs";

(globalThis as any).pdfjsWorker = pdfjsWorker;

/** Result of extracting text from a PDF file. */
export interface PdfExtraction {
  /** The concatenated text content of all pages. */
  text: string;
  /** Total number of pages in the PDF. */
  numPages: number;
}

/**
 * Extract all text content from a PDF buffer.
 *
 * Uses pdf-parse v2 (pdfjs-dist under the hood) to read the PDF
 * and concatenate the text from every page into a single string.
 * The parser is destroyed after use to free resources.
 *
 * @param pdfBuffer - Raw PDF file bytes
 * @returns Extracted text and page count
 */
export async function extractTextFromPdf(
  pdfBuffer: Buffer
): Promise<PdfExtraction> {
  const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });

  try {
    const result = await parser.getText();
    return {
      text: result.text || "",
      numPages: result.total,
    };
  } finally {
    await parser.destroy();
  }
}
