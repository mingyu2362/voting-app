// Pure helper extracted from lib/actions/polls.ts (getPoll) — see
// .scratch/voting-app-deadline/issues/01-foundation-closes-at-and-pure-helpers.md.
// Deliberately does not import lib/db.ts so it stays unit-testable without a
// database (lib/db.ts throws at import time when TEST_DATABASE_URL isn't set).

/**
 * Rounds `votes / totalVotes` to a percentage with one decimal place.
 * Returns 0 (never NaN/Infinity) when `totalVotes` is 0.
 */
export function computePercent(votes: number, totalVotes: number): number {
  if (totalVotes === 0) return 0;
  return Math.round((votes / totalVotes) * 1000) / 10;
}
