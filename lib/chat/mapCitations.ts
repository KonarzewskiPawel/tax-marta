import {type Citation, type LLMResponse, type RetrievedChunk} from "./types";

/**
 * Map LLM citation references to full source metadata.
 *
 * The LLM returns citations referencing the numbered `[Chunk N]` blocks
 * from the system prompt context. This function translates those indices
 * into full citation objects with source metadata and chunk IDs.
 *
 * Invalid chunk indices are ignored.
 *
 * @param llmResponse - Structured LLM output containing citation indices
 * @param chunks - Retrieved chunks in the same order as the prompt context
 * @returns Array of mapped citations
 */
export function mapCitations(
  llmResponse: LLMResponse,
  chunks: RetrievedChunk[]
): Citation[] {
  const citations: Citation[] = [];

  for (const citation of llmResponse.citations) {
    const chunk = chunks[citation.chunkIndex];
    if (!chunk) continue;

    citations.push({
      sourceTitle: chunk.sourceTitle,
      sourceUrl: chunk.sourceUrl,
      publishedAt: chunk.publishedAt
        ? chunk.publishedAt.toISOString().split("T")[0]
        : null,
      quote: citation.quote,
      chunkId: chunk.id,
    });
  }

  return citations;
}
