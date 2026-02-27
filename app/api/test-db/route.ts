import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
    const count = await prisma.source.count(); // note: Prisma model name is Source -> client is prisma.source
    return Response.json({ ok: true, count });
}