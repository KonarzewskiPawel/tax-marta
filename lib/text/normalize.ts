/**
 * Clean up raw text extracted from a PDF.
 *
 * PDF extraction often produces artifacts: excessive whitespace,
 * redundant line breaks, and trailing spaces on each line.
 * This function normalizes the text into clean, readable paragraphs
 * that produce better embeddings and chunk boundaries.
 *
 * Transformations applied:
 * 1. Collapse multiple spaces/tabs into a single space
 * 2. Collapse 3+ consecutive newlines into a double newline (paragraph break)
 * 3. Trim whitespace from each line
 * 4. Trim the entire result
 *
 * @param input - Raw text extracted from a PDF
 * @returns Cleaned text with normalized whitespace and paragraph breaks
 */
export function normalizeText(input: string): string {
  return input
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}
