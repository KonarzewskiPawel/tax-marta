-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable (IF NOT EXISTS to handle partial prior run)
CREATE TABLE IF NOT EXISTS "source_chunks" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "page_start" INTEGER,
    "page_end" INTEGER,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_chunks_pkey" PRIMARY KEY ("id")
);

-- Drop partial leftovers from failed run (safe even if they don't exist)
DROP INDEX IF EXISTS "source_chunks_source_id_idx";
DROP INDEX IF EXISTS "source_chunks_embedding_hnsw_idx";
ALTER TABLE "source_chunks" DROP CONSTRAINT IF EXISTS "source_chunks_source_id_fkey";

-- Ensure correct column type for source_id (fix from TEXT uuid mismatch)
ALTER TABLE "source_chunks" ALTER COLUMN "source_id" TYPE TEXT;

-- CreateIndex (FK lookup)
CREATE INDEX "source_chunks_source_id_idx" ON "source_chunks"("source_id");

-- CreateIndex (vector similarity search)
CREATE INDEX "source_chunks_embedding_hnsw_idx"
ON "source_chunks" USING hnsw ("embedding" vector_cosine_ops);

-- AddForeignKey
ALTER TABLE "source_chunks"
ADD CONSTRAINT "source_chunks_source_id_fkey"
FOREIGN KEY ("source_id") REFERENCES "Source"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
