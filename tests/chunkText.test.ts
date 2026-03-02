import {describe, expect, it} from "vitest";
import {chunkText} from "@/lib/text/chunk";

/**
 * Build sample text by repeating a sentence with paragraph breaks.
 *
 * @param sentence - Sentence to repeat
 * @param count - Number of repetitions
 * @returns Combined text with paragraph separators
 */
function repeatParagraph(sentence: string, count: number): string {
  return Array.from({ length: count })
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
    const chunks = chunkText(text, { maxChars: 1000, overlapChars: 200 });
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      expect(chunk.content.length).toBeLessThanOrEqual(1000);
    });
  });

  it("includes overlap between consecutive chunks", () => {
    const text = repeatParagraph("Overlap check sentence.", 100);
    const chunks = chunkText(text, { maxChars: 800, overlapChars: 100 });

    for (let i = 0; i < chunks.length - 1; i++) {
      const end = chunks[i].content.slice(-100);
      const start = chunks[i + 1].content.slice(0, 100);
      expect(start).toContain(end.slice(0, 40));
    }
  });

  it("avoids cutting at a paragraph break when possible", () => {
    const text = [
      repeatParagraph("Paragraph one content.", 5),
      repeatParagraph("Paragraph two content.", 5),
      repeatParagraph("Paragraph three content.", 5),
    ].join("\n\n");

    const chunks = chunkText(text, { maxChars: 500, overlapChars: 100 });

    // The first chunk should end at a paragraph boundary if present
    const first = chunks[0].content;
    expect(first.endsWith(". ") || first.endsWith(".")).toBe(true);
  });

  it("does not create tiny tail chunks", () => {
    const text = repeatParagraph("Tail chunk check sentence.", 80);
    const chunks = chunkText(text, { maxChars: 800, overlapChars: 300 });

    const last = chunks[chunks.length - 1];
    expect(last.content.length).toBeGreaterThan(300);
  });
});
