const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

export interface Source {
  id: string;
  title: string;
  sourceUrl: string | null;
  publishedAt: string | null;
  tags: string[];
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  status: "UPLOADED" | "PROCESSING" | "READY" | "FAILED";
  ingestedAt: string;
  createdAt: string;
  updatedAt: string;
}

export async function getSources(): Promise<Source[]> {
  const res = await fetch(`${BASE_URL}/api/admin/sources`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Failed to fetch sources");
  }
  return res.json();
}

export async function getSource(id: string): Promise<Source | null> {
  const res = await fetch(`${BASE_URL}/api/admin/sources/${id}`, {
    cache: "no-store",
  });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error("Failed to fetch source");
  }
  return res.json();
}

export interface CreateSourceData {
  title: string;
  sourceUrl?: string;
  publishedAt?: string;
  tags?: string;
  pdfFile: File;
}

export async function createSource(data: CreateSourceData): Promise<{ id: string }> {
  const formData = new FormData();
  formData.append("title", data.title);
  if (data.sourceUrl) formData.append("sourceUrl", data.sourceUrl);
  if (data.publishedAt) formData.append("publishedAt", data.publishedAt);
  if (data.tags) formData.append("tags", data.tags);
  formData.append("pdfFile", data.pdfFile);

  const res = await fetch(`${BASE_URL}/api/admin/sources`, {
    method: "POST",
    body: formData,
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error ?? "Failed to create source");
  }

  return json;
}
