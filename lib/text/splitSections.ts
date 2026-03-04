/**
 * Pattern that indicates the start of a new section in FAQ-style documents.
 *
 * Matches lines starting with the `<digits>Q.` format:
 * - "1Q. Podstawowe informacje o KSeF" — section header (TOC)
 * - "2Q. 1. Co to jest KSeF?"          — Q&A (question + answer)
 * - "28Q. 17. Some question?"           — high-numbered Q&A
 * - "97Q. 16. Another question?"        — high-numbered Q&A
 *
 * The `Q` marker distinguishes actual document sections from plain
 * numbered lists (e.g. "1. Item" inside an answer), preventing
 * false splits on list items within a section.
 */
const SECTION_HEADING_PATTERN = /^\d+Q\.\s+/;

/**
 * Pattern that identifies a Q&A section (has a question number after `Q.`).
 *
 * Matches lines like:
 * - "2Q. 1. Co to jest KSeF?"
 * - "97Q. 16. Another question?"
 *
 * Sections matching SECTION_HEADING_PATTERN but NOT this pattern are
 * considered TOC / question-list blocks and are dropped during splitting.
 */
const QA_SECTION_PATTERN = /^\d+Q\.\s+\d+\.\s+/;

/**
 * Fallback pattern for documents without `Q.` markers.
 *
 * Matches lines starting with `<digits>. <digits>.` (double-numbering)
 * which is common in exported FAQ documents without the Q marker.
 */
const FALLBACK_HEADING_PATTERN = /^\d+\.\s+\d+\.\s+/;

/**
 * Detect which heading pattern a text uses.
 *
 * Scans the first portion of the text for known heading patterns.
 * Prefers the `<digits>Q.` pattern when present, falls back to
 * `<digits>. <digits>.` double-numbering, and returns `null` if
 * neither pattern is found (in which case no section splitting
 * will be performed).
 *
 * @param text - Normalized text to scan for heading patterns
 * @returns The detected RegExp pattern, or null if none found
 */
function detectHeadingPattern(text: string): RegExp | null {
  const lines = text.split("\n");

  // Check first 200 lines for patterns
  const sample = lines.slice(0, 200);

  const hasQPattern = sample.some((line) => SECTION_HEADING_PATTERN.test(line));
  if (hasQPattern) {
    return SECTION_HEADING_PATTERN;
  }

  const hasDoubleNumbering = sample.some((line) => FALLBACK_HEADING_PATTERN.test(line));
  if (hasDoubleNumbering) {
    return FALLBACK_HEADING_PATTERN;
  }

  return null;
}

/**
 * Check whether a section is a TOC / question-list block.
 *
 * A section is considered a TOC block when:
 * - The Q-pattern is in use (not the fallback double-numbering)
 * - The section heading matches `<digits>Q.` but NOT `<digits>Q. <digits>.`
 *
 * TOC blocks contain only a section title and a list of question titles
 * without answers, so they add noise to embeddings without providing
 * retrievable content.
 *
 * @param firstLine - The first line of the section
 * @param isQPattern - Whether the Q-pattern was detected for this document
 * @returns True if the section should be dropped
 */
function isTocBlock(firstLine: string, isQPattern: boolean): boolean {
  if (!isQPattern) return false;
  // Matches Q-pattern heading but NOT a Q&A heading (no second number)
  return SECTION_HEADING_PATTERN.test(firstLine) && !QA_SECTION_PATTERN.test(firstLine);
}

/**
 * Split normalized text into logical sections based on heading patterns.
 *
 * Scans the text line by line and splits whenever a line matches
 * a detected heading pattern. The detection priority is:
 * 1. `<digits>Q.` format (e.g. "2Q. 1. Co to jest KSeF?")
 * 2. `<digits>. <digits>.` double-numbering (e.g. "142. 2. Title")
 * 3. No splitting if neither pattern is found
 *
 * When the Q-pattern is detected, TOC blocks (sections starting with
 * `<digits>Q.` without a question number, e.g. "1Q. Section Title")
 * are dropped entirely. These blocks only contain lists of question
 * titles without answers and add noise to embeddings.
 *
 * Each section includes the heading line and all subsequent lines
 * until the next heading. Text before the first heading is returned
 * as a separate section (e.g. a preamble).
 *
 * If no heading pattern is detected, returns the entire text as
 * a single section.
 *
 * @param text - Normalized text to split into sections
 * @returns Array of section strings, each starting with its heading
 */
export function splitSections(text: string): string[] {
  const pattern = detectHeadingPattern(text);

  // No recognizable heading pattern — return as single section
  if (!pattern) {
    const trimmed = text.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }

  const isQPattern = pattern === SECTION_HEADING_PATTERN;
  const lines = text.split("\n");
  const sections: string[] = [];
  let currentLines: string[] = [];

  for (const line of lines) {
    if (pattern.test(line) && currentLines.length > 0) {
      // Flush the accumulated lines as a section
      const sectionText = currentLines.join("\n").trim();
      if (sectionText.length > 0) {
        // Drop TOC blocks when Q-pattern is active
        const firstLine = currentLines.find((l) => l.trim().length > 0) ?? "";
        if (!isTocBlock(firstLine, isQPattern)) {
          sections.push(sectionText);
        }
      }
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  // Flush remaining lines (also check for TOC)
  const remaining = currentLines.join("\n").trim();
  if (remaining.length > 0) {
    const firstLine = currentLines.find((l) => l.trim().length > 0) ?? "";
    if (!isTocBlock(firstLine, isQPattern)) {
      sections.push(remaining);
    }
  }

  return sections;
}
