import {prisma} from "@/lib/prisma";
import {getFile} from "@/lib/storage";
import {extractTextFromPdf} from "@/lib/pdf/extractText";
import {normalizeText} from "@/lib/text/normalize";
import {chunkText} from "@/lib/text/chunk";
import {createOpenAIEmbedder} from "@/lib/embeddings/openai";
import {type EmbeddedChunk, replaceSourceChunks} from "./storeChunks";

/** Maximum number of chunks to embed in a single API call. */
const EMBED_BATCH_SIZE = 16;

/**
 * Process a source end-to-end: extract text, chunk, embed, and store.
 *
 * This is the main ingestion pipeline. It performs these steps:
 * 1. Load the PDF from local storage
 * 2. Set status to PROCESSING
 * 3. Extract raw text from PDF
 * 4. Normalize the extracted text
 * 5. Split into overlapping chunks
 * 6. Embed all chunks via OpenAI (in batches)
 * 7. Store chunks + embeddings in the database (pgvector)
 * 8. Set status to READY (or FAILED on error)
 *
 * Safe to call multiple times — existing chunks are replaced.
 *
 * @param sourceId - The UUID of the Source record to process
 * @throws Error if the source is not found or any pipeline step fails
 */
export async function processSource(sourceId: string): Promise<void> {
  // 1. Load source record
  const source = await prisma.source.findUnique({where: {id: sourceId}});
  if (!source) {
    throw new Error(`Source not found: ${sourceId}`);
  }

  // 2. Set status to PROCESSING
  await prisma.source.update({
    where: {id: sourceId},
    data: {status: "PROCESSING"},
  });

  try {
    // 3. Read PDF from storage
    const pdfBuffer = await getFile(source.storageKey);

    // 4. Extract text
    const {text: rawText} = await extractTextFromPdf(pdfBuffer);
    if (!rawText.trim()) {
      throw new Error("No text could be extracted from the PDF");
    }

    // 5. Normalize text
    const normalized = normalizeText(rawText);

    // 6. Chunk text
    const chunks = chunkText(normalized);
    if (chunks.length === 0) {
      throw new Error("Text chunking produced no chunks");
    }

    console.log(`Source ${sourceId}: extracted ${chunks.length} chunks`);

    // 7. Embed chunks in batches
    const embedder = createOpenAIEmbedder();
    const enriched: EmbeddedChunk[] = [];

    for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
      const vectors = await embedder.embedMany(
        batch.map((c) => c.content),
      );

      for (let j = 0; j < batch.length; j++) {
        enriched.push({
          chunkIndex: batch[j].chunkIndex,
          content: batch[j].content,
          embedding: vectors[j],
        });
      }
    }

    // 8. Store chunks + embeddings
    await replaceSourceChunks({sourceId, chunks: enriched});

    // 9. Set status to READY
    await prisma.source.update({
      where: {id: sourceId},
      data: {status: "READY"},
    });

    console.log(`Source ${sourceId}: processing complete (${enriched.length} chunks stored)`);
  } catch (error) {
    // Set status to FAILED
    await prisma.source.update({
      where: {id: sourceId},
      data: {status: "FAILED"},
    });

    console.error(`Source ${sourceId}: processing failed:`, error);
    throw error;
  }
}
