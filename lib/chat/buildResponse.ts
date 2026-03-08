import {type ChatResponse, type Citation, type EvidenceGateResult, type LLMResponse} from "./types";

/** Legal disclaimer included in every response. */
const DISCLAIMER = "Informacja pogladowa — nie stanowi porady prawnej ani podatkowej.";

/** Default clarifying question when refusing due to insufficient evidence. */
const DEFAULT_REFUSAL_QUESTION =
  "Czy pytanie dotyczy KSeF, e-Faktury, czy innego tematu podatkowego?";

/**
 * Build a refusal ChatResponse.
 *
 * Used when the evidence gate fails or when all citations are
 * invalidated by the server-side validation step.
 *
 * @param clarifyingQuestion - Optional clarifying question for the user
 * @returns A ChatResponse with refused=true and empty answer/citations
 */
export function buildRefusalResponse(
  clarifyingQuestion?: string | null
): ChatResponse {
  return {
    answer: "",
    citations: [],
    confidence: "low",
    refused: true,
    clarifyingQuestion: clarifyingQuestion ?? DEFAULT_REFUSAL_QUESTION,
    disclaimer: DISCLAIMER,
    asOf: new Date().toISOString(),
  };
}

/**
 * Assemble the final ChatResponse from pipeline outputs.
 *
 * Handles two refusal paths:
 * 1. The evidence gate refused (pass=false) — return refusal immediately.
 * 2. All citations were invalidated (empty array after validation) —
 *    override the LLM answer to a refusal.
 *
 * When citations are valid, the LLM answer, confidence, and clarifying
 * question are passed through to the response.
 *
 * @param args.gateResult - Evidence gate evaluation result
 * @param args.llmResponse - Structured LLM output (null if gate refused)
 * @param args.validatedCitations - Citations after server-side validation
 * @returns Final ChatResponse ready to send to the client
 */
export function buildChatResponse(args: {
  gateResult: EvidenceGateResult;
  llmResponse: LLMResponse | null;
  validatedCitations: Citation[];
}): ChatResponse {
  const {gateResult, llmResponse, validatedCitations} = args;

  // Path 1: evidence gate refused — no LLM call was made
  if (!gateResult.pass || !llmResponse) {
    return buildRefusalResponse();
  }

  // Path 2: LLM answered but all citations were invalidated
  if (validatedCitations.length === 0) {
    return buildRefusalResponse(llmResponse.clarifyingQuestion);
  }

  // Path 3: success — pass through LLM answer with validated citations
  return {
    answer: llmResponse.answer,
    citations: validatedCitations,
    confidence: gateResult.confidence,
    refused: false,
    clarifyingQuestion: llmResponse.clarifyingQuestion,
    disclaimer: DISCLAIMER,
    asOf: new Date().toISOString(),
  };
}
