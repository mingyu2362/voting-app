import { describe, expect, it, beforeEach } from "vitest";
import { login } from "@/lib/actions/auth";
import { createPoll, getPoll } from "@/lib/actions/polls";
import { truncateAll } from "../helpers/db";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!;

async function operatorToken(): Promise<string> {
  const result = await login(ADMIN_PASSWORD);
  if (!result.ok) throw new Error("test setup: login failed");
  return result.token;
}

async function makePoll() {
  const token = await operatorToken();
  const created = await createPoll(token, "가장 좋아하는 계절은?", ["봄", "여름", "가을", "겨울"]);
  if (!created.ok) throw new Error("test setup: createPoll failed");
  return created.poll;
}

describe("getPoll (ticket 05 gating)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("returns not_found for a poll id that doesn't exist", async () => {
    const result = await getPoll(999999, undefined, undefined);
    expect(result).toEqual({ ok: false, error: "not_found" });
  });

  it("shows the question and choices but no numbers to a first-time visitor with no voter_token", async () => {
    const poll = await makePoll();
    const result = await getPoll(poll.id, undefined, undefined);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.poll.question).toBe("가장 좋아하는 계절은?");
    expect(result.poll.choices.map((c) => c.label)).toEqual(["봄", "여름", "가을", "겨울"]);
    expect(result.poll.hasVoted).toBe(false);
    expect(result.poll.resultsVisible).toBe(false);
    expect(result.poll.totalVotes).toBeUndefined();
    expect(result.poll.results).toBeUndefined();
    expect(JSON.stringify(result.poll)).not.toMatch(/percent|votes"/i);
  });

  it("shows no numbers to a visitor who has a voter_token but hasn't voted on this poll", async () => {
    const poll = await makePoll();
    const result = await getPoll(poll.id, "some-other-voter-token", undefined);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.poll.hasVoted).toBe(false);
    expect(result.poll.resultsVisible).toBe(false);
  });
});

describe("getPoll operator bypass (ticket 08)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("shows results to a logged-in operator even if they haven't voted on that poll", async () => {
    const poll = await makePoll();
    const sessionToken = await operatorToken();

    const result = await getPoll(poll.id, undefined, sessionToken);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.poll.hasVoted).toBe(false);
    expect(result.poll.resultsVisible).toBe(true);
    expect(result.poll.totalVotes).toBe(0);
    expect(result.poll.results).toBeDefined();
  });

  it("does not bypass the gate for a non-operator visitor (invalid session token)", async () => {
    const poll = await makePoll();
    const result = await getPoll(poll.id, undefined, "not-a-real-session");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.poll.resultsVisible).toBe(false);
  });
});
