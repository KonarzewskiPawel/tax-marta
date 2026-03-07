import {describe, expect, it} from "vitest";
import {validateCitations} from "@/lib/chat/validateCitations";
import {type Citation, type RetrievedChunk} from "@/lib/chat/types";

function makeChunk(args: Partial<RetrievedChunk> & {id: string; content: string}): RetrievedChunk {
  return {
    id: args.id,
    sourceId: args.sourceId ?? "source-1",
    sourceTitle: args.sourceTitle ?? "Default Source",
    sourceUrl: args.sourceUrl ?? null,
    publishedAt: args.publishedAt ?? null,
    chunkIndex: args.chunkIndex ?? 0,
    content: args.content,
    similarity: args.similarity ?? 0.8,
  };
}

function makeCitation(args: Partial<Citation> & {chunkId: string; quote: string}): Citation {
  return {
    sourceTitle: args.sourceTitle ?? "Default Source",
    sourceUrl: args.sourceUrl ?? null,
    publishedAt: args.publishedAt ?? null,
    quote: args.quote,
    chunkId: args.chunkId,
  };
}

describe("validateCitations", () => {
  // -----------------------------------------------------------------------
  // Basic pass-through
  // -----------------------------------------------------------------------

  it("keeps a citation whose quote is a verbatim substring of the chunk", () => {
    const chunks = [
      makeChunk({id: "c1", content: "The quick brown fox jumps over the lazy dog."}),
    ];
    const citations = [
      makeCitation({chunkId: "c1", quote: "quick brown fox"}),
    ];

    const result = validateCitations(citations, chunks);

    expect(result).toHaveLength(1);
    expect(result[0].quote).toBe("quick brown fox");
    expect(result[0].chunkId).toBe("c1");
  });

  it("returns empty array when given empty citations", () => {
    const chunks = [
      makeChunk({id: "c1", content: "Some content here."}),
    ];

    const result = validateCitations([], chunks);

    expect(result).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // Chunk ID validation
  // -----------------------------------------------------------------------

  it("drops citations that reference a non-existent chunk ID", () => {
    const chunks = [
      makeChunk({id: "c1", content: "Valid chunk content."}),
    ];
    const citations = [
      makeCitation({chunkId: "c1", quote: "Valid chunk content."}),
      makeCitation({chunkId: "missing-id", quote: "some quote"}),
    ];

    const result = validateCitations(citations, chunks);

    expect(result).toHaveLength(1);
    expect(result[0].chunkId).toBe("c1");
  });

  it("returns empty when all citations reference missing chunks", () => {
    const chunks = [
      makeChunk({id: "c1", content: "Real chunk."}),
    ];
    const citations = [
      makeCitation({chunkId: "bad-1", quote: "a"}),
      makeCitation({chunkId: "bad-2", quote: "b"}),
    ];

    const result = validateCitations(citations, chunks);

    expect(result).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // Whitespace normalization
  // -----------------------------------------------------------------------

  it("matches quotes after collapsing whitespace in both quote and content", () => {
    const chunks = [
      makeChunk({
        id: "c1",
        content: "The  quick\n\tbrown   fox  jumps.",
      }),
    ];
    const citations = [
      makeCitation({chunkId: "c1", quote: "The quick brown fox jumps."}),
    ];

    const result = validateCitations(citations, chunks);

    expect(result).toHaveLength(1);
    expect(result[0].quote).toBe("The quick brown fox jumps.");
  });

  it("matches when quote has extra whitespace that normalizes to a substring", () => {
    const chunks = [
      makeChunk({id: "c1", content: "hello world foo bar"}),
    ];
    const citations = [
      makeCitation({chunkId: "c1", quote: "  hello   world  "}),
    ];

    const result = validateCitations(citations, chunks);

    expect(result).toHaveLength(1);
    expect(result[0].quote).toBe("  hello   world  ");
  });

  // -----------------------------------------------------------------------
  // Safe snippet replacement
  // -----------------------------------------------------------------------

  it("replaces an invalid quote with a safe snippet from the chunk", () => {
    const content = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty";
    const chunks = [
      makeChunk({id: "c1", content}),
    ];
    const citations = [
      makeCitation({chunkId: "c1", quote: "this quote does not exist in the chunk"}),
    ];

    const result = validateCitations(citations, chunks);

    expect(result).toHaveLength(1);
    // Safe snippet = first 18 words
    expect(result[0].quote).toBe(
      "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen"
    );
  });

  it("replaces an empty quote with a safe snippet", () => {
    const chunks = [
      makeChunk({id: "c1", content: "alpha beta gamma delta epsilon"}),
    ];
    const citations = [
      makeCitation({chunkId: "c1", quote: ""}),
    ];

    const result = validateCitations(citations, chunks);

    expect(result).toHaveLength(1);
    expect(result[0].quote).toBe("alpha beta gamma delta epsilon");
  });

  it("safe snippet handles content shorter than 18 words", () => {
    const chunks = [
      makeChunk({id: "c1", content: "short content here"}),
    ];
    const citations = [
      makeCitation({chunkId: "c1", quote: "totally fabricated quote"}),
    ];

    const result = validateCitations(citations, chunks);

    expect(result).toHaveLength(1);
    expect(result[0].quote).toBe("short content here");
  });

  // -----------------------------------------------------------------------
  // MAX_CITATIONS limit (max 3)
  // -----------------------------------------------------------------------

  it("limits output to 3 citations even when more are valid", () => {
    const chunks = [
      makeChunk({id: "c1", content: "content one", similarity: 0.9}),
      makeChunk({id: "c2", content: "content two", similarity: 0.8}),
      makeChunk({id: "c3", content: "content three", similarity: 0.7}),
      makeChunk({id: "c4", content: "content four", similarity: 0.6}),
    ];
    const citations = [
      makeCitation({chunkId: "c1", quote: "content one"}),
      makeCitation({chunkId: "c2", quote: "content two"}),
      makeCitation({chunkId: "c3", quote: "content three"}),
      makeCitation({chunkId: "c4", quote: "content four"}),
    ];

    const result = validateCitations(citations, chunks);

    expect(result).toHaveLength(3);
  });

  it("keeps the top 3 by similarity score", () => {
    const chunks = [
      makeChunk({id: "c1", content: "content one", similarity: 0.5}),
      makeChunk({id: "c2", content: "content two", similarity: 0.95}),
      makeChunk({id: "c3", content: "content three", similarity: 0.7}),
      makeChunk({id: "c4", content: "content four", similarity: 0.85}),
    ];
    const citations = [
      makeCitation({chunkId: "c1", quote: "content one"}),
      makeCitation({chunkId: "c2", quote: "content two"}),
      makeCitation({chunkId: "c3", quote: "content three"}),
      makeCitation({chunkId: "c4", quote: "content four"}),
    ];

    const result = validateCitations(citations, chunks);

    expect(result).toHaveLength(3);
    const ids = result.map((c) => c.chunkId);
    expect(ids).toEqual(["c2", "c4", "c3"]);
  });

  // -----------------------------------------------------------------------
  // Sorting by similarity
  // -----------------------------------------------------------------------

  it("sorts citations by descending similarity", () => {
    const chunks = [
      makeChunk({id: "c1", content: "aaa", similarity: 0.3}),
      makeChunk({id: "c2", content: "bbb", similarity: 0.9}),
      makeChunk({id: "c3", content: "ccc", similarity: 0.6}),
    ];
    const citations = [
      makeCitation({chunkId: "c1", quote: "aaa"}),
      makeCitation({chunkId: "c2", quote: "bbb"}),
      makeCitation({chunkId: "c3", quote: "ccc"}),
    ];

    const result = validateCitations(citations, chunks);

    expect(result.map((c) => c.chunkId)).toEqual(["c2", "c3", "c1"]);
  });

  // -----------------------------------------------------------------------
  // Preserves other citation fields
  // -----------------------------------------------------------------------

  it("preserves sourceTitle, sourceUrl, and publishedAt on valid citations", () => {
    const chunks = [
      makeChunk({id: "c1", content: "the actual text"}),
    ];
    const citations = [
      makeCitation({
        chunkId: "c1",
        quote: "the actual text",
        sourceTitle: "My Document",
        sourceUrl: "https://example.com/doc",
        publishedAt: "2026-01-15",
      }),
    ];

    const result = validateCitations(citations, chunks);

    expect(result).toHaveLength(1);
    expect(result[0].sourceTitle).toBe("My Document");
    expect(result[0].sourceUrl).toBe("https://example.com/doc");
    expect(result[0].publishedAt).toBe("2026-01-15");
  });

  it("preserves metadata when quote is replaced with safe snippet", () => {
    const chunks = [
      makeChunk({id: "c1", content: "real content here"}),
    ];
    const citations = [
      makeCitation({
        chunkId: "c1",
        quote: "fabricated nonsense",
        sourceTitle: "Important Doc",
        sourceUrl: "https://example.com",
        publishedAt: "2025-12-01",
      }),
    ];

    const result = validateCitations(citations, chunks);

    expect(result).toHaveLength(1);
    expect(result[0].sourceTitle).toBe("Important Doc");
    expect(result[0].sourceUrl).toBe("https://example.com");
    expect(result[0].publishedAt).toBe("2025-12-01");
    expect(result[0].quote).toBe("real content here");
  });

  // -----------------------------------------------------------------------
  // Mixed valid/invalid in a single call
  // -----------------------------------------------------------------------

  it("handles a mix of valid, invalid-quote, and missing-chunk citations", () => {
    const chunks = [
      makeChunk({id: "c1", content: "first chunk text here", similarity: 0.9}),
      makeChunk({id: "c2", content: "second chunk text here", similarity: 0.7}),
    ];
    const citations = [
      makeCitation({chunkId: "c1", quote: "first chunk text here"}),       // valid
      makeCitation({chunkId: "c2", quote: "wrong quote entirely"}),        // invalid quote → replaced
      makeCitation({chunkId: "c999", quote: "nonexistent chunk"}),         // dropped
    ];

    const result = validateCitations(citations, chunks);

    expect(result).toHaveLength(2);
    // Sorted by similarity: c1 (0.9) first, c2 (0.7) second
    expect(result[0].chunkId).toBe("c1");
    expect(result[0].quote).toBe("first chunk text here");
    expect(result[1].chunkId).toBe("c2");
    expect(result[1].quote).toBe("second chunk text here");
  });
});
