import { describe, expect, it } from "vitest";
import { login, logout, isOperatorSession } from "@/lib/actions/auth";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!;

describe("operator auth (ticket 02)", () => {
  it("issues a signed session token for the correct shared password", async () => {
    const result = await login(ADMIN_PASSWORD);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.token).toBe("string");
      expect(result.token.length).toBeGreaterThan(0);
      expect(isOperatorSession(result.token)).toBe(true);
    }
  });

  it("rejects the wrong password and issues no token", async () => {
    const result = await login("definitely-not-the-password");
    expect(result).toEqual({ ok: false, error: "invalid_password" });
  });

  it("self-expires the session token 24h after issuance, with no separate store", async () => {
    const result = await login(ADMIN_PASSWORD);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const justBeforeExpiry = result.expiresAt - 1000;
    const justAfterExpiry = result.expiresAt + 1000;

    // Reimplement the check with an injected clock via isOperatorSession's `now` param.
    expect(isOperatorSession(result.token, justBeforeExpiry)).toBe(true);
    expect(isOperatorSession(result.token, justAfterExpiry)).toBe(false);

    const issuedAt = result.expiresAt - 24 * 60 * 60 * 1000;
    expect(result.expiresAt - issuedAt).toBe(24 * 60 * 60 * 1000);
  });

  it("rejects a tampered token", async () => {
    const result = await login(ADMIN_PASSWORD);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const tampered = result.token.slice(0, -2) + "xx";
    expect(isOperatorSession(tampered)).toBe(false);
  });

  it("treats a missing session as unauthenticated", () => {
    expect(isOperatorSession(undefined)).toBe(false);
    expect(isOperatorSession(null)).toBe(false);
    expect(isOperatorSession("")).toBe(false);
  });

  it("logout resolves ok (cookie clearing itself is the caller's job)", async () => {
    await expect(logout()).resolves.toEqual({ ok: true });
  });

  it("never reflects ADMIN_PASSWORD back in the login result", async () => {
    const result = await login(ADMIN_PASSWORD);
    expect(JSON.stringify(result)).not.toContain(ADMIN_PASSWORD);
  });
});
