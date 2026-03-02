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
   * Roughly corresponds to ~800-1200 tokens depending on language.
   * @default 3500
   */
  maxChars?: number;
  /**
   * Number of characters to overlap between consecutive chunks.
   * Prevents losing context at chunk boundaries.
   * @default 300
   */
  overlapChars?: number;
}

/**
 * Split normalized text into overlapping chunks suitable for embedding.
 *
 * The algorithm advances through the text in steps of `maxChars`,
 * but tries to avoid cutting mid-sentence by backtracking to the
 * last paragraph break (`\n\n`) when one exists in the latter half
 * of the slice. Consecutive chunks overlap by `overlapChars` characters
 * so that context is preserved across boundaries.
 *
 * @param text - Normalized text to split (output of `normalizeText()`)
 * @param opts - Optional chunk size and overlap configuration
 * @returns Array of text chunks with sequential indices
 */
export function chunkText(
  text: string,
  opts: ChunkOptions = {}
): TextChunk[] {
  const maxChars = opts.maxChars ?? 3500;
  const overlapChars = opts.overlapChars ?? 300;
  const minChunkSize = opts.overlapChars ?? 300;

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

    // Try not to cut mid-sentence: backtrack to the last paragraph
    // break if one exists in the latter portion of the slice.
    if (end < text.length) {
      const lastBreak = slice.lastIndexOf("\n\n");
      if (lastBreak > maxChars / 3) {
        slice = slice.slice(0, lastBreak);
      }
    }

    const content = slice.trim();
    if (content.length > 0) {
      chunks.push({ chunkIndex, content });
      chunkIndex++;
    }

    // Advance by the actual slice length minus overlap
    // But never advance by less than minChunkSize to avoid tiny increments
    const advance = slice.length - overlapChars;
    offset += Math.max(minChunkSize, advance);
  }

  return chunks;
}
