// Cookie names shared between the thin "use server" wrappers (app/**/actions.ts)
// that own the actual cookies() get/set/delete calls.

/** httpOnly signed 24h operator session cookie (see lib/session-token.ts). */
export const SESSION_COOKIE_NAME = "voting_app_session";

/** httpOnly opaque anonymous voter identity, reused across all polls (see
 * docs/adr/0001-cookie-based-vote-deduplication.md). */
export const VOTER_TOKEN_COOKIE_NAME = "voting_app_voter_token";

export const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60; // 24h, matches session-token.ts TTL
export const VOTER_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year, reused across polls

/** Shared httpOnly cookie options for both the session and voter_token cookies. */
export function secureCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge,
    path: "/",
  };
}
