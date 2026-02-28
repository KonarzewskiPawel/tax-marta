import {COOKIE_NAME, createToken, isValidPassword} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== "string") {
      return Response.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    if (!isValidPassword(password)) {
      return Response.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }

    const token = createToken();

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
      },
    });
  } catch {
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
