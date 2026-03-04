import {describe, expect, it} from "vitest";
import {chunkText} from "@/lib/text/chunk";
import {normalizeText} from "@/lib/text/normalize";
import {splitSections} from "@/lib/text/splitSections";

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

describe("splitSections", () => {
  it("returns entire text as single section when no headings found", () => {
    const text = "Just some plain text without any numbered headings.";
    const sections = splitSections(text);
    expect(sections).toHaveLength(1);
    expect(sections[0]).toBe(text);
  });

  it("drops TOC blocks and keeps Q&A sections", () => {
    const text = [
      "1Q. Podstawowe informacje o KSeF",
      "1. Co to jest KSeF?",
      "2. Jak korzystać z KSeF?",
      "3. Co to jest e-Faktura?",
      "2Q. 1. Co to jest KSeF?",
      "KSeF to system do faktur.",
      "3Q. 2. Jak korzystać z KSeF?",
      "Można korzystać przez API.",
    ].join("\n");

    const sections = splitSections(text);
    expect(sections).toHaveLength(2);
    // TOC block (1Q. without second number) is dropped
    // Only Q&A sections remain
    expect(sections[0]).toContain("2Q. 1. Co to jest KSeF?");
    expect(sections[0]).toContain("KSeF to system do faktur.");
    expect(sections[1]).toContain("3Q. 2. Jak korzystać z KSeF?");
    expect(sections[1]).toContain("Można korzystać przez API.");
  });

  it("drops multiple TOC blocks interspersed with Q&As", () => {
    const text = [
      "1Q. Section One",
      "1. Question A?",
      "2. Question B?",
      "2Q. 1. Question A?",
      "Answer A.",
      "3Q. 2. Question B?",
      "Answer B.",
      "4Q. Section Two",
      "1. Question C?",
      "5Q. 1. Question C?",
      "Answer C.",
    ].join("\n");

    const sections = splitSections(text);
    expect(sections).toHaveLength(3);
    expect(sections[0]).toContain("2Q. 1. Question A?");
    expect(sections[1]).toContain("3Q. 2. Question B?");
    expect(sections[2]).toContain("5Q. 1. Question C?");
    // TOC blocks should not appear in any section
    const all = sections.join("\n");
    expect(all).not.toContain("1Q. Section One");
    expect(all).not.toContain("4Q. Section Two");
  });

  it("does not split on plain numbered items within a Q&A section", () => {
    const text = [
      "1Q. 1. What are the steps?",
      "The steps are:",
      "1. First step",
      "2. Second step",
      "3. Third step",
      "2Q. 2. Another question?",
      "Answer here.",
    ].join("\n");

    const sections = splitSections(text);
    expect(sections).toHaveLength(2);
    // Plain "1.", "2.", "3." items stay inside the first Q&A section
    expect(sections[0]).toContain("1. First step");
    expect(sections[0]).toContain("2. Second step");
    expect(sections[0]).toContain("3. Third step");
    expect(sections[1]).toContain("2Q. 2. Another question?");
  });

  it("handles high-numbered Q-pattern headings", () => {
    const text = [
      "97Q. 16. Some question?",
      "Answer to question 16.",
      "98Q. 17. Another question?",
      "Answer to question 17.",
    ].join("\n");

    const sections = splitSections(text);
    expect(sections).toHaveLength(2);
    expect(sections[0]).toContain("97Q.");
    expect(sections[1]).toContain("98Q.");
  });

  it("preserves preamble before first Q-pattern heading", () => {
    const text = [
      "Pytania i odpowiedzi KSeF 2.0",
      "Liczba pozycji: 208",
      "1Q. Podstawowe informacje o KSeF",
      "1. Co to jest KSeF?",
      "2Q. 1. Co to jest KSeF?",
      "Answer.",
    ].join("\n");

    const sections = splitSections(text);
    expect(sections).toHaveLength(2);
    // Preamble (before any Q-pattern) is kept
    expect(sections[0]).toContain("Pytania i odpowiedzi");
    expect(sections[0]).toContain("Liczba pozycji: 208");
    // TOC block (1Q.) is dropped, Q&A (2Q. 1.) is kept
    expect(sections[1]).toContain("2Q. 1. Co to jest KSeF?");
  });

  it("falls back to double-numbering pattern when no Q-pattern found", () => {
    const text = [
      "Preamble text.",
      "2. 1. Co to jest KSeF?",
      "KSeF to system.",
      "3. 2. Jak korzystać z KSeF?",
      "Przez API.",
    ].join("\n");

    const sections = splitSections(text);
    expect(sections).toHaveLength(3);
    expect(sections[0]).toBe("Preamble text.");
    expect(sections[1]).toContain("2. 1. Co to jest KSeF?");
    expect(sections[2]).toContain("3. 2. Jak korzystać z KSeF?");
  });

  it("does not split on Q inside a word or mid-line", () => {
    const text = [
      "1Q. 1. First section",
      "This line mentions 2Q. something in the middle.",
      "And more text.",
    ].join("\n");

    const sections = splitSections(text);
    expect(sections).toHaveLength(1);
    expect(sections[0]).toContain("2Q. something in the middle");
  });

  it("returns empty array for empty input", () => {
    const sections = splitSections("");
    expect(sections).toHaveLength(0);
  });

  it("drops TOC block even when it is the last section", () => {
    const text = [
      "1Q. 1. Question?",
      "Answer.",
      "2Q. Appendix TOC",
      "1. Item A",
      "2. Item B",
    ].join("\n");

    const sections = splitSections(text);
    expect(sections).toHaveLength(1);
    expect(sections[0]).toContain("1Q. 1. Question?");
    const all = sections.join("\n");
    expect(all).not.toContain("2Q. Appendix TOC");
  });
});

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

  it("splits long input into multiple chunks (sectionAware off)", () => {
    const text = repeatParagraph("This is a sentence about embeddings.", 200);
    const chunks = chunkText(text, {maxChars: 500, overlapChars: 100, sectionAware: false});
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      expect(chunk.content.length).toBeLessThanOrEqual(500);
    });
  });

  it("includes overlap between consecutive chunks (sectionAware off)", () => {
    const text = repeatParagraph("Overlap check sentence.", 100);
    const chunks = chunkText(text, {maxChars: 500, overlapChars: 100, sectionAware: false});

    for (let i = 0; i < chunks.length - 1; i++) {
      const end = chunks[i].content.slice(-80);
      const start = chunks[i + 1].content.slice(0, 80);
      expect(start).toContain(end.slice(0, 30));
    }
  });

  it("avoids cutting at a paragraph break when possible (sectionAware off)", () => {
    const text = [
      repeatParagraph("Paragraph one content.", 5),
      repeatParagraph("Paragraph two content.", 5),
      repeatParagraph("Paragraph three content.", 5),
    ].join("\n\n");

    const chunks = chunkText(text, {maxChars: 400, overlapChars: 80, sectionAware: false});

    const first = chunks[0].content;
    expect(first.endsWith(". ") || first.endsWith(".")).toBe(true);
  });

  it("does not create tiny tail chunks (sectionAware off)", () => {
    const text = repeatParagraph("Tail chunk check sentence.", 80);
    const chunks = chunkText(text, {maxChars: 500, overlapChars: 100, sectionAware: false});

    const last = chunks[chunks.length - 1];
    expect(last.content.length).toBeGreaterThan(100);
  });

  it("uses default maxChars of 1500", () => {
    const text = repeatParagraph("Default size test sentence here.", 200);
    const chunks = chunkText(text, {sectionAware: false});
    chunks.forEach((chunk) => {
      expect(chunk.content.length).toBeLessThanOrEqual(1500);
    });
  });

  it("prefers line breaks over mid-word splits (sectionAware off)", () => {
    const lines = Array.from({length: 50})
      .map((_, i) => `Line ${i}: Some content that fills up space in this chunk.`)
      .join("\n");

    const chunks = chunkText(lines, {maxChars: 500, overlapChars: 80, sectionAware: false});

    for (let i = 0; i < chunks.length - 1; i++) {
      const content = chunks[i].content;
      const lastChar = content[content.length - 1];
      expect(lastChar).toBe(".");
    }
  });

  it("drops TOC blocks and creates one chunk per Q&A", () => {
    const text = [
      "1Q. Podstawowe informacje o KSeF",
      "1. Co to jest KSeF?",
      "2. Jak korzystać z KSeF?",
      "3. Co to jest e-Faktura?",
      "2Q. 1. Co to jest KSeF?",
      "KSeF to system do faktur ustrukturyzowanych.",
      "3Q. 2. Jak korzystać z KSeF?",
      "Można korzystać przez API lub aplikację.",
      "4Q. 3. Co to jest e-Faktura?",
      "To plik XML przesłany do KSeF.",
    ].join("\n");

    const chunks = chunkText(text, {maxChars: 1500});
    expect(chunks).toHaveLength(3);
    // TOC block is dropped — only Q&A chunks
    expect(chunks[0].content).toContain("2Q. 1. Co to jest KSeF?");
    expect(chunks[0].content).toContain("KSeF to system do faktur");
    expect(chunks[0].content).not.toContain("1Q. Podstawowe");
    expect(chunks[1].content).toContain("3Q. 2. Jak korzystać z KSeF?");
    expect(chunks[2].content).toContain("4Q. 3. Co to jest e-Faktura?");
  });

  it("sub-splits oversized Q&A sections with overlap", () => {
    const longAnswer = repeatParagraph("This is a very detailed answer about the topic.", 50);
    const text = [
      "1Q. 1. Short question?",
      "Short answer.",
      "2Q. 2. Long question?",
      longAnswer,
      "3Q. 3. Another question?",
      "Another answer.",
    ].join("\n");

    const chunks = chunkText(text, {maxChars: 500, overlapChars: 100});

    // Section 1 and 3 should be single chunks; section 2 should be sub-split
    expect(chunks.length).toBeGreaterThan(3);

    // First chunk is the short Q&A
    expect(chunks[0].content).toContain("Short question?");
    expect(chunks[0].content).toContain("Short answer.");

    // Last chunk is the final Q&A
    const last = chunks[chunks.length - 1];
    expect(last.content).toContain("Another answer.");
  });

  it("assigns sequential chunkIndex across sections", () => {
    const text = [
      "Preamble.",
      "1Q. 1. First",
      "Answer 1.",
      "2Q. 2. Second",
      "Answer 2.",
      "3Q. 3. Third",
      "Answer 3.",
    ].join("\n");

    const chunks = chunkText(text, {maxChars: 1500});
    expect(chunks).toHaveLength(4); // preamble + 3 Q&As
    expect(chunks.map((c) => c.chunkIndex)).toEqual([0, 1, 2, 3]);
  });

  it("falls back to double-numbering when no Q-pattern present", () => {
    const text = [
      "Preamble.",
      "2. 1. First question?",
      "Answer 1.",
      "3. 2. Second question?",
      "Answer 2.",
    ].join("\n");

    const chunks = chunkText(text, {maxChars: 1500});
    expect(chunks).toHaveLength(3);
    expect(chunks[0].content).toBe("Preamble.");
    expect(chunks[1].content).toContain("2. 1. First question?");
    expect(chunks[2].content).toContain("3. 2. Second question?");
  });

  it("falls back to character-based splitting when no patterns detected", () => {
    const text = repeatParagraph("Plain text without any section markers.", 100);
    const chunks = chunkText(text, {maxChars: 500});
    // Should still produce multiple chunks via character-based splitting
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      expect(chunk.content.length).toBeLessThanOrEqual(500);
    });
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
