"use client";

import {type FormEvent, useState} from "react";
import {useRouter} from "next/navigation";
import {createSource} from "@/lib/api/sources";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export default function NewSourcePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function getErrorMessage(err: unknown): string {
    if (!(err instanceof Error)) {
      return "Unexpected error. Please try again.";
    }

    if (err.message.includes("Failed to fetch")) {
      return "Network error. Check your connection or try again.";
    }

    if (err.message.toLowerCase().includes("already exists")) {
      return "This PDF already exists in the system.";
    }

    return err.message || "Unexpected error. Please try again.";
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const title = formData.get("title") as string;
    const pdfFile = formData.get("pdfFile") as File | null;

    // Client-side validation
    if (!title || title.trim().length === 0) {
      setError("Title is required");
      return;
    }

    if (!pdfFile || pdfFile.size === 0) {
      setError("PDF file is required");
      return;
    }

    if (!pdfFile.name.toLowerCase().endsWith(".pdf")) {
      setError("File must be a PDF");
      return;
    }

    if (pdfFile.size > MAX_FILE_SIZE) {
      setError("File size must be under 25MB");
      return;
    }

    setSubmitting(true);

    try {
      const result = await createSource({
        title,
        sourceUrl: formData.get("sourceUrl") as string | undefined,
        publishedAt: formData.get("publishedAt") as string | undefined,
        tags: formData.get("tags") as string | undefined,
        pdfFile,
      });

      router.push(`/admin/sources/${result.id}`);
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <a
          href="/admin/sources"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          &larr; Back to list
        </a>
        <h2 className="mt-2 text-2xl font-bold">Add new source</h2>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="max-w-lg space-y-4 rounded border border-gray-200 bg-white p-6"
      >
        <div>
          <label htmlFor="title" className="block text-sm font-medium mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="title"
            name="title"
            required
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="sourceUrl" className="block text-sm font-medium mb-1">
            Source URL
          </label>
          <input
            type="url"
            id="sourceUrl"
            name="sourceUrl"
            placeholder="https://..."
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="publishedAt"
            className="block text-sm font-medium mb-1"
          >
            Published date
          </label>
          <input
            type="date"
            id="publishedAt"
            name="publishedAt"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="tags" className="block text-sm font-medium mb-1">
            Tags
          </label>
          <input
            type="text"
            id="tags"
            name="tags"
            placeholder="tag1, tag2, tag3"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">Comma-separated</p>
        </div>

        <div>
          <label htmlFor="pdfFile" className="block text-sm font-medium mb-1">
            PDF file <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            id="pdfFile"
            name="pdfFile"
            accept=".pdf,application/pdf"
            required
            className="w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
          />
          <p className="mt-1 text-xs text-gray-500">Max 25 MB</p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Uploading..." : "Upload source"}
        </button>
      </form>
    </div>
  );
}
