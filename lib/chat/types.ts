import {z} from "zod";

// ---------------------------------------------------------------------------
// Retrieved chunk (internal — returned by pgvector retrieval)
// ---------------------------------------------------------------------------

/** A chunk retrieved from the vector store with source metadata. */
export interface RetrievedChunk {
  /** UUID of the source_chunks row. */
  id: string;
  /** UUID of the parent source. */
  sourceId: string;
  /** Human-readable title of the source document. */
  sourceTitle: string;
  /** Optional URL of the source document. */
  sourceUrl: string | null;
  /** Optional publication date of the source document. */
  publishedAt: Date | null;
  /** Zero-based position of this chunk in the source document. */
  chunkIndex: number;
  /** The text content of the chunk. */
  content: string;
  /** Cosine similarity score (0–1, higher is better). */
  similarity: number;
}

// ---------------------------------------------------------------------------
// LLM structured output (Zod schema for generateObject)
// ---------------------------------------------------------------------------

/**
 * Zod schema for the structured output returned by the LLM.
 *
 * The LLM is constrained to this exact shape via `generateObject()`.
 * `chunkIndex` refers to the numbered `[Chunk N]` blocks in the
 * system prompt context — NOT the chunk's `chunkIndex` in the DB.
 */
export const llmResponseSchema = z.object({
  /** The answer text (markdown allowed). */
  answer: z.string().describe(
    "Answer the question using only the provided context. Use markdown formatting."
  ),
  /** Citations referencing chunks from the provided context. */
  citations: z.array(z.object({
    /** Index of the chunk in the context (0-based, matches [Chunk N] numbering). */
    chunkIndex: z.number().int().min(0).describe(
      "Zero-based index of the chunk in the provided context."
    ),
    /** Short verbatim quote (10–25 words) from the chunk that supports the answer. */
    quote: z.string().describe(
      "A short verbatim quote (10–25 words) copied exactly from the chunk text."
    ),
  })).describe(
    "Citations referencing the provided context chunks. Include 1–3 citations."
  ),
  /** How confident the answer is based on available evidence. */
  confidence: z.enum(["low", "medium", "high"]).describe(
    "Confidence level based on how well the context supports the answer."
  ),
  /** Optional clarifying question if the query is ambiguous. */
  clarifyingQuestion: z.string().nullable().describe(
    "A follow-up question to ask the user if the query is ambiguous. Null if not needed."
  ),
});

/** TypeScript type inferred from the LLM response Zod schema. */
export type LLMResponse = z.infer<typeof llmResponseSchema>;

// ---------------------------------------------------------------------------
// Citation (public — included in the API response)
// ---------------------------------------------------------------------------

/** A verified citation pointing to a specific chunk in a source document. */
export interface Citation {
  /** Human-readable title of the source document. */
  sourceTitle: string;
  /** Optional URL of the source document. */
  sourceUrl: string | null;
  /** Optional publication date (ISO 8601 date string). */
  publishedAt: string | null;
  /** Short verbatim quote from the chunk (10–25 words). */
  quote: string;
  /** UUID of the source_chunks row (for audit/debug). */
  chunkId: string;
}

// ---------------------------------------------------------------------------
// Chat API response (public — returned to the client)
// ---------------------------------------------------------------------------

/** The structured response returned by POST /api/admin/chat. */
export interface ChatResponse {
  /** The answer text (markdown). Empty string if refused. */
  answer: string;
  /** Verified citations with quotes from source documents. */
  citations: Citation[];
  /** Confidence level based on evidence quality. */
  confidence: "low" | "medium" | "high";
  /** Whether the bot refused to answer due to insufficient evidence. */
  refused: boolean;
  /** Polish refusal message shown to the user. Null when not refused. */
  refusalMessage: string | null;
  /** Optional clarifying question to help the user refine their query. */
  clarifyingQuestion: string | null;
  /** Actionable suggestion for the user. Null when not refused. */
  suggestion: string | null;
  /** Legal disclaimer. */
  disclaimer: string;
  /** ISO 8601 timestamp of when the response was generated. */
  asOf: string;
}

// ---------------------------------------------------------------------------
// Evidence gate result (internal)
// ---------------------------------------------------------------------------

/** Result of the evidence quality gate evaluation. */
export interface EvidenceGateResult {
  /** Whether the evidence is sufficient to attempt an answer. */
  pass: boolean;
  /** Human-readable explanation of the gate decision. */
  reason: string;
  /** Confidence level determined by the gate. */
  confidence: "low" | "medium" | "high";
}
