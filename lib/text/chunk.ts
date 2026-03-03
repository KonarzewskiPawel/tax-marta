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
 * Split normalized text into overlapping chunks suitable for embedding.
 *
 * The algorithm advances through the text in steps of `maxChars`,
 * but tries to avoid cutting mid-sentence by backtracking to find
 * the best boundary point: first a paragraph break (`\n\n`), then
 * a line break (`\n`), then a sentence boundary (`. ` followed by
 * an uppercase letter). Consecutive chunks overlap by `overlapChars`
 * characters so that context is preserved across boundaries.
 *
 * @param text - Normalized text to split (output of `normalizeText()`)
 * @param opts - Optional chunk size and overlap configuration
 * @returns Array of text chunks with sequential indices
 */
export function chunkText(
  text: string,
  opts: ChunkOptions = {}
): TextChunk[] {
  const maxChars = opts.maxChars ?? 1500;
  const overlapChars = opts.overlapChars ?? 200;
  const minChunkSize = overlapChars;

  const chunks: TextChunk[] = [];
  let offset = 0;
  let chunkIndex = 0;

  while (offset < text.length) {
    // If remaining text is smaller than minimum chunk size, skip
    // (it's already included in the overlap of the previous chunk)
    const remaining = text.length - offset;
    if (remaining <= minChunkSize && chunks.length > 0) {
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
      chunks.push({chunkIndex, content});
      chunkIndex++;
    }

    // Advance by the actual slice length minus overlap
    // But never advance by less than minChunkSize to avoid tiny increments
    const advance = slice.length - overlapChars;
    offset += Math.max(minChunkSize, advance);
  }

  return chunks;
}
