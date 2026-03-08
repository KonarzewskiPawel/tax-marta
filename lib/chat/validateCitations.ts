import {type Citation, type RetrievedChunk} from "./types";

/** Maximum citations to keep in the response. */
const MAX_CITATIONS = 3;

/**
 * Validate LLM citations against retrieved chunks.
 *
 * - Drops citations that reference missing chunk IDs
 * - Ensures quotes are present in the chunk content (whitespace-normalized)
 * - Replaces invalid quotes with a safe snippet from the chunk
 * - Limits to max citations (highest similarity first)
 *
 * @param citations - Citations produced by the LLM (already mapped to chunk IDs)
 * @param chunks - Retrieved chunks used as evidence
 * @returns Validated citations array
 */
export function validateCitations(
  citations: Citation[],
  chunks: RetrievedChunk[]
): Citation[] {
  const chunkById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const normalizedContentById = new Map(
    chunks.map((chunk) => [chunk.id, normalizeWhitespace(chunk.content)])
  );

  const validated: Citation[] = [];

  for (const citation of citations) {
    //Check chunkId exists in retrieved set — remove hallucinated citations
    const chunk = chunkById.get(citation.chunkId);
    if (!chunk) continue;

    const normalizedQuote = normalizeWhitespace(citation.quote);
    const normalizedContent = normalizedContentById.get(citation.chunkId) ?? "";

    if (normalizedQuote && normalizedContent.includes(normalizedQuote)) {
      validated.push(citation);
      continue;
    }

    // Replace invalid quote with a safe snippet from the chunk content
    validated.push({
      ...citation,
      quote: buildSafeSnippet(chunk.content, 18),
    });
  }

  // Sort by similarity (desc) and limit to MAX_CITATIONS
  const bySimilarity = validated
    .map((citation) => ({
      citation,
      similarity: chunkById.get(citation.chunkId)?.similarity ?? 0,
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, MAX_CITATIONS)
    .map((item) => item.citation);

  return bySimilarity;
}

/**
 * Normalize whitespace for substring checks.
 *
 * @param input - Raw text
 * @returns Normalized text with collapsed whitespace
 */
function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

/**
 * Build a safe snippet from text by taking the first N words.
 *
 * @param text - Source text to extract from
 * @param wordCount - Number of words to include
 * @returns Snippet string
 */
function buildSafeSnippet(text: string, wordCount: number): string {
  const words = normalizeWhitespace(text).split(" ");
  return words.slice(0, wordCount).join(" ");
}
