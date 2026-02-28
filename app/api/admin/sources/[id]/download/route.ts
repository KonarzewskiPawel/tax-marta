import {prisma} from "@/lib/prisma";
import {getFile} from "@/lib/storage";
import {verifyRequest} from "@/lib/auth";
import {NextRequest} from "next/server";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyRequest(request);
  if (authError) return authError;

  try {
    const { id } = await params;

    const source = await prisma.source.findUnique({ where: { id } });
    if (!source) {
      return Response.json({ error: "Source not found" }, { status: 404 });
    }

    const buffer = await getFile(source.storageKey);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": source.mimeType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(source.originalFilename)}`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    console.error("Failed to download file:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
