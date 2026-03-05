import {beforeEach, describe, expect, it, type Mock, vi} from "vitest";
import {retrieveChunks} from "@/lib/chat/retrieveChunks";
import {createOpenAIEmbedder} from "@/lib/embeddings/openai";
import {prisma} from "@/lib/prisma";

vi.mock("@/lib/embeddings/openai", () => ({
  createOpenAIEmbedder: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
  },
}));

interface MockRow {
  id: string;
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string | null;
  publishedAt: Date | null;
  chunkIndex: number;
  content: string;
  similarity: number;
}

const embedManyMock = vi.fn();

describe("retrieveChunks", () => {
  beforeEach(() => {
    embedManyMock.mockReset();
    embedManyMock.mockResolvedValue([[0.1, 0.2, 0.3]]);

    (createOpenAIEmbedder as Mock).mockReturnValue({
      dimension: 3,
      embedMany: embedManyMock,
    });

    (prisma.$queryRawUnsafe as Mock).mockReset();
  });

  it("embeds a trimmed query and uses the provided k", async () => {
    (prisma.$queryRawUnsafe as Mock).mockResolvedValue([]);

    await retrieveChunks("  hello world  ", {k: 5});

    expect(embedManyMock).toHaveBeenCalledWith(["hello world"]);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("FROM source_chunks"),
      "[0.1,0.2,0.3]",
      5
    );
  });

  it("maps database rows to RetrievedChunk objects", async () => {
    const rows: MockRow[] = [
      {
        id: "chunk-1",
        sourceId: "source-1",
        sourceTitle: "Doc A",
        sourceUrl: "https://example.com/doc-a",
        publishedAt: new Date("2026-03-01T00:00:00.000Z"),
        chunkIndex: 2,
        content: "Example content A.",
        similarity: 0.42,
      },
    ];

    (prisma.$queryRawUnsafe as Mock).mockResolvedValue(rows);

    const result = await retrieveChunks("question", {k: 1});

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "chunk-1",
      sourceId: "source-1",
      sourceTitle: "Doc A",
      sourceUrl: "https://example.com/doc-a",
      publishedAt: new Date("2026-03-01T00:00:00.000Z"),
      chunkIndex: 2,
      content: "Example content A.",
      similarity: 0.42,
    });
  });

  it("drops chunks that exceed maxContextChars", async () => {
    const rows: MockRow[] = [
      {
        id: "chunk-1",
        sourceId: "source-1",
        sourceTitle: "Doc A",
        sourceUrl: null,
        publishedAt: null,
        chunkIndex: 0,
        content: "123456", // 6 chars
        similarity: 0.9,
      },
      {
        id: "chunk-2",
        sourceId: "source-1",
        sourceTitle: "Doc A",
        sourceUrl: null,
        publishedAt: null,
        chunkIndex: 1,
        content: "abcdef", // 6 chars
        similarity: 0.8,
      },
    ];

    (prisma.$queryRawUnsafe as Mock).mockResolvedValue(rows);

    const result = await retrieveChunks("question", {k: 2, maxContextChars: 10});

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("chunk-1");
  });

  it("keeps the first chunk even if it exceeds maxContextChars", async () => {
    const rows: MockRow[] = [
      {
        id: "chunk-1",
        sourceId: "source-1",
        sourceTitle: "Doc A",
        sourceUrl: null,
        publishedAt: null,
        chunkIndex: 0,
        content: "01234567890123456789", // 20 chars
        similarity: 0.9,
      },
      {
        id: "chunk-2",
        sourceId: "source-1",
        sourceTitle: "Doc A",
        sourceUrl: null,
        publishedAt: null,
        chunkIndex: 1,
        content: "short",
        similarity: 0.8,
      },
    ];

    (prisma.$queryRawUnsafe as Mock).mockResolvedValue(rows);

    const result = await retrieveChunks("question", {k: 2, maxContextChars: 10});

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("chunk-1");
  });

  it("preserves row order from the similarity query", async () => {
    const rows: MockRow[] = [
      {
        id: "chunk-1",
        sourceId: "source-1",
        sourceTitle: "Doc A",
        sourceUrl: null,
        publishedAt: null,
        chunkIndex: 0,
        content: "Top result.",
        similarity: 0.95,
      },
      {
        id: "chunk-2",
        sourceId: "source-2",
        sourceTitle: "Doc B",
        sourceUrl: null,
        publishedAt: null,
        chunkIndex: 1,
        content: "Second result.",
        similarity: 0.85,
      },
    ];

    (prisma.$queryRawUnsafe as Mock).mockResolvedValue(rows);

    const result = await retrieveChunks("question", {k: 2});

    expect(result.map((chunk) => chunk.id)).toEqual(["chunk-1", "chunk-2"]);
  });
});
