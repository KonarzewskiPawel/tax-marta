/**
 * Generic interface for text embedding providers.
 *
 * Implementations convert text strings into fixed-length numeric vectors
 * suitable for similarity search. The interface is provider-agnostic —
 * swap OpenAI for Voyage, Cohere, or a local model by implementing this.
 */
export interface Embedder {
  /** The dimensionality of the output vectors (e.g. 1536 for OpenAI text-embedding-3-small). */
  dimension: number;

  /**
   * Embed multiple texts in a single batch request.
   *
   * @param texts - Array of strings to embed
   * @returns Array of embedding vectors, one per input text, in the same order
   */
  embedMany(texts: string[]): Promise<number[][]>;
}
