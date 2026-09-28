import { describe, expect, it, beforeEach } from "vitest";
import { login } from "@/lib/actions/auth";
import { createPoll, castVote, getPoll, updatePollDeadline } from "@/lib/actions/polls";
import { truncateAll } from "../helpers/db";

// NOTE: this file exercises the DB-backed server-action seam
// (lib/actions/polls.ts) and therefore imports lib/db.ts transitively.
// lib/db.ts throws at import time unless TEST_DATABASE_URL is set — not
// configured in this environment, so this file cannot execute here. Written
// per the existing pattern (tests/actions/*.test.ts), ready to run once a
// separate Neon test branch is configured.

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!;

async function operatorToken(): Promise<string> {
  const result = await login(ADMIN_PASSWORD);
  if (!result.ok) throw new Error("test setup: login failed");
  return result.token;
}

async function makePoll(closesAt: Date | null = null) {
  const token = await operatorToken();
  const created = await createPoll(token, "이번 주 회의는 언제?", ["월요일", "화요일"], closesAt);
  if (!created.ok) throw new Error("test setup: createPoll failed");
  return created.poll;
}

describe("castVote rejects voting on a closed poll (ticket 03)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("rejects a vote once closesAt has passed, even for a fresh voter_token", async () => {
    const poll = await makePoll(new Date(Date.now() - 1000)); // already closed
    const result = await castVote(poll.id, poll.choices[0].id, "voter-closed-1");
    expect(result).toEqual({ ok: false, error: "poll_closed" });
  });

  it("does not reject a vote before closesAt", async () => {
    const poll = await makePoll(new Date(Date.now() + 60_000)); // closes in the future
    const result = await castVote(poll.id, poll.choices[0].id, "voter-open-1");
    expect(result.ok).toBe(true);
  });

  it("does not record a vote for a poll closed at exactly `now` (boundary)", async () => {
    const now = Date.now();
    const poll = await makePoll(new Date(now));
    const result = await castVote(poll.id, poll.choices[0].id, "voter-boundary-1", now + 1);
    expect(result).toEqual({ ok: false, error: "poll_closed" });
  });

  it("rejects even when the voter already holds a voter_token that never voted on this poll", async () => {
    const poll = await makePoll(new Date(Date.now() - 1000));
    const result = await castVote(poll.id, poll.choices[1].id, "some-existing-voter-token");
    expect(result).toEqual({ ok: false, error: "poll_closed" });
  });

  it("rejects a closed-poll vote attempt before checking already_voted (poll_closed wins)", async () => {
    // Vote while still open, then close it, then try again with the same token.
    const token = await operatorToken();
    const poll = await makePoll();
    await castVote(poll.id, poll.choices[0].id, "voter-then-closed");
    await updatePollDeadline(token, poll.id, new Date(Date.now() - 1000));

    const result = await castVote(poll.id, poll.choices[1].id, "voter-then-closed");
    expect(result).toEqual({ ok: false, error: "poll_closed" });
  });
});

describe("getPoll reveals results on a closed poll regardless of hasVoted/operator (ticket 03, ADR 0003)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("shows results to a visitor with no voter_token on a closed poll", async () => {
    const poll = await makePoll(new Date(Date.now() - 1000));
    const result = await getPoll(poll.id, undefined, undefined);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.poll.hasVoted).toBe(false);
    expect(result.poll.isClosed).toBe(true);
    expect(result.poll.resultsVisible).toBe(true);
    expect(result.poll.totalVotes).toBe(0);
    expect(result.poll.results).toBeDefined();
  });

  it("does not show results before closesAt to a non-voter, non-operator visitor", async () => {
    const poll = await makePoll(new Date(Date.now() + 60_000));
    const result = await getPoll(poll.id, undefined, undefined);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.poll.isClosed).toBe(false);
    expect(result.poll.resultsVisible).toBe(false);
  });

  it("reports isClosed:false and closesAt:null for a poll with no deadline", async () => {
    const poll = await makePoll(null);
    const result = await getPoll(poll.id, undefined, undefined);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.poll.isClosed).toBe(false);
    expect(result.poll.closesAt).toBeNull();
  });
});

describe("extending closesAt back into the future re-hides results (ADR 0003)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("hides results again for a non-voter once a closed poll's deadline is extended forward", async () => {
    const token = await operatorToken();
    const poll = await makePoll(new Date(Date.now() - 1000)); // starts closed

    const whileClosed = await getPoll(poll.id, undefined, undefined);
    expect(whileClosed.ok && whileClosed.poll.resultsVisible).toBe(true);

    await updatePollDeadline(token, poll.id, new Date(Date.now() + 60_000)); // extend into the future

    const afterExtension = await getPoll(poll.id, undefined, undefined);
    expect(afterExtension.ok).toBe(true);
    if (!afterExtension.ok) return;
    expect(afterExtension.poll.isClosed).toBe(false);
    expect(afterExtension.poll.resultsVisible).toBe(false);
    expect(afterExtension.poll.totalVotes).toBeUndefined();
  });

  it("allows voting again after a closed poll's deadline is extended forward", async () => {
    const token = await operatorToken();
    const poll = await makePoll(new Date(Date.now() - 1000));

    const whileClosed = await castVote(poll.id, poll.choices[0].id, "voter-reopen-1");
    expect(whileClosed).toEqual({ ok: false, error: "poll_closed" });

    await updatePollDeadline(token, poll.id, new Date(Date.now() + 60_000));

    const afterExtension = await castVote(poll.id, poll.choices[0].id, "voter-reopen-1");
    expect(afterExtension.ok).toBe(true);
  });
});

describe("getPoll still bypasses the gate for a valid operator session, even when open (unchanged from ticket 08)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("shows results to an operator on an open poll they haven't voted on", async () => {
    const poll = await makePoll();
    const token = await operatorToken();

    const result = await getPoll(poll.id, undefined, token);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.poll.resultsVisible).toBe(true);
    expect(result.poll.isClosed).toBe(false);
  });
});
