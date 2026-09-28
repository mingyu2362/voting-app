import { describe, expect, it, beforeEach } from "vitest";
import { sql } from "@/lib/db";
import { truncateAll } from "./helpers/db";

describe("foundation: schema + test harness (ticket 01)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("has polls, choices, and votes tables reachable over the configured connection", async () => {
    const pollRows = await sql`SELECT id, question, created_at FROM polls LIMIT 1`;
    const choiceRows = await sql`SELECT id, poll_id, label, position FROM choices LIMIT 1`;
    const voteRows = await sql`SELECT id, poll_id, choice_id, voter_token FROM votes LIMIT 1`;

    expect(pollRows).toEqual([]);
    expect(choiceRows).toEqual([]);
    expect(voteRows).toEqual([]);
  });

  it("cascades poll deletion to choices and votes", async () => {
    const [poll] = await sql`INSERT INTO polls (question) VALUES ('t') RETURNING id`;
    const [choice] = await sql`INSERT INTO choices (poll_id, label, position) VALUES (${poll.id}, 'a', 0) RETURNING id`;
    await sql`INSERT INTO votes (poll_id, choice_id, voter_token) VALUES (${poll.id}, ${choice.id}, 'tok-1')`;

    await sql`DELETE FROM polls WHERE id = ${poll.id}`;

    const remainingChoices = await sql`SELECT id FROM choices WHERE poll_id = ${poll.id}`;
    const remainingVotes = await sql`SELECT id FROM votes WHERE poll_id = ${poll.id}`;
    expect(remainingChoices).toEqual([]);
    expect(remainingVotes).toEqual([]);
  });

  it("rejects a second vote from the same voter_token on the same poll at the DB level", async () => {
    const [poll] = await sql`INSERT INTO polls (question) VALUES ('t') RETURNING id`;
    const [choice] = await sql`INSERT INTO choices (poll_id, label, position) VALUES (${poll.id}, 'a', 0) RETURNING id`;
    await sql`INSERT INTO votes (poll_id, choice_id, voter_token) VALUES (${poll.id}, ${choice.id}, 'dup-token')`;

    await expect(
      sql`INSERT INTO votes (poll_id, choice_id, voter_token) VALUES (${poll.id}, ${choice.id}, 'dup-token')`,
    ).rejects.toThrow();
  });

  it("truncateAll clears rows left over from a previous test", async () => {
    await sql`INSERT INTO polls (question) VALUES ('leftover')`;
    await truncateAll();
    const rows = await sql`SELECT id FROM polls`;
    expect(rows).toEqual([]);
  });
});
