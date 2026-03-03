import {type NextRequest} from "next/server";
import {prisma} from "@/lib/prisma";
import {verifyRequest} from "@/lib/auth";
import {createOpenAIEmbedder} from "@/lib/embeddings/openai";
import {toPgVector} from "@/lib/db/vector";

export const runtime = "nodejs";

/** Shape of a retrieved chunk with similarity score. */
interface RetrievedChunk {
  id: string;
  chunkIndex: number;
  content: string;
  similarity: number;
}

/**
 * Test retrieval endpoint for semantic search within a source's chunks.
 *
 * Takes a query string parameter `q`, embeds it using OpenAI, and performs
 * a cosine similarity search against the source's chunk embeddings.
 *
 * Query parameters:
 * - `q` (required): The search query text
 * - `limit` (optional): Max number of results (default 5, max 20)
 *
 * @returns JSON array of matching chunks with similarity scores
 *
 * example: http://localhost:3000/api/admin/sources/be4f7555-30e2-4ff3-b9cd-646c13841006/test-retrieval?q=co%20to%20jest%20ksef
 */
export async function GET(
  request: NextRequest,
  {params}: {params: Promise<{id: string}>}
) {
  const authError = verifyRequest(request);
  if (authError) return authError;

  try {
    const {id} = await params;
    const url = new URL(request.url);
    const query = url.searchParams.get("q");
    const limitParam = url.searchParams.get("limit");

    if (!query || query.trim().length === 0) {
      return Response.json(
        {error: "Missing required query parameter: q"},
        {status: 400}
      );
    }

    // Validate limit
    let limit = 5;
    if (limitParam) {
      const parsed = parseInt(limitParam, 10);
      if (isNaN(parsed) || parsed < 1) {
        return Response.json(
          {error: "Invalid limit parameter"},
          {status: 400}
        );
      }
      limit = Math.min(parsed, 20);
    }

    // Verify source exists and is ready
    const source = await prisma.source.findUnique({where: {id}});
    if (!source) {
      return Response.json({error: "Source not found"}, {status: 404});
    }
    if (source.status !== "READY") {
      return Response.json(
        {error: `Source is not ready for retrieval (status: ${source.status})`},
        {status: 400}
      );
    }

    // Embed the query
    const embedder = createOpenAIEmbedder();
    const [queryEmbedding] = await embedder.embedMany([query.trim()]);

    // Perform similarity search using pgvector cosine distance
    // The <=> operator computes cosine distance (1 - cosine_similarity)
    // We return (1 - distance) as similarity score
    const results = await prisma.$queryRawUnsafe<RetrievedChunk[]>(
      `SELECT 
        id,
        chunk_index as "chunkIndex",
        content,
        1 - (embedding <=> $1::vector) as similarity
      FROM source_chunks
      WHERE source_id = $2
      ORDER BY embedding <=> $1::vector
      LIMIT $3`,
      toPgVector(queryEmbedding),
      id,
      limit
    );

    return Response.json({
      query: query.trim(),
      sourceId: id,
      sourceTitle: source.title,
      results: results.map((r) => ({
        id: r.id,
        chunkIndex: r.chunkIndex,
        content: r.content,
        similarity: Number(r.similarity.toFixed(4)),
      })),
    });
  } catch (error) {
    console.error("Failed to perform retrieval:", error);
    return Response.json({error: "Internal server error"}, {status: 500});
  }
}
