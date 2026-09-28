import { describe, expect, it, beforeEach } from "vitest";
import { login } from "@/lib/actions/auth";
import { createPoll, deletePoll, listPolls } from "@/lib/actions/polls";
import { sql } from "@/lib/db";
import { truncateAll } from "../helpers/db";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!;

async function operatorToken(): Promise<string> {
  const result = await login(ADMIN_PASSWORD);
  if (!result.ok) throw new Error("test setup: login failed");
  return result.token;
}

describe("deletePoll (ticket 04)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("rejects deletion without a valid operator session", async () => {
    const token = await operatorToken();
    const created = await createPoll(token, "지울 설문", ["A", "B"]);
    if (!created.ok) throw new Error("setup failed");

    const result = await deletePoll(undefined, created.poll.id);
    expect(result).toEqual({ ok: false, error: "unauthorized" });

    const polls = await listPolls();
    expect(polls.find((p) => p.id === created.poll.id)).toBeDefined();
  });

  it("removes the poll from listPolls immediately after deletion", async () => {
    const token = await operatorToken();
    const created = await createPoll(token, "지울 설문 2", ["A", "B"]);
    if (!created.ok) throw new Error("setup failed");

    const result = await deletePoll(token, created.poll.id);
    expect(result).toEqual({ ok: true });

    const polls = await listPolls();
    expect(polls.find((p) => p.id === created.poll.id)).toBeUndefined();
  });

  it("cascades deletion to the poll's choices and votes", async () => {
    const token = await operatorToken();
    const created = await createPoll(token, "지울 설문 3", ["A", "B"]);
    if (!created.ok) throw new Error("setup failed");
    const choiceId = created.poll.choices[0].id;

    await sql`INSERT INTO votes (poll_id, choice_id, voter_token) VALUES (${created.poll.id}, ${choiceId}, 'voter-x')`;

    const result = await deletePoll(token, created.poll.id);
    expect(result).toEqual({ ok: true });

    const remainingChoices = await sql`SELECT id FROM choices WHERE poll_id = ${created.poll.id}`;
    const remainingVotes = await sql`SELECT id FROM votes WHERE poll_id = ${created.poll.id}`;
    expect(remainingChoices).toEqual([]);
    expect(remainingVotes).toEqual([]);
  });

  it("returns not_found for a poll id that doesn't exist", async () => {
    const token = await operatorToken();
    const result = await deletePoll(token, 999999);
    expect(result).toEqual({ ok: false, error: "not_found" });
  });
});
