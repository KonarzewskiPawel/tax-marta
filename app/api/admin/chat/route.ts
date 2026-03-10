import {verifyRequest} from "@/lib/auth";
import {retrieveChunks} from "@/lib/chat/retrieveChunks";
import {evaluateEvidence} from "@/lib/chat/evidenceGate";
import {callLLM} from "@/lib/chat/callLLM";
import {mapCitations} from "@/lib/chat/mapCitations";
import {validateCitations} from "@/lib/chat/validateCitations";
import {buildChatResponse, buildRefusalResponse} from "@/lib/chat/buildResponse";

export const runtime = "nodejs";

/** Maximum allowed message length (characters). */
const MAX_MESSAGE_LENGTH = 1000;

/**
 * POST /api/admin/chat
 *
 * Citation-gated chat endpoint. Accepts a user question,
 * retrieves relevant chunks, evaluates evidence quality,
 * generates a structured answer with citations, and validates
 * citations server-side before responding.
 *
 * Pipeline: parse body → retrieve → gate → (refuse or generate) → validate → respond
 *
 * Request body: { "message": string }
 * Response body: ChatResponse (see lib/chat/types.ts)
 */
export async function POST(request: Request) {
  const authError = verifyRequest(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const message = body?.message;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return Response.json(
        {error: "Message is required"},
        {status: 400},
      );
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return Response.json(
        {error: `Message must be at most ${MAX_MESSAGE_LENGTH} characters`},
        {status: 400},
      );
    }

    const question = message.trim();

    // 1. RETRIEVE — embed question + cosine search across all ready sources
    const chunks = await retrieveChunks(question);

    // 2. GATE — heuristic evidence quality check
    const gateResult = evaluateEvidence(chunks);

    if (!gateResult.pass) {
      // Not enough evidence — refuse without calling the LLM
      return Response.json(buildRefusalResponse());
    }

    // 3. GENERATE — build prompt + structured LLM call
    const llmResponse = await callLLM({question, chunks});

    // 4. MAP — translate LLM chunkIndex references to full citation metadata
    const mappedCitations = mapCitations(llmResponse, chunks);

    // 5. VALIDATE — enforce citation integrity server-side
    const validatedCitations = validateCitations(mappedCitations, chunks);

    // 6. RESPOND — assemble final response (handles 0-citation refusal override)
    const response = buildChatResponse({
      gateResult,
      llmResponse,
      validatedCitations,
    });

    return Response.json(response);
  } catch (error) {
    console.error("Failed to process chat request:", error);
    return Response.json(
      {error: "Internal server error"},
      {status: 500},
    );
  }
}
