import {describe, expect, it} from "vitest";
import {chunkText} from "@/lib/text/chunk";
import {normalizeText} from "@/lib/text/normalize";

/**
 * Build sample text by repeating a sentence with paragraph breaks.
 *
 * @param sentence - Sentence to repeat
 * @param count - Number of repetitions
 * @returns Combined text with paragraph separators
 */
function repeatParagraph(sentence: string, count: number): string {
  return Array.from({length: count})
    .map(() => sentence)
    .join("\n\n");
}

describe("chunkText", () => {
  it("returns empty array for empty input", () => {
    expect(chunkText("")).toEqual([]);
  });

  it("returns a single chunk for short input", () => {
    const text = "Short text.";
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe(text);
    expect(chunks[0].chunkIndex).toBe(0);
  });

  it("splits long input into multiple chunks", () => {
    const text = repeatParagraph("This is a sentence about embeddings.", 200);
    const chunks = chunkText(text, {maxChars: 500, overlapChars: 100});
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      expect(chunk.content.length).toBeLessThanOrEqual(500);
    });
  });

  it("includes overlap between consecutive chunks", () => {
    const text = repeatParagraph("Overlap check sentence.", 100);
    const chunks = chunkText(text, {maxChars: 500, overlapChars: 100});

    for (let i = 0; i < chunks.length - 1; i++) {
      const end = chunks[i].content.slice(-80);
      const start = chunks[i + 1].content.slice(0, 80);
      expect(start).toContain(end.slice(0, 30));
    }
  });

  it("avoids cutting at a paragraph break when possible", () => {
    const text = [
      repeatParagraph("Paragraph one content.", 5),
      repeatParagraph("Paragraph two content.", 5),
      repeatParagraph("Paragraph three content.", 5),
    ].join("\n\n");

    const chunks = chunkText(text, {maxChars: 400, overlapChars: 80});

    // The first chunk should end at a paragraph boundary if present
    const first = chunks[0].content;
    expect(first.endsWith(". ") || first.endsWith(".")).toBe(true);
  });

  it("does not create tiny tail chunks", () => {
    const text = repeatParagraph("Tail chunk check sentence.", 80);
    const chunks = chunkText(text, {maxChars: 500, overlapChars: 100});

    const last = chunks[chunks.length - 1];
    expect(last.content.length).toBeGreaterThan(100);
  });

  it("uses default maxChars of 1500", () => {
    const text = repeatParagraph("Default size test sentence here.", 200);
    const chunks = chunkText(text);
    chunks.forEach((chunk) => {
      expect(chunk.content.length).toBeLessThanOrEqual(1500);
    });
  });

  it("prefers line breaks over mid-word splits", () => {
    // Build text with single line breaks (no paragraph breaks)
    const lines = Array.from({length: 50})
      .map((_, i) => `Line ${i}: Some content that fills up space in this chunk.`)
      .join("\n");

    const chunks = chunkText(lines, {maxChars: 500, overlapChars: 80});

    // Each chunk (except possibly last) should end at a line boundary
    for (let i = 0; i < chunks.length - 1; i++) {
      const content = chunks[i].content;
      const lastChar = content[content.length - 1];
      expect(lastChar).toBe(".");
    }
  });
});

describe("normalizeText", () => {
  it("collapses multiple spaces into one", () => {
    expect(normalizeText("hello   world")).toBe("hello world");
  });

  it("collapses 3+ newlines into double newline", () => {
    expect(normalizeText("hello\n\n\n\nworld")).toBe("hello\n\nworld");
  });

  it("trims each line", () => {
    expect(normalizeText("  hello  \n  world  ")).toBe("hello\nworld");
  });

  it("strips timestamp footers", () => {
    const input = "Some content.\n03/03/2026, 10:47 KSeF — Pytania i odpowiedzi (export)\nMore content.";
    const result = normalizeText(input);
    expect(result).not.toContain("03/03/2026");
    expect(result).toContain("Some content.");
    expect(result).toContain("More content.");
  });

  it("strips standalone URLs", () => {
    const input = "Some content.\nhttps://ksef.podatki.gov.pl/pytania-i-odpowiedzi-ksef-20/ 1/34\nMore content.";
    const result = normalizeText(input);
    expect(result).not.toContain("https://");
    expect(result).toContain("Some content.");
    expect(result).toContain("More content.");
  });

  it("strips page markers", () => {
    const input = "Some content.\n-- 1 of 34 --\nMore content.";
    const result = normalizeText(input);
    expect(result).not.toContain("-- 1 of 34 --");
    expect(result).toContain("Some content.");
    expect(result).toContain("More content.");
  });

  it("does not strip inline URLs", () => {
    const input = "Visit https://example.com for more info.";
    const result = normalizeText(input);
    expect(result).toContain("https://example.com");
  });
});
