import { createHash, timingSafeEqual } from "node:crypto";
import { createSessionToken, verifySessionToken } from "@/lib/session-token";

// This is the server-action seam for 운영자 (Operator) auth (see
// .scratch/voting-app/spec.md "Testing Decisions"). These functions never
// touch `next/headers` cookies() directly — cookies() only works inside a
// live Next.js request scope, and this module must also be importable and
// callable directly from Vitest with no mocking. Instead, session/voter
// tokens are passed in and returned as plain strings; the thin "use server"
// wrappers in app/**/actions.ts do the actual cookie get/set/delete and call
// straight through to these functions.

export type LoginResult =
  | { ok: true; token: string; expiresAt: number }
  | { ok: false; error: "invalid_password" };

/** Constant-time string compare (hashes both sides first so it also doesn't
 * leak input length via Buffer size mismatches). */
function constantTimeEqual(a: string, b: string): boolean {
  const aHash = createHash("sha256").update(a).digest();
  const bHash = createHash("sha256").update(b).digest();
  return timingSafeEqual(aHash, bHash);
}

function getAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("ADMIN_PASSWORD is not set. Check .env.local.");
  }
  return password;
}

/**
 * Verifies the submitted shared password against ADMIN_PASSWORD using a
 * constant-time comparison. On success, returns a signed session token that
 * self-expires 24h from now (no server-side session store).
 */
export async function login(password: string): Promise<LoginResult> {
  const adminPassword = getAdminPassword();

  if (!constantTimeEqual(password, adminPassword)) {
    return { ok: false, error: "invalid_password" };
  }

  const { token, expiresAt } = createSessionToken();
  return { ok: true, token, expiresAt };
}

/**
 * There is no server-side session store to invalidate (the token is
 * self-contained and self-expiring by design) — logging out is really just
 * "the caller should stop sending/should delete the session cookie", which is
 * the thin wrapper's job. This function exists so `logout` is part of the one
 * server-action seam, per spec.
 */
export async function logout(): Promise<{ ok: true }> {
  return { ok: true };
}

/** Session-check: is this token a currently-valid, unexpired operator session? */
export function isOperatorSession(
  token: string | undefined | null,
  now: number = Date.now(),
): boolean {
  return verifySessionToken(token, now) !== null;
}
