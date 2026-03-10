import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {buildChatResponse, buildRefusalResponse} from "@/lib/chat/buildResponse";
import {type Citation, type EvidenceGateResult, type LLMResponse} from "@/lib/chat/types";

const FIXED_NOW = "2026-03-08T12:00:00.000Z";
const DISCLAIMER = "Informacja pogladowa — nie stanowi porady prawnej ani podatkowej.";
const DEFAULT_REFUSAL_QUESTION =
  "Czy pytanie dotyczy KSeF, e-Faktury, czy innego tematu podatkowego?";
const REFUSAL_MESSAGE =
  "Nie mam wystarczajacych zrodel oficjalnych, zeby odpowiedziec na to pytanie.";
const REFUSAL_SUGGESTION =
  "Sprawdz oficjalne materialy na ksef.podatki.gov.pl lub dodaj odpowiedni dokument PDF.";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(FIXED_NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

function makeCitation(overrides: Partial<Citation> = {}): Citation {
  return {
    sourceTitle: overrides.sourceTitle ?? "Source A",
    sourceUrl: overrides.sourceUrl ?? null,
    publishedAt: overrides.publishedAt ?? null,
    quote: overrides.quote ?? "some verbatim quote from the chunk",
    chunkId: overrides.chunkId ?? "chunk-1",
  };
}

function makeLLMResponse(overrides: Partial<LLMResponse> = {}): LLMResponse {
  return {
    answer: overrides.answer ?? "This is the answer.",
    citations: overrides.citations ?? [{chunkIndex: 0, quote: "some quote"}],
    confidence: overrides.confidence ?? "high",
    clarifyingQuestion: overrides.clarifyingQuestion ?? null,
  };
}

function makeGateResult(overrides: Partial<EvidenceGateResult> = {}): EvidenceGateResult {
  return {
    pass: overrides.pass ?? true,
    reason: overrides.reason ?? "Strong evidence.",
    confidence: overrides.confidence ?? "high",
  };
}

// ---------------------------------------------------------------------------
// buildRefusalResponse
// ---------------------------------------------------------------------------

describe("buildRefusalResponse", () => {
  it("returns a refusal with default clarifying question", () => {
    const result = buildRefusalResponse();

    expect(result.answer).toBe("");
    expect(result.citations).toEqual([]);
    expect(result.confidence).toBe("low");
    expect(result.refused).toBe(true);
    expect(result.clarifyingQuestion).toBe(DEFAULT_REFUSAL_QUESTION);
    expect(result.disclaimer).toBe(DISCLAIMER);
    expect(result.asOf).toBe(FIXED_NOW);
  });

  it("uses the provided clarifying question when given", () => {
    const result = buildRefusalResponse("Czy mozesz sprecyzowac pytanie?");

    expect(result.clarifyingQuestion).toBe("Czy mozesz sprecyzowac pytanie?");
  });

  it("falls back to default when clarifyingQuestion is null", () => {
    const result = buildRefusalResponse(null);

    expect(result.clarifyingQuestion).toBe(DEFAULT_REFUSAL_QUESTION);
  });

  it("includes Polish refusal message", () => {
    const result = buildRefusalResponse();

    expect(result.refusalMessage).toBe(REFUSAL_MESSAGE);
  });

  it("includes actionable suggestion", () => {
    const result = buildRefusalResponse();

    expect(result.suggestion).toBe(REFUSAL_SUGGESTION);
  });
});

// ---------------------------------------------------------------------------
// buildChatResponse — gate refused
// ---------------------------------------------------------------------------

describe("buildChatResponse — gate refused", () => {
  it("returns refusal when gate did not pass", () => {
    const result = buildChatResponse({
      gateResult: makeGateResult({pass: false, confidence: "low"}),
      llmResponse: null,
      validatedCitations: [],
    });

    expect(result.refused).toBe(true);
    expect(result.answer).toBe("");
    expect(result.citations).toEqual([]);
    expect(result.confidence).toBe("low");
    expect(result.disclaimer).toBe(DISCLAIMER);
    expect(result.asOf).toBe(FIXED_NOW);
  });

  it("returns refusal when gate passed but llmResponse is null", () => {
    const result = buildChatResponse({
      gateResult: makeGateResult({pass: true}),
      llmResponse: null,
      validatedCitations: [],
    });

    expect(result.refused).toBe(true);
    expect(result.answer).toBe("");
  });

  it("includes refusal message and suggestion when gate refused", () => {
    const result = buildChatResponse({
      gateResult: makeGateResult({pass: false}),
      llmResponse: null,
      validatedCitations: [],
    });

    expect(result.refusalMessage).toBe(REFUSAL_MESSAGE);
    expect(result.suggestion).toBe(REFUSAL_SUGGESTION);
  });
});

// ---------------------------------------------------------------------------
// buildChatResponse — 0 valid citations → refusal override (substep 5.5)
// ---------------------------------------------------------------------------

describe("buildChatResponse — 0 valid citations override", () => {
  it("overrides to refusal when validatedCitations is empty", () => {
    const result = buildChatResponse({
      gateResult: makeGateResult({pass: true, confidence: "high"}),
      llmResponse: makeLLMResponse({answer: "The LLM gave an answer."}),
      validatedCitations: [],
    });

    expect(result.refused).toBe(true);
    expect(result.answer).toBe("");
    expect(result.citations).toEqual([]);
    expect(result.confidence).toBe("low");
  });

  it("preserves LLM clarifying question in citation-refusal", () => {
    const result = buildChatResponse({
      gateResult: makeGateResult({pass: true}),
      llmResponse: makeLLMResponse({clarifyingQuestion: "O co dokladnie pytasz?"}),
      validatedCitations: [],
    });

    expect(result.refused).toBe(true);
    expect(result.clarifyingQuestion).toBe("O co dokladnie pytasz?");
  });

  it("uses default clarifying question when LLM provided null", () => {
    const result = buildChatResponse({
      gateResult: makeGateResult({pass: true}),
      llmResponse: makeLLMResponse({clarifyingQuestion: null}),
      validatedCitations: [],
    });

    expect(result.refused).toBe(true);
    expect(result.clarifyingQuestion).toBe(DEFAULT_REFUSAL_QUESTION);
  });

  it("includes refusal message and suggestion on citation-refusal", () => {
    const result = buildChatResponse({
      gateResult: makeGateResult({pass: true}),
      llmResponse: makeLLMResponse(),
      validatedCitations: [],
    });

    expect(result.refusalMessage).toBe(REFUSAL_MESSAGE);
    expect(result.suggestion).toBe(REFUSAL_SUGGESTION);
  });
});

// ---------------------------------------------------------------------------
// buildChatResponse — success path
// ---------------------------------------------------------------------------

describe("buildChatResponse — success", () => {
  it("passes through LLM answer and validated citations", () => {
    const citations = [makeCitation({chunkId: "c1"}), makeCitation({chunkId: "c2"})];

    const result = buildChatResponse({
      gateResult: makeGateResult({pass: true, confidence: "high"}),
      llmResponse: makeLLMResponse({answer: "KSeF is a system for..."}),
      validatedCitations: citations,
    });

    expect(result.refused).toBe(false);
    expect(result.answer).toBe("KSeF is a system for...");
    expect(result.citations).toEqual(citations);
    expect(result.confidence).toBe("high");
    expect(result.disclaimer).toBe(DISCLAIMER);
    expect(result.asOf).toBe(FIXED_NOW);
  });

  it("uses gate confidence, not LLM confidence", () => {
    const result = buildChatResponse({
      gateResult: makeGateResult({pass: true, confidence: "medium"}),
      llmResponse: makeLLMResponse({confidence: "high"}),
      validatedCitations: [makeCitation()],
    });

    expect(result.confidence).toBe("medium");
  });

  it("passes through LLM clarifying question on success", () => {
    const result = buildChatResponse({
      gateResult: makeGateResult({pass: true}),
      llmResponse: makeLLMResponse({clarifyingQuestion: "Chcesz wiedziec wiecej?"}),
      validatedCitations: [makeCitation()],
    });

    expect(result.refused).toBe(false);
    expect(result.clarifyingQuestion).toBe("Chcesz wiedziec wiecej?");
  });

  it("sets clarifyingQuestion to null when LLM provides null", () => {
    const result = buildChatResponse({
      gateResult: makeGateResult({pass: true}),
      llmResponse: makeLLMResponse({clarifyingQuestion: null}),
      validatedCitations: [makeCitation()],
    });

    expect(result.clarifyingQuestion).toBeNull();
  });

  it("sets refusalMessage and suggestion to null on success", () => {
    const result = buildChatResponse({
      gateResult: makeGateResult({pass: true}),
      llmResponse: makeLLMResponse(),
      validatedCitations: [makeCitation()],
    });

    expect(result.refusalMessage).toBeNull();
    expect(result.suggestion).toBeNull();
  });
});
