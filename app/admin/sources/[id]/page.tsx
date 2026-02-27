import {prisma} from "@/lib/prisma";
import Link from "next/link";
import {notFound} from "next/navigation";

export const runtime = "nodejs";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function SourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const source = await prisma.source.findUnique({ where: { id } });
  if (!source) {
    notFound();
  }

  const statusStyles: Record<string, string> = {
    UPLOADED: "bg-yellow-100 text-yellow-800",
    PROCESSING: "bg-blue-100 text-blue-800",
    READY: "bg-green-100 text-green-800",
    FAILED: "bg-red-100 text-red-800",
  };

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/sources"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          &larr; Back to list
        </Link>
      </div>

      <div className="rounded border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-2xl font-bold">{source.title}</h2>
        </div>

        <dl className="divide-y divide-gray-100 px-6">
          <Row label="Source URL">
            {source.sourceUrl ? (
              <a
                href={source.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline break-all"
              >
                {source.sourceUrl}
              </a>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </Row>

          <Row label="Published date">
            {source.publishedAt
              ? new Date(source.publishedAt).toLocaleDateString()
              : "-"}
          </Row>

          <Row label="Tags">
            {source.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {source.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </Row>

          <Row label="Status">
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[source.status] ?? "bg-gray-100 text-gray-800"}`}
            >
              {source.status}
            </span>
          </Row>

          <Row label="Original filename">{source.originalFilename}</Row>

          <Row label="File size">{formatBytes(source.sizeBytes)}</Row>

          <Row label="SHA-256">
            <code className="text-xs break-all bg-gray-50 px-1 py-0.5 rounded">
              {source.sha256}
            </code>
          </Row>

          <Row label="Ingested">
            {new Date(source.ingestedAt).toLocaleString()}
          </Row>
        </dl>

        <div className="border-t border-gray-200 px-6 py-4">
          <a
            href={`/api/admin/sources/${source.id}/download`}
            className="inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Download PDF
          </a>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-3 gap-4 py-3">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="col-span-2 text-sm">{children}</dd>
    </div>
  );
}
