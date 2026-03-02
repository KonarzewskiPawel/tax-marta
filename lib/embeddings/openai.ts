import type {Embedder} from "./embedder";

const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const DEFAULT_MODEL = "text-embedding-3-small";
const DEFAULT_DIMENSION = 1536;

/**
 * Create an OpenAI embeddings adapter.
 *
 * Uses the OpenAI Embeddings API to convert text into vectors.
 * The default model is `text-embedding-3-small` which outputs
 * 1536-dimensional vectors at $0.02 per 1M tokens.
 *
 * Requires `OPENAI_API_KEY` environment variable to be set.
 *
 * @returns An Embedder instance configured for OpenAI
 * @throws Error if `OPENAI_API_KEY` is not set
 */
export function createOpenAIEmbedder(): Embedder {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  return {
    dimension: DEFAULT_DIMENSION,

    async embedMany(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) return [];

      const res = await fetch(OPENAI_EMBEDDINGS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          input: texts,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`OpenAI embeddings error: ${res.status} ${body}`);
      }

      const json = await res.json();

      // OpenAI returns data sorted by index, but sort explicitly to be safe
      const sorted = (json.data as {index: number; embedding: number[]}[])
        .sort((a, b) => a.index - b.index);

      return sorted.map((item) => item.embedding);
    },
  };
}
