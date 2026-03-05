import {describe, expect, it} from "vitest";
import {mapCitations} from "@/lib/chat/mapCitations";
import {type LLMResponse, type RetrievedChunk} from "@/lib/chat/types";

function makeChunk(args: Partial<RetrievedChunk> & {id: string}): RetrievedChunk {
  return {
    id: args.id,
    sourceId: args.sourceId ?? "source-1",
    sourceTitle: args.sourceTitle ?? "Default Source",
    sourceUrl: args.sourceUrl ?? null,
    publishedAt: args.publishedAt ?? null,
    chunkIndex: args.chunkIndex ?? 0,
    content: args.content ?? "Default content.",
    similarity: args.similarity ?? 0.5,
  };
}

describe("mapCitations", () => {
  it("maps chunkIndex references to full citation metadata", () => {
    const chunks: RetrievedChunk[] = [
      makeChunk({
        id: "chunk-a",
        sourceId: "source-a",
        sourceTitle: "Doc A",
        sourceUrl: "https://example.com/a",
        publishedAt: new Date("2026-03-01T00:00:00.000Z"),
        content: "Alpha content.",
      }),
      makeChunk({
        id: "chunk-b",
        sourceId: "source-b",
        sourceTitle: "Doc B",
        sourceUrl: null,
        publishedAt: null,
        content: "Beta content.",
      }),
    ];

    const llmResponse: LLMResponse = {
      answer: "Answer text.",
      citations: [
        {chunkIndex: 0, quote: "Alpha quote."},
        {chunkIndex: 1, quote: "Beta quote."},
      ],
      confidence: "high",
      clarifyingQuestion: null,
    };

    const result = mapCitations(llmResponse, chunks);

    expect(result).toEqual([
      {
        sourceTitle: "Doc A",
        sourceUrl: "https://example.com/a",
        publishedAt: "2026-03-01",
        quote: "Alpha quote.",
        chunkId: "chunk-a",
      },
      {
        sourceTitle: "Doc B",
        sourceUrl: null,
        publishedAt: null,
        quote: "Beta quote.",
        chunkId: "chunk-b",
      },
    ]);
  });

  it("drops citations with invalid chunkIndex", () => {
    const chunks: RetrievedChunk[] = [
      makeChunk({id: "chunk-a", sourceTitle: "Doc A"}),
    ];

    const llmResponse: LLMResponse = {
      answer: "Answer text.",
      citations: [
        {chunkIndex: 0, quote: "Valid quote."},
        {chunkIndex: 2, quote: "Invalid quote."},
      ],
      confidence: "medium",
      clarifyingQuestion: null,
    };

    const result = mapCitations(llmResponse, chunks);

    expect(result).toHaveLength(1);
    expect(result[0].chunkId).toBe("chunk-a");
    expect(result[0].quote).toBe("Valid quote.");
  });

  it("preserves citation order from LLM response", () => {
    const chunks: RetrievedChunk[] = [
      makeChunk({id: "chunk-a", sourceTitle: "Doc A"}),
      makeChunk({id: "chunk-b", sourceTitle: "Doc B"}),
      makeChunk({id: "chunk-c", sourceTitle: "Doc C"}),
    ];

    const llmResponse: LLMResponse = {
      answer: "Answer text.",
      citations: [
        {chunkIndex: 2, quote: "Third chunk quote."},
        {chunkIndex: 0, quote: "First chunk quote."},
      ],
      confidence: "low",
      clarifyingQuestion: "Clarify?",
    };

    const result = mapCitations(llmResponse, chunks);

    expect(result.map((c) => c.chunkId)).toEqual(["chunk-c", "chunk-a"]);
  });
});
