import {splitSections} from "./splitSections";

/** A single chunk of text with its sequential index. */
export interface TextChunk {
  /** Zero-based position of this chunk in the source document. */
  chunkIndex: number;
  /** The text content of the chunk. */
  content: string;
}

/** Options for controlling chunk size and overlap. */
export interface ChunkOptions {
  /**
   * Maximum number of characters per chunk.
   * Roughly corresponds to ~300-400 tokens depending on language.
   * @default 1500
   */
  maxChars?: number;
  /**
   * Number of characters to overlap between consecutive chunks.
   * Prevents losing context at chunk boundaries.
   * @default 200
   */
  overlapChars?: number;
  /**
   * When true, first split text on numbered section headings
   * (e.g. "1. Title", "142. 2. Title") before applying character-
   * based splitting. Sections that fit within `maxChars` become
   * a single chunk; oversized sections are sub-split with overlap.
   * @default true
   */
  sectionAware?: boolean;
}

/**
 * Find the best split point within a text slice to avoid cutting
 * mid-sentence. Searches backwards from the end for, in order of
 * preference: a paragraph break, a line break, or a sentence boundary.
 *
 * @param slice - The text slice to search within
 * @param minPosition - Minimum position to search back to (prevents too-short chunks)
 * @returns Index of the best split point, or -1 if none found
 */
function findBestSplitPoint(slice: string, minPosition: number): number {
  // 1. Try paragraph break (\n\n)
  const paraBreak = slice.lastIndexOf("\n\n");
  if (paraBreak > minPosition) {
    return paraBreak;
  }

  // 2. Try line break (\n)
  const lineBreak = slice.lastIndexOf("\n");
  if (lineBreak > minPosition) {
    return lineBreak;
  }

  // 3. Try sentence boundary (. followed by space or newline)
  const sentenceMatch = slice.substring(0, slice.length).match(/\.\s(?=[A-Z\u0080-\uFFFF])/g);
  if (sentenceMatch) {
    // Find the last sentence boundary after minPosition
    let lastIdx = -1;
    let searchFrom = minPosition;
    while (true) {
      const idx = slice.indexOf(sentenceMatch[sentenceMatch.length - 1], searchFrom);
      if (idx === -1 || idx <= minPosition) break;
      lastIdx = idx + 1; // Include the period
      searchFrom = idx + 1;
    }
    if (lastIdx > minPosition) {
      return lastIdx;
    }
  }

  return -1;
}

/**
 * Split a single piece of text into overlapping chunks by character count.
 *
 * This is the low-level character-based splitter. It advances through
 * the text in steps of `maxChars`, backtracking to find the best
 * boundary point (paragraph break, line break, or sentence boundary).
 *
 * @param text - Text to split
 * @param maxChars - Maximum characters per chunk
 * @param overlapChars - Overlap between consecutive chunks
 * @returns Array of trimmed text strings
 */
function splitByChars(
  text: string,
  maxChars: number,
  overlapChars: number
): string[] {
  const minChunkSize = overlapChars;
  const parts: string[] = [];
  let offset = 0;

  while (offset < text.length) {
    const remaining = text.length - offset;
    if (remaining <= minChunkSize && parts.length > 0) {
      break;
    }

    const end = Math.min(offset + maxChars, text.length);
    let slice = text.slice(offset, end);

    // Try not to cut mid-sentence: backtrack to the best boundary
    if (end < text.length) {
      const splitAt = findBestSplitPoint(slice, Math.floor(maxChars / 3));
      if (splitAt > 0) {
        slice = slice.slice(0, splitAt);
      }
    }

    const content = slice.trim();
    if (content.length > 0) {
      parts.push(content);
    }

    const advance = slice.length - overlapChars;
    offset += Math.max(minChunkSize, advance);
  }

  return parts;
}

/**
 * Split normalized text into overlapping chunks suitable for embedding.
 *
 * When `sectionAware` is true (the default), the text is first split
 * on numbered section headings (e.g. "1. Title", "142. 2. Title").
 * Each section that fits within `maxChars` becomes a single chunk.
 * Sections exceeding `maxChars` are sub-split using character-based
 * splitting with overlap.
 *
 * When `sectionAware` is false, the text is split purely by character
 * count with overlap, backtracking to the best boundary point.
 *
 * @param text - Normalized text to split (output of `normalizeText()`)
 * @param opts - Optional chunk size, overlap, and section-awareness configuration
 * @returns Array of text chunks with sequential indices
 */
export function chunkText(
  text: string,
  opts: ChunkOptions = {}
): TextChunk[] {
  const maxChars = opts.maxChars ?? 1500;
  const overlapChars = opts.overlapChars ?? 200;
  const sectionAware = opts.sectionAware ?? true;

  if (!sectionAware) {
    // Pure character-based splitting
    return splitByChars(text, maxChars, overlapChars).map(
      (content, i) => ({chunkIndex: i, content})
    );
  }

  // Section-aware splitting:
  // 1. Split into logical sections based on numbered headings
  // 2. Sections that fit within maxChars become one chunk
  // 3. Oversized sections are sub-split with character-based splitting
  const sections = splitSections(text);
  const chunks: TextChunk[] = [];
  let chunkIndex = 0;

  for (const section of sections) {
    if (section.length <= maxChars) {
      chunks.push({chunkIndex, content: section});
      chunkIndex++;
    } else {
      // Section too large — sub-split with overlap
      const subChunks = splitByChars(section, maxChars, overlapChars);
      for (const sub of subChunks) {
        chunks.push({chunkIndex, content: sub});
        chunkIndex++;
      }
    }
  }

  return chunks;
}
