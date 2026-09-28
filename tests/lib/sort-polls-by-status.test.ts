import { describe, expect, it } from "vitest";
import { sortPollsByStatus } from "@/lib/poll-status";

// Pure function, no DB — runnable without TEST_DATABASE_URL. See
// .scratch/voting-app-deadline/issues/05-poll-list-sorting.md.
describe("sortPollsByStatus (ticket 05)", () => {
  const now = Date.parse("2026-01-15T12:00:00.000Z");
  const past = new Date(now - 1000).toISOString();
  const future = new Date(now + 1000).toISOString();

  it("puts open polls before closed polls", () => {
    const polls = [
      { id: 1, closesAt: past }, // closed
      { id: 2, closesAt: null }, // open (무기한)
      { id: 3, closesAt: future }, // open
    ];
    const sorted = sortPollsByStatus(polls, now);
    expect(sorted.map((p) => p.id)).toEqual([2, 3, 1]);
  });

  it("preserves relative (newest-first) order within each group", () => {
    // Simulates listPolls's ORDER BY created_at DESC — id 5 is the newest.
    const polls = [
      { id: 5, closesAt: null }, // open, newest
      { id: 4, closesAt: past }, // closed, newest of the closed ones
      { id: 3, closesAt: null }, // open
      { id: 2, closesAt: past }, // closed
      { id: 1, closesAt: null }, // open, oldest
    ];
    const sorted = sortPollsByStatus(polls, now);
    expect(sorted.map((p) => p.id)).toEqual([5, 3, 1, 4, 2]);
  });

  it("returns an empty array unchanged", () => {
    expect(sortPollsByStatus([], now)).toEqual([]);
  });

  it("keeps an all-open list in its original order", () => {
    const polls = [{ id: 1, closesAt: null }, { id: 2, closesAt: future }];
    expect(sortPollsByStatus(polls, now).map((p) => p.id)).toEqual([1, 2]);
  });

  it("keeps an all-closed list in its original order", () => {
    const polls = [{ id: 1, closesAt: past }, { id: 2, closesAt: past }];
    expect(sortPollsByStatus(polls, now).map((p) => p.id)).toEqual([1, 2]);
  });

  it("treats a poll closing exactly at `now` as closed (boundary, matches isPollClosed)", () => {
    const polls = [
      { id: 1, closesAt: new Date(now).toISOString() },
      { id: 2, closesAt: null },
    ];
    expect(sortPollsByStatus(polls, now).map((p) => p.id)).toEqual([2, 1]);
  });
});
