import { describe, expect, it, beforeEach } from "vitest";
import { login } from "@/lib/actions/auth";
import { createPoll, updatePollDeadline, listPolls } from "@/lib/actions/polls";
import { truncateAll } from "../helpers/db";

// NOTE: this file exercises the DB-backed server-action seam
// (lib/actions/polls.ts) and therefore imports lib/db.ts transitively.
// lib/db.ts throws at import time unless TEST_DATABASE_URL is set (see the
// comment in lib/db.ts) — TEST_DATABASE_URL is not configured in this
// environment, so this file cannot execute here. It is written per the
// existing pattern (tests/actions/*.test.ts) so it's ready to run once a
// separate Neon test branch is configured.

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!;

async function operatorToken(): Promise<string> {
  const result = await login(ADMIN_PASSWORD);
  if (!result.ok) throw new Error("test setup: login failed");
  return result.token;
}

async function makePoll(closesAt: Date | null = null) {
  const token = await operatorToken();
  const created = await createPoll(token, "다음 회식 메뉴는?", ["치킨", "피자"], closesAt);
  if (!created.ok) throw new Error("test setup: createPoll failed");
  return created.poll;
}

describe("createPoll with an optional closesAt (ticket 02)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("defaults closesAt to null (무기한) when not given", async () => {
    const poll = await makePoll();
    expect(poll.closesAt).toBeNull();
  });

  it("stores an explicit future closesAt", async () => {
    const token = await operatorToken();
    const closesAt = new Date(Date.now() + 60_000);
    const result = await createPoll(token, "마감 있는 설문", ["A", "B"], closesAt);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.poll.closesAt).toBe(closesAt.toISOString());
  });
});

describe("updatePollDeadline (ticket 02)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("rejects without a valid operator session", async () => {
    const poll = await makePoll();
    const result = await updatePollDeadline(undefined, poll.id, new Date());
    expect(result).toEqual({ ok: false, error: "unauthorized" });
  });

  it("sets a closesAt on a poll that was created without one", async () => {
    const token = await operatorToken();
    const poll = await makePoll();
    const closesAt = new Date(Date.now() + 3600_000);

    const result = await updatePollDeadline(token, poll.id, closesAt);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.poll.closesAt).toBe(closesAt.toISOString());
  });

  it("changes an existing closesAt to a new value", async () => {
    const token = await operatorToken();
    const poll = await makePoll(new Date(Date.now() + 3600_000));
    const newClosesAt = new Date(Date.now() + 7200_000);

    const result = await updatePollDeadline(token, poll.id, newClosesAt);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.poll.closesAt).toBe(newClosesAt.toISOString());
  });

  it("clears closesAt back to null (무기한) when passed null", async () => {
    const token = await operatorToken();
    const poll = await makePoll(new Date(Date.now() + 3600_000));

    const result = await updatePollDeadline(token, poll.id, null);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.poll.closesAt).toBeNull();
  });

  it('"지금 마감하기" is just updatePollDeadline called with closesAt = now', async () => {
    const token = await operatorToken();
    const poll = await makePoll();
    const now = Date.now();

    const result = await updatePollDeadline(token, poll.id, new Date(now));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.poll.closesAt).toBe(new Date(now).toISOString());
  });

  it("returns not_found for a poll id that doesn't exist", async () => {
    const token = await operatorToken();
    const result = await updatePollDeadline(token, 999999, new Date());
    expect(result).toEqual({ ok: false, error: "not_found" });
  });

  it("leaves the question untouched — updatePollDeadline has no parameter for it, only closesAt is mutable", async () => {
    const token = await operatorToken();
    const poll = await makePoll();
    const result = await updatePollDeadline(token, poll.id, new Date());
    expect(result.ok).toBe(true);

    const polls = await listPolls();
    const found = polls.find((p) => p.id === poll.id);
    expect(found?.question).toBe("다음 회식 메뉴는?");
  });
});
