import { describe, expect, it, beforeEach } from "vitest";
import { login } from "@/lib/actions/auth";
import { createPoll, castVote, getPoll } from "@/lib/actions/polls";
import { sql } from "@/lib/db";
import { truncateAll } from "../helpers/db";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!;

async function operatorToken(): Promise<string> {
  const result = await login(ADMIN_PASSWORD);
  if (!result.ok) throw new Error("test setup: login failed");
  return result.token;
}

async function makePoll() {
  const token = await operatorToken();
  const created = await createPoll(token, "짜장 vs 짬뽕", ["짜장면", "짬뽕"]);
  if (!created.ok) throw new Error("test setup: createPoll failed");
  return created.poll;
}

describe("castVote (ticket 06)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("mints a new voter_token when the visitor doesn't have one yet", async () => {
    const poll = await makePoll();
    const result = await castVote(poll.id, poll.choices[0].id, undefined);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(typeof result.voterToken).toBe("string");
    expect(result.voterToken.length).toBeGreaterThan(0);
  });

  it("shows gated results immediately after a successful vote", async () => {
    const poll = await makePoll();
    const result = await castVote(poll.id, poll.choices[0].id, "voter-a");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.poll.resultsVisible).toBe(true);
    expect(result.poll.totalVotes).toBe(1);
    expect(result.poll.results).toEqual([
      { choiceId: poll.choices[0].id, label: "짜장면", votes: 1, percent: 100 },
      { choiceId: poll.choices[1].id, label: "짬뽕", votes: 0, percent: 0 },
    ]);
  });

  it("rejects a second vote from the same voter_token on the same poll (app-level check)", async () => {
    const poll = await makePoll();
    const first = await castVote(poll.id, poll.choices[0].id, "voter-b");
    expect(first.ok).toBe(true);

    const second = await castVote(poll.id, poll.choices[1].id, "voter-b");
    expect(second).toEqual({ ok: false, error: "already_voted", voterToken: "voter-b" });

    const rows = await sql`SELECT choice_id FROM votes WHERE poll_id = ${poll.id} AND voter_token = 'voter-b'`;
    expect(rows).toHaveLength(1);
  });

  it("rejects concurrent duplicate votes via the DB unique constraint even if both requests race past the app-level check", async () => {
    const poll = await makePoll();
    const choiceId = poll.choices[0].id;

    // Simulate two concurrent castVote calls with the same voter_token: both
    // may pass the app-level pre-check before either INSERT commits, so the
    // DB's UNIQUE (poll_id, voter_token) constraint must be the final guard.
    const [first, second] = await Promise.allSettled([
      castVote(poll.id, choiceId, "voter-race"),
      castVote(poll.id, choiceId, "voter-race"),
    ]);

    const results = [first, second].map((settled) =>
      settled.status === "fulfilled" ? settled.value : { ok: false, error: "threw" },
    );
    const successes = results.filter((r) => r.ok === true);
    const rejections = results.filter((r) => r.ok === false);

    expect(successes).toHaveLength(1);
    expect(rejections).toHaveLength(1);
    expect(rejections[0]).toMatchObject({ ok: false, error: "already_voted" });

    const rows = await sql`SELECT id FROM votes WHERE poll_id = ${poll.id} AND voter_token = 'voter-race'`;
    expect(rows).toHaveLength(1);
  });

  it("re-fetching the poll with the same voter_token shows results instead of the vote form", async () => {
    const poll = await makePoll();
    await castVote(poll.id, poll.choices[0].id, "voter-c");

    const result = await getPoll(poll.id, "voter-c", undefined);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.poll.hasVoted).toBe(true);
    expect(result.poll.resultsVisible).toBe(true);
  });

  it("returns invalid_choice when the choice doesn't belong to the poll", async () => {
    const pollA = await makePoll();
    const pollB = await makePoll();

    const result = await castVote(pollA.id, pollB.choices[0].id, "voter-d");
    expect(result).toEqual({ ok: false, error: "invalid_choice" });
  });

  it("returns not_found for a poll id that doesn't exist", async () => {
    const result = await castVote(999999, 1, "voter-e");
    expect(result).toEqual({ ok: false, error: "not_found" });
  });

  it("has no action to change a previously cast vote", async () => {
    // There is deliberately no updateVote export; casting again with the same
    // voter_token on the same poll always rejects instead of changing the choice.
    const poll = await makePoll();
    await castVote(poll.id, poll.choices[0].id, "voter-f");
    const secondAttempt = await castVote(poll.id, poll.choices[1].id, "voter-f");
    expect(secondAttempt.ok).toBe(false);

    const rows = await sql`SELECT choice_id FROM votes WHERE poll_id = ${poll.id} AND voter_token = 'voter-f'`;
    expect(rows[0].choice_id).toBe(poll.choices[0].id);
  });
});
