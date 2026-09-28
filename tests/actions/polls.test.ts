import { describe, expect, it, beforeEach } from "vitest";
import { login } from "@/lib/actions/auth";
import { createPoll, listPolls } from "@/lib/actions/polls";
import { truncateAll } from "../helpers/db";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!;

async function operatorToken(): Promise<string> {
  const result = await login(ADMIN_PASSWORD);
  if (!result.ok) throw new Error("test setup: login failed");
  return result.token;
}

describe("createPoll (ticket 03)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("rejects poll creation without a valid operator session", async () => {
    const result = await createPoll(undefined, "점심 뭐 먹지?", ["짜장면", "짬뽕"]);
    expect(result).toEqual({ ok: false, error: "unauthorized" });
  });

  it("rejects a garbage/expired session token", async () => {
    const result = await createPoll("garbage.token", "점심 뭐 먹지?", ["짜장면", "짬뽕"]);
    expect(result).toEqual({ ok: false, error: "unauthorized" });
  });

  it("creates a poll with 2+ choices for a logged-in operator", async () => {
    const token = await operatorToken();
    const result = await createPoll(token, "점심 뭐 먹지?", ["짜장면", "짬뽕", "탕수육"]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.poll.question).toBe("점심 뭐 먹지?");
    expect(result.poll.choices).toHaveLength(3);
    expect(result.poll.choices.map((c) => c.label)).toEqual([
      "짜장면",
      "짬뽕",
      "탕수육",
    ]);
    expect(result.poll.choices.map((c) => c.position)).toEqual([0, 1, 2]);
  });

  it("rejects creation with fewer than 2 choices", async () => {
    const token = await operatorToken();
    const result = await createPoll(token, "혼자 정하는 설문", ["딱하나"]);
    expect(result).toEqual({
      ok: false,
      error: "invalid_input",
      message: expect.any(String),
    });
  });

  it("rejects creation with 0 choices", async () => {
    const token = await operatorToken();
    const result = await createPoll(token, "선택지 없음", []);
    expect(result.ok).toBe(false);
  });

  it("does not leave a half-created poll behind when choice validation fails", async () => {
    const token = await operatorToken();
    await createPoll(token, "실패할 설문", ["딱하나"]);

    const polls = await listPolls();
    expect(polls.find((p) => p.question === "실패할 설문")).toBeUndefined();
  });

  it("makes the new poll show up in listPolls immediately, without vote counts", async () => {
    const token = await operatorToken();
    await createPoll(token, "새 설문", ["A", "B"]);

    const polls = await listPolls();
    const created = polls.find((p) => p.question === "새 설문");
    expect(created).toBeDefined();
    expect(Object.keys(created!).sort()).toEqual(["id", "question"]);
  });
});
