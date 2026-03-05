import {type EvidenceGateResult, type RetrievedChunk} from "./types";

// ---------------------------------------------------------------------------
// Tunable thresholds
// ---------------------------------------------------------------------------

/** Similarity score considered "strong" evidence for a single chunk. */
const STRONG_THRESHOLD = 0.50;

/** Similarity score considered "very strong" — enough on its own. */
const VERY_STRONG_THRESHOLD = 0.55;

/** Minimum similarity to count a chunk as "weak but relevant". */
const WEAK_THRESHOLD = 0.40;

/** Minimum number of weak-or-better chunks to pass (unless one is very strong). */
const MIN_WEAK_CHUNKS = 2;

/** Minimum distinct sources for high confidence. */
const MIN_DISTINCT_SOURCES_HIGH = 2;

// ---------------------------------------------------------------------------
// Gate logic
// ---------------------------------------------------------------------------

/**
 * Evaluate whether retrieved chunks provide enough evidence to answer.
 *
 * This is the core of "citation-gated" behavior. The gate runs after
 * retrieval and before the LLM call, preventing wasted API calls and
 * hallucinated answers when evidence is insufficient.
 *
 * Rules:
 * - **Refuse**: 0 chunks, or no chunks above weak threshold.
 * - **High confidence**: top chunk >= strong AND >= 2 chunks >= weak
 *   AND >= 2 distinct sources.
 * - **Medium confidence**: 1 chunk >= very strong (single strong hit),
 *   OR >= 2 chunks >= weak (even from 1 source).
 * - **Refuse**: everything else.
 *
 * @param chunks - Retrieved chunks sorted by similarity (highest first)
 * @returns Gate result with pass/fail, reason, and confidence level
 */
export function evaluateEvidence(chunks: RetrievedChunk[]): EvidenceGateResult {
  if (chunks.length === 0) {
    return {
      pass: false,
      reason: "No relevant source chunks found.",
      confidence: "low",
    };
  }

  const topSimilarity = chunks[0].similarity;
  const countAboveStrong = chunks.filter((c) => c.similarity >= STRONG_THRESHOLD).length;
  const countAboveWeak = chunks.filter((c) => c.similarity >= WEAK_THRESHOLD).length;
  const distinctSources = new Set(
    chunks.filter((c) => c.similarity >= WEAK_THRESHOLD).map((c) => c.sourceId)
  ).size;

  // High confidence: top is strong + multiple weak-or-better + diverse sources
  if (
    topSimilarity >= STRONG_THRESHOLD &&
    countAboveWeak >= MIN_WEAK_CHUNKS &&
    distinctSources >= MIN_DISTINCT_SOURCES_HIGH
  ) {
    return {
      pass: true,
      reason: `Strong evidence: ${countAboveStrong} strong chunk(s), ${countAboveWeak} relevant chunk(s) from ${distinctSources} source(s).`,
      confidence: "high",
    };
  }

  // Medium confidence: one very strong hit (sufficient on its own)
  if (topSimilarity >= VERY_STRONG_THRESHOLD) {
    return {
      pass: true,
      reason: `Single strong match (similarity ${topSimilarity.toFixed(2)}).`,
      confidence: "medium",
    };
  }

  // Medium confidence: multiple weak-or-better chunks (even from 1 source)
  if (countAboveWeak >= MIN_WEAK_CHUNKS) {
    return {
      pass: true,
      reason: `${countAboveWeak} relevant chunk(s) from ${distinctSources} source(s).`,
      confidence: "medium",
    };
  }

  // Refuse: insufficient evidence
  return {
    pass: false,
    reason: `Insufficient evidence: top similarity ${topSimilarity.toFixed(2)}, only ${countAboveWeak} chunk(s) above threshold.`,
    confidence: "low",
  };
}
