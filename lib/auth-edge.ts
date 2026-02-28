/**
 * Edge-compatible token validation for use in middleware.
 * Uses the Web Crypto API instead of node:crypto.
 */

const COOKIE_NAME = "admin_token";

async function sign(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function isValidToken(
  token: string | undefined,
  secret: string
): Promise<boolean> {
  if (!token) return false;

  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return false;

  const payload = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);

  // Verify signature
  const expectedSignature = await sign(payload, secret);
  if (signature.length !== expectedSignature.length) return false;

  // Constant-time comparison
  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  if (mismatch !== 0) return false;

  // Check expiration
  const parts = payload.split(":");
  const expiresAt = parseInt(parts[1], 10);
  if (isNaN(expiresAt)) return false;
  if (Math.floor(Date.now() / 1000) > expiresAt) return false;

  return true;
}

export { COOKIE_NAME };
