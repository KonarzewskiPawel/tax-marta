"use client";

import {type FormEvent, useEffect, useRef, useState} from "react";
import {type ChatResponse} from "@/lib/chat/types";

/** A single exchange in the chat history. */
interface ChatEntry {
  /** The user's question. */
  question: string;
  /** The API response (null while loading). */
  response: ChatResponse | null;
  /** Error message if the request failed. */
  error: string | null;
}

/**
 * Send a chat message to the API.
 *
 * @param message - The user's question text
 * @returns The structured chat response
 */
async function sendMessage(message: string): Promise<ChatResponse> {
  const res = await fetch("/api/admin/chat", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({message}),
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error ?? "Unexpected error");
  }

  return json as ChatResponse;
}

export default function ChatPage() {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when entries change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({behavior: "smooth"});
  }, [entries, loading]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    setLoading(true);

    // Add entry with null response (loading state)
    const entryIndex = entries.length;
    setEntries((prev) => [...prev, {question, response: null, error: null}]);

    try {
      const response = await sendMessage(question);
      setEntries((prev) =>
        prev.map((entry, i) =>
          i === entryIndex ? {...entry, response} : entry
        )
      );
    } catch (err) {
      const errorMessage = err instanceof Error
        ? err.message
        : "Unexpected error. Please try again.";
      setEntries((prev) =>
        prev.map((entry, i) =>
          i === entryIndex ? {...entry, error: errorMessage} : entry
        )
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col" style={{height: "calc(100vh - 140px)"}}>
      <h2 className="text-2xl font-bold mb-4">Chat</h2>

      {/* Scrollable message list */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {entries.length === 0 && !loading && (
          <p className="text-sm text-gray-500">
            Zadaj pytanie dotyczace dodanych dokumentow.
          </p>
        )}

        {entries.map((entry, i) => (
          <div key={i} className="space-y-2">
            {/* User question */}
            <div className="flex justify-end">
              <div className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white max-w-[80%]">
                {entry.question}
              </div>
            </div>

            {/* Response or loading/error */}
            <div className="flex justify-start">
              {entry.response ? (
                <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm max-w-[80%]">
                  {/* Answer text — placeholder, citations added in 7.3, refusal in 7.4 */}
                  <p className="whitespace-pre-wrap">{entry.response.answer || "(brak odpowiedzi)"}</p>
                </div>
              ) : entry.error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 max-w-[80%]">
                  {entry.error}
                </div>
              ) : (
                <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-400 max-w-[80%]">
                  Szukam odpowiedzi...
                </div>
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex gap-2 shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Zadaj pytanie..."
          disabled={loading}
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || input.trim().length === 0}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Wysylanie..." : "Wyslij"}
        </button>
      </form>
    </div>
  );
}
