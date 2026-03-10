"use client";

import {useState} from "react";
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

export default function ChatPage() {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Chat</h2>

      {/* Message list — placeholder for 7.2 */}
      <div className="mb-4 space-y-4">
        {entries.length === 0 && !loading && (
          <p className="text-sm text-gray-500">
            Zadaj pytanie dotyczace dodanych dokumentow.
          </p>
        )}
      </div>

      {/* Input area — placeholder for 7.2 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Zadaj pytanie..."
          disabled={loading}
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="button"
          disabled={loading || input.trim().length === 0}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Wysylanie..." : "Wyslij"}
        </button>
      </div>
    </div>
  );
}
