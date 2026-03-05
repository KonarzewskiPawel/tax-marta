import {describe, expect, it} from "vitest";
import {evaluateEvidence} from "@/lib/chat/evidenceGate";
import {type RetrievedChunk} from "@/lib/chat/types";

/**
 * Create a mock RetrievedChunk with the given similarity and sourceId.
 *
 * @param similarity - Cosine similarity score (0–1)
 * @param sourceId - Source UUID (defaults to "source-a")
 * @returns A minimal RetrievedChunk for testing
 */
function mockChunk(similarity: number, sourceId = "source-a"): RetrievedChunk {
  return {
    id: `chunk-${Math.random().toString(36).slice(2, 8)}`,
    sourceId,
    sourceTitle: "Test Source",
    sourceUrl: null,
    publishedAt: null,
    chunkIndex: 0,
    content: "Test content.",
    similarity,
  };
}

describe("evaluateEvidence", () => {
  // -----------------------------------------------------------------------
  // Refuse scenarios
  // -----------------------------------------------------------------------

  it("refuses when no chunks are provided", () => {
    const result = evaluateEvidence([]);
    expect(result.pass).toBe(false);
    expect(result.confidence).toBe("low");
    expect(result.reason).toContain("No relevant");
  });

  it("refuses when all chunks are below weak threshold (0.40)", () => {
    const chunks = [
      mockChunk(0.39),
      mockChunk(0.35),
      mockChunk(0.30),
    ];
    const result = evaluateEvidence(chunks);
    expect(result.pass).toBe(false);
    expect(result.confidence).toBe("low");
    expect(result.reason).toContain("Insufficient evidence");
  });

  it("refuses when only 1 chunk is above weak but below very strong", () => {
    const chunks = [
      mockChunk(0.45),
      mockChunk(0.35),
      mockChunk(0.30),
    ];
    const result = evaluateEvidence(chunks);
    expect(result.pass).toBe(false);
    expect(result.confidence).toBe("low");
  });

  // -----------------------------------------------------------------------
  // Medium confidence scenarios
  // -----------------------------------------------------------------------

  it("passes with medium confidence when 1 chunk is very strong (>=0.55)", () => {
    const chunks = [
      mockChunk(0.58),
      mockChunk(0.30),
    ];
    const result = evaluateEvidence(chunks);
    expect(result.pass).toBe(true);
    expect(result.confidence).toBe("medium");
    expect(result.reason).toContain("Single strong match");
  });

  it("passes with medium confidence when >=2 chunks above weak from 1 source", () => {
    const chunks = [
      mockChunk(0.48, "source-a"),
      mockChunk(0.42, "source-a"),
      mockChunk(0.30, "source-a"),
    ];
    const result = evaluateEvidence(chunks);
    expect(result.pass).toBe(true);
    expect(result.confidence).toBe("medium");
    expect(result.reason).toContain("2 relevant");
  });

  it("passes with medium confidence at exactly weak threshold (0.40)", () => {
    const chunks = [
      mockChunk(0.45),
      mockChunk(0.40),
    ];
    const result = evaluateEvidence(chunks);
    expect(result.pass).toBe(true);
    expect(result.confidence).toBe("medium");
  });

  it("returns medium (not high) when strong + 2 weak but only 1 source", () => {
    const chunks = [
      mockChunk(0.52, "source-a"),
      mockChunk(0.44, "source-a"),
      mockChunk(0.41, "source-a"),
    ];
    const result = evaluateEvidence(chunks);
    expect(result.pass).toBe(true);
    // Only 1 distinct source, so not high confidence
    expect(result.confidence).toBe("medium");
  });

  // -----------------------------------------------------------------------
  // High confidence scenarios
  // -----------------------------------------------------------------------

  it("passes with high confidence when strong + 2 weak + 2 distinct sources", () => {
    const chunks = [
      mockChunk(0.55, "source-a"),
      mockChunk(0.45, "source-b"),
      mockChunk(0.42, "source-a"),
    ];
    const result = evaluateEvidence(chunks);
    expect(result.pass).toBe(true);
    expect(result.confidence).toBe("high");
    expect(result.reason).toContain("Strong evidence");
  });

  it("passes with high confidence with many chunks from multiple sources", () => {
    const chunks = [
      mockChunk(0.65, "source-a"),
      mockChunk(0.55, "source-b"),
      mockChunk(0.50, "source-c"),
      mockChunk(0.45, "source-a"),
      mockChunk(0.42, "source-b"),
    ];
    const result = evaluateEvidence(chunks);
    expect(result.pass).toBe(true);
    expect(result.confidence).toBe("high");
  });

  it("requires distinct sources for high (not just multiple chunks)", () => {
    // 3 chunks above weak, 1 above strong, but all from same source
    const chunks = [
      mockChunk(0.60, "source-a"),
      mockChunk(0.45, "source-a"),
      mockChunk(0.42, "source-a"),
    ];
    const result = evaluateEvidence(chunks);
    expect(result.pass).toBe(true);
    // Should be medium, not high (only 1 source)
    expect(result.confidence).toBe("medium");
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it("counts distinct sources only from chunks above weak threshold", () => {
    // 1 strong chunk from source-a, 1 chunk below weak from source-b
    const chunks = [
      mockChunk(0.52, "source-a"),
      mockChunk(0.41, "source-a"),
      mockChunk(0.35, "source-b"), // below weak, should not count
    ];
    const result = evaluateEvidence(chunks);
    expect(result.pass).toBe(true);
    // Only 1 distinct source above weak
    expect(result.confidence).toBe("medium");
  });

  it("handles exactly-at-boundary similarity values", () => {
    // Exactly 0.50 (strong), exactly 0.40 (weak), 2 sources
    const chunks = [
      mockChunk(0.50, "source-a"),
      mockChunk(0.40, "source-b"),
    ];
    const result = evaluateEvidence(chunks);
    expect(result.pass).toBe(true);
    expect(result.confidence).toBe("high");
  });

  it("handles single chunk at exactly very strong threshold", () => {
    const chunks = [mockChunk(0.55)];
    const result = evaluateEvidence(chunks);
    expect(result.pass).toBe(true);
    expect(result.confidence).toBe("medium");
  });

  it("returns reason with similarity score when refusing", () => {
    const chunks = [mockChunk(0.38)];
    const result = evaluateEvidence(chunks);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("0.38");
  });
});
