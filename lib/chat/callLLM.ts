import {generateText, Output} from "ai";
import {openai} from "@ai-sdk/openai";
import {buildSystemPrompt} from "./buildPrompt";
import {type LLMResponse, llmResponseSchema, type RetrievedChunk} from "./types";

/** Default chat model for the MVP. */
const DEFAULT_CHAT_MODEL = "gpt-4o-mini";

/** Default temperature for deterministic outputs. */
const DEFAULT_TEMPERATURE = 0.1;

/**
 * Call the LLM using a strict structured output schema.
 *
 * The system prompt includes numbered context chunks; the model
 * must respond with JSON that matches `llmResponseSchema`.
 *
 * @param args.question - The user question text
 * @param args.chunks - Retrieved context chunks
 * @returns Structured LLM response validated by Zod
 */
export async function callLLM(args: {
  question: string;
  chunks: RetrievedChunk[];
}): Promise<LLMResponse> {
  const {question, chunks} = args;
  const system = buildSystemPrompt(chunks);

  const result = await generateText({
    model: openai(DEFAULT_CHAT_MODEL),
    output: Output.object({
      schema: llmResponseSchema,
    }),
    system,
    prompt: question,
    temperature: DEFAULT_TEMPERATURE,
  });

  return result.output;
}
