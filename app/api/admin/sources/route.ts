import {prisma} from "@/lib/prisma";
import {saveFile} from "@/lib/storage";
import {verifyRequest} from "@/lib/auth";
import {createHash} from "node:crypto";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export async function GET(request: Request) {
  const authError = verifyRequest(request);
  if (authError) return authError;

  try {
    const sources = await prisma.source.findMany({
      orderBy: { ingestedAt: "desc" },
    });
    return Response.json(sources);
  } catch (error) {
    console.error("Failed to list sources:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const authError = verifyRequest(request);
  if (authError) return authError;

  try {
    const formData = await request.formData();

    const title = formData.get("title");
    const sourceUrl = formData.get("sourceUrl");
    const publishedAt = formData.get("publishedAt");
    const tagsRaw = formData.get("tags");
    const pdfFile = formData.get("pdfFile");

    // Validate title
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return Response.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    // Validate file
    if (!pdfFile || !(pdfFile instanceof File)) {
      return Response.json(
        { error: "PDF file is required" },
        { status: 400 }
      );
    }

    if (!pdfFile.name.toLowerCase().endsWith(".pdf")) {
      return Response.json(
        { error: "File must be a PDF" },
        { status: 400 }
      );
    }

    if (pdfFile.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: "File size must be under 25MB" },
        { status: 400 }
      );
    }

    // Read file buffer
    const arrayBuffer = await pdfFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Compute sha256
    const sha256 = createHash("sha256").update(buffer).digest("hex");

    // Check for duplicate
    const existing = await prisma.source.findUnique({ where: { sha256 } });
    if (existing) {
      return Response.json(
        { error: "A file with the same content already exists", existingId: existing.id },
        { status: 409 }
      );
    }

    // Parse tags
    const tags: string[] = tagsRaw && typeof tagsRaw === "string"
      ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

    // Parse publishedAt
    let parsedPublishedAt: Date | null = null;
    if (publishedAt && typeof publishedAt === "string" && publishedAt.trim()) {
      parsedPublishedAt = new Date(publishedAt);
      if (isNaN(parsedPublishedAt.getTime())) {
        return Response.json(
          { error: "Invalid published date" },
          { status: 400 }
        );
      }
    }

    // Generate storage key
    const storageKey = `${sha256}.pdf`;

    // Save file to disk
    await saveFile(storageKey, buffer);

    // Create DB record
    const source = await prisma.source.create({
      data: {
        title: title.trim(),
        sourceUrl: sourceUrl && typeof sourceUrl === "string" && sourceUrl.trim()
          ? sourceUrl.trim()
          : null,
        publishedAt: parsedPublishedAt,
        tags,
        storageKey,
        originalFilename: pdfFile.name,
        mimeType: "application/pdf",
        sizeBytes: pdfFile.size,
        sha256,
      },
    });

    return Response.json({ id: source.id }, { status: 201 });

  } catch (error) {
    console.error("Failed to create source:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
