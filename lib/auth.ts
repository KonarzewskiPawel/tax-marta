import {createHmac, timingSafeEqual} from "node:crypto";

const COOKIE_NAME = "admin_token";
const TOKEN_TTL_SECONDS = 60 * 60 * 24; // 24 hours

function getSecret(): string {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SECRET environment variable is not set");
  }
  return secret;
}

function getAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("ADMIN_PASSWORD environment variable is not set");
  }
  return password;
}

/** Sign a payload with HMAC-SHA256 */
function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

/** Create a signed token with an expiration timestamp */
export function createToken(): string {
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = `admin:${expiresAt}`;
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

/** Validate a token: check signature and expiration */
export function isValidToken(token: string | undefined): boolean {
  if (!token) return false;

  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return false;

  const payload = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);

  // Verify signature
  const expectedSignature = sign(payload);
  try {
    const sigBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    if (sigBuffer.length !== expectedBuffer.length) return false;
    if (!timingSafeEqual(sigBuffer, expectedBuffer)) return false;
  } catch {
    return false;
  }

  // Check expiration
  const parts = payload.split(":");
  const expiresAt = parseInt(parts[1], 10);
  if (isNaN(expiresAt)) return false;
  if (Math.floor(Date.now() / 1000) > expiresAt) return false;

  return true;
}

/** Check if the admin password matches */
export function isValidPassword(password: string): boolean {
  const expected = getAdminPassword();
  try {
    const passwordBuffer = Buffer.from(password);
    const expectedBuffer = Buffer.from(expected);
    if (passwordBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(passwordBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/** Verify the admin token from a request's cookies. Returns 401 Response if invalid, null if valid. */
export function verifyRequest(request: Request): Response | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const token = match?.[1];

  if (!isValidToken(token)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

/** Cookie name used for the admin token */
export { COOKIE_NAME };
