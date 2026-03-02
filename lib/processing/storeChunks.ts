import {prisma} from "@/lib/prisma";
import {toPgVector} from "@/lib/db/vector";

/** A chunk with its content and embedding, ready to be stored. */
export interface EmbeddedChunk {
  /** Zero-based position of this chunk in the source document. */
  chunkIndex: number;
  /** The text content of the chunk. */
  content: string;
  /** The embedding vector for this chunk. */
  embedding: number[];
}

/**
 * Replace all chunks for a source with new ones.
 *
 * Deletes any existing chunks for the given source (making this
 * safe to call repeatedly for reprocessing), then inserts the
 * new chunks with their embeddings via raw SQL.
 *
 * Uses raw SQL because Prisma does not natively support the
 * pgvector `vector` column type.
 *
 * @param args.sourceId - The UUID of the parent Source record
 * @param args.chunks - Array of chunks with content and embeddings to insert
 */
export async function replaceSourceChunks(args: {
  sourceId: string;
  chunks: EmbeddedChunk[];
}): Promise<void> {
  const {sourceId, chunks} = args;

  // Delete old chunks (safe for reprocessing)
  await prisma.$executeRawUnsafe(
    `DELETE FROM source_chunks WHERE source_id = $1`,
    sourceId,
  );

  // Insert new chunks with embeddings
  for (const chunk of chunks) {
    const embeddingStr = toPgVector(chunk.embedding);
    await prisma.$executeRawUnsafe(
      `INSERT INTO source_chunks (id, source_id, chunk_index, content, embedding)
       VALUES (gen_random_uuid(), $1, $2, $3, $4::vector)`,
      sourceId,
      chunk.chunkIndex,
      chunk.content,
      embeddingStr,
    );
  }
}
