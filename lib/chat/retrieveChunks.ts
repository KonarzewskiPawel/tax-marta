import {prisma} from "@/lib/prisma";
import {createOpenAIEmbedder} from "@/lib/embeddings/openai";
import {toPgVector} from "@/lib/db/vector";
import {type RetrievedChunk} from "./types";

/** Maximum number of chunks to retrieve from the vector store. */
const DEFAULT_K = 8;

/**
 * Maximum total characters of chunk content to include as LLM context.
 * If the cumulative content exceeds this, the lowest-similarity chunks
 * are dropped until the total fits.
 */
const MAX_CONTEXT_CHARS = 10_000;

/** Options for controlling chunk retrieval. */
export interface RetrieveOptions {
  /**
   * Maximum number of chunks to retrieve.
   * @default 8
   */
  k?: number;
  /**
   * Maximum total characters of chunk content.
   * Chunks are dropped (lowest similarity first) if the total exceeds this.
   * @default 10000
   */
  maxContextChars?: number;
}

/** Raw row shape returned by the pgvector query. */
interface ChunkRow {
  id: string;
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string | null;
  publishedAt: Date | null;
  chunkIndex: number;
  content: string;
  similarity: number;
}

/**
 * Retrieve the most relevant chunks across all ready sources for a query.
 *
 * Embeds the query using the OpenAI embedder, then performs a cosine
 * similarity search across all `source_chunks` whose parent source
 * has status `READY`. Returns the top-k results sorted by similarity
 * (highest first), trimmed to stay within the context character budget.
 *
 * No similarity threshold is applied — the evidence gate should decide
 * whether the results are strong enough to answer.
 *
 * @param query - The user's question text
 * @param opts - Optional retrieval configuration
 * @returns Array of retrieved chunks with source metadata and similarity scores
 */
export async function retrieveChunks(
  query: string,
  opts: RetrieveOptions = {}
): Promise<RetrievedChunk[]> {
  const k = opts.k ?? DEFAULT_K;
  const maxContextChars = opts.maxContextChars ?? MAX_CONTEXT_CHARS;

  // 1. Embed the query
  const embedder = createOpenAIEmbedder();
  const [queryEmbedding] = await embedder.embedMany([query.trim()]);

  // 2. Cross-source similarity search
  //    JOIN source_chunks with Source to get citation metadata.
  //    Only include sources with status 'READY'.
  const rows = await prisma.$queryRawUnsafe<ChunkRow[]>(
    `SELECT
      sc.id,
      sc.source_id AS "sourceId",
      s.title AS "sourceTitle",
      s."sourceUrl" AS "sourceUrl",
      s."publishedAt" AS "publishedAt",
      sc.chunk_index AS "chunkIndex",
      sc.content,
      1 - (sc.embedding <=> $1::vector) AS similarity
    FROM source_chunks sc
    JOIN "Source" s ON s.id = sc.source_id
    WHERE s.status = 'READY'
    ORDER BY sc.embedding <=> $1::vector
    LIMIT $2`,
    toPgVector(queryEmbedding),
    k
  );

  // 3. Trim to context budget (drop lowest-similarity chunks)
  //    Rows are already sorted by similarity desc.
  const chunks: RetrievedChunk[] = [];
  let totalChars = 0;

  for (const row of rows) {
    if (totalChars + row.content.length > maxContextChars && chunks.length > 0) {
      break;
    }
    totalChars += row.content.length;
    chunks.push({
      id: row.id,
      sourceId: row.sourceId,
      sourceTitle: row.sourceTitle,
      sourceUrl: row.sourceUrl,
      publishedAt: row.publishedAt,
      chunkIndex: row.chunkIndex,
      content: row.content,
      similarity: Number(row.similarity),
    });
  }

  return chunks;
}
