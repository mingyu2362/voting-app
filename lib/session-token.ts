import { createHmac, timingSafeEqual } from "node:crypto";

// A minimal self-expiring, signed session token: no server-side session store
// is used (see docs/adr and .scratch/voting-app/spec.md "운영자 세션") — the
// 24h expiry is embedded in the signed payload itself.

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set. Check .env.local.");
  }
  return secret;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

export type SessionPayload = {
  role: "operator";
  exp: number; // epoch ms
};

/** Creates a new signed operator session token, valid for 24h from `now`. */
export function createSessionToken(now: number = Date.now()): {
  token: string;
  expiresAt: number;
} {
  const expiresAt = now + SESSION_TTL_MS;
  const payload: SessionPayload = { role: "operator", exp: expiresAt };
  const payloadB64 = base64url(JSON.stringify(payload));
  const signature = sign(payloadB64, getSecret());
  return { token: `${payloadB64}.${signature}`, expiresAt };
}

/**
 * Verifies a session token's signature and expiry. Returns the decoded
 * payload if valid, or `null` if the token is missing, malformed, tampered
 * with, or expired.
 */
export function verifySessionToken(
  token: string | undefined | null,
  now: number = Date.now(),
): SessionPayload | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;

  const expectedSignature = sign(payloadB64, getSecret());
  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (
    signatureBuf.length !== expectedBuf.length ||
    !timingSafeEqual(signatureBuf, expectedBuf)
  ) {
    return null;
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (typeof payload.exp !== "number" || payload.exp <= now) return null;
  if (payload.role !== "operator") return null;

  return payload;
}
