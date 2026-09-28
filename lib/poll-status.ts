// Pure helpers for 마감(Closed) status — see
// .scratch/voting-app-deadline/issues/01-foundation-closes-at-and-pure-helpers.md,
// docs/adr/0004-deadline-computed-not-scheduled.md. Deliberately does not import
// lib/db.ts so these stay unit-testable without a database (lib/db.ts throws at
// import time when TEST_DATABASE_URL isn't set).

/** A Poll's closes_at value as it may arrive from various layers: a JS Date
 * (as returned by some drivers), an ISO string, an epoch number, or absent. */
export type ClosesAt = Date | string | number | null | undefined;

/** Normalizes a ClosesAt value into epoch milliseconds, or null if absent.
 * The one place `isPollClosed` and `toIsoOrNull` (lib/actions/polls.ts) both
 * build on, instead of each reimplementing the Date/string/number branch. */
export function toDateMs(closesAt: ClosesAt): number | null {
  if (closesAt === null || closesAt === undefined) return null;
  return closesAt instanceof Date ? closesAt.getTime() : new Date(closesAt).getTime();
}

/**
 * Whether a Poll counts as 마감(Closed) right now: `closesAt !== null &&
 * closesAt <= now`. There is no stored status flag — this is recomputed on
 * every call, same pattern as `isOperatorSession(token, now)` in
 * lib/actions/auth.ts. `closesAt` being null/undefined means the poll runs
 * forever (never closed).
 */
export function isPollClosed(closesAt: ClosesAt, now: number = Date.now()): boolean {
  const ms = toDateMs(closesAt);
  return ms !== null && ms <= now;
}

/**
 * Sorts Polls so open (not yet closed) ones come first and 마감(Closed) ones
 * are separated below — see 설문 목록 in
 * .scratch/voting-app-deadline/issues/05-poll-list-sorting.md. Within each
 * group, relative order is preserved (a stable partition), so callers get
 * "최신순" (newest first) within each group for free as long as `polls` is
 * already ordered newest-first (e.g. `listPolls`'s `ORDER BY created_at DESC`
 * — see lib/actions/polls.ts).
 */
export function sortPollsByStatus<T extends { closesAt: ClosesAt }>(
  polls: T[],
  now: number = Date.now(),
): T[] {
  const open: T[] = [];
  const closed: T[] = [];
  for (const poll of polls) {
    (isPollClosed(poll.closesAt, now) ? closed : open).push(poll);
  }
  return [...open, ...closed];
}
