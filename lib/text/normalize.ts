/**
 * Regex patterns matching common PDF extraction noise.
 *
 * These patterns target artifacts from web-page-to-PDF exports:
 * - Page footers with timestamps (e.g. "03/03/2026, 10:47 Title here")
 * - Standalone URLs on their own line
 * - Page markers (e.g. "-- 1 of 34 --")
 */
const NOISE_PATTERNS: RegExp[] = [
  // Timestamp footers: "DD/MM/YYYY, HH:MM Title (export)" or similar
  /^\d{2}\/\d{2}\/\d{4},\s+\d{2}:\d{2}\b.*$/gm,
  // Standalone URLs on their own line (optionally followed by page numbers like "1/34")
  /^https?:\/\/\S+.*$/gm,
  // Page markers: "-- 1 of 34 --" or "— 1 of 34 —"
  /^[-—]+\s*\d+\s+of\s+\d+\s*[-—]+$/gm,
];

/**
 * Clean up raw text extracted from a PDF.
 *
 * PDF extraction often produces artifacts: excessive whitespace,
 * redundant line breaks, trailing spaces, and repeated page
 * footers/headers. This function normalizes the text into clean,
 * readable paragraphs that produce better embeddings and chunk
 * boundaries.
 *
 * Transformations applied:
 * 1. Strip common PDF noise (timestamps, URLs, page markers)
 * 2. Collapse multiple spaces/tabs into a single space
 * 3. Collapse 3+ consecutive newlines into a double newline (paragraph break)
 * 4. Trim whitespace from each line
 * 5. Trim the entire result
 *
 * @param input - Raw text extracted from a PDF
 * @returns Cleaned text with normalized whitespace and paragraph breaks
 */
export function normalizeText(input: string): string {
  let result = input;

  // Strip noise patterns
  for (const pattern of NOISE_PATTERNS) {
    result = result.replace(pattern, "");
  }

  return result
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}
