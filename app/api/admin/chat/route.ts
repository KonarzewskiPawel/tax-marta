import {verifyRequest} from "@/lib/auth";

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

    // TODO: wire full pipeline in substep 6.2
    return Response.json(
      {message: "Chat endpoint ready", question},
      {status: 200},
    );
  } catch (error) {
    console.error("Failed to process chat request:", error);
    return Response.json(
      {error: "Internal server error"},
      {status: 500},
    );
  }
}
