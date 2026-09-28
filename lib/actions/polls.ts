import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { isOperatorSession } from "@/lib/actions/auth";

// This is the server-action seam for 설문(Poll)/선택지(Choice)/투표(Vote), per
// .scratch/voting-app/spec.md "Testing Decisions". Like lib/actions/auth.ts,
// these functions accept session/voter tokens as plain arguments instead of
// reading `next/headers` cookies() directly, so they're callable from Vitest
// with no mocking and from the thin "use server" wrappers under app/**.

export type CreatePollResult =
  | { ok: true; poll: PollSummary }
  | { ok: false; error: "unauthorized" }
  | { ok: false; error: "invalid_input"; message: string };

export type PollSummary = {
  id: number;
  question: string;
  choices: { id: number; label: string; position: number }[];
};

/**
 * Creates a Poll and its Choices atomically. Requires a valid operator
 * session. Rejects fewer than 2 non-empty choice labels. Implemented as a
 * single SQL statement (a data-modifying CTE feeding a second insert) so
 * Postgres itself guarantees "poll + choices, or neither" with no
 * multi-statement transaction wiring needed.
 */
export async function createPoll(
  sessionToken: string | undefined | null,
  question: string,
  choiceLabels: string[],
): Promise<CreatePollResult> {
  if (!isOperatorSession(sessionToken)) {
    return { ok: false, error: "unauthorized" };
  }

  const trimmedQuestion = question.trim();
  const trimmedLabels = choiceLabels.map((label) => label.trim()).filter(Boolean);

  if (!trimmedQuestion) {
    return { ok: false, error: "invalid_input", message: "질문을 입력해주세요." };
  }
  if (trimmedLabels.length < 2) {
    return {
      ok: false,
      error: "invalid_input",
      message: "선택지를 2개 이상 입력해주세요.",
    };
  }

  const positions = trimmedLabels.map((_, index) => index);

  const rows = await sql`
    WITH new_poll AS (
      INSERT INTO polls (question) VALUES (${trimmedQuestion})
      RETURNING id
    )
    INSERT INTO choices (poll_id, label, position)
    SELECT new_poll.id, t.label, t.position
    FROM new_poll, unnest(${trimmedLabels}::text[], ${positions}::int[]) AS t(label, position)
    RETURNING poll_id, id, label, position
  `;

  const choiceRows = rows as unknown as {
    poll_id: number;
    id: number;
    label: string;
    position: number;
  }[];

  const pollId = choiceRows[0].poll_id;
  const choices = choiceRows
    .map((row) => ({ id: row.id, label: row.label, position: row.position }))
    .sort((a, b) => a.position - b.position);

  return {
    ok: true,
    poll: { id: pollId, question: trimmedQuestion, choices },
  };
}

/** Returns every Poll's id + question only (no vote counts). */
export async function listPolls(): Promise<{ id: number; question: string }[]> {
  const rows = await sql`
    SELECT id, question FROM polls ORDER BY created_at DESC, id DESC
  `;
  return rows as unknown as { id: number; question: string }[];
}

export type DeletePollResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" }
  | { ok: false; error: "not_found" };

/**
 * Deletes a Poll. Requires a valid operator session. Relies on the
 * `ON DELETE CASCADE` foreign keys (see db/migrations/0001_init.sql) to also
 * permanently remove its Choices and Votes. Irreversible — there is no undo.
 */
export async function deletePoll(
  sessionToken: string | undefined | null,
  pollId: number,
): Promise<DeletePollResult> {
  if (!isOperatorSession(sessionToken)) {
    return { ok: false, error: "unauthorized" };
  }

  const rows = await sql`
    DELETE FROM polls WHERE id = ${pollId} RETURNING id
  `;

  if (rows.length === 0) {
    return { ok: false, error: "not_found" };
  }

  return { ok: true };
}

export type PollChoice = { id: number; label: string; position: number };

export type PollResult = { choiceId: number; label: string; votes: number; percent: number };

export type PollView = {
  id: number;
  question: string;
  choices: PollChoice[];
  hasVoted: boolean;
  /** True if the caller (voter who already voted on this poll, or an
   * operator) is allowed to see vote counts. */
  resultsVisible: boolean;
  totalVotes?: number;
  results?: PollResult[];
};

export type GetPollResult = { ok: true; poll: PollView } | { ok: false; error: "not_found" };

/**
 * Returns a Poll's question and choices. Numbers (vote counts, percentages,
 * total votes) are only included when the caller has already voted on this
 * poll (identified by `voterToken`) or holds a valid operator session
 * (`sessionToken`) — see docs/adr and ticket 05/08 acceptance criteria.
 */
export async function getPoll(
  pollId: number,
  voterToken: string | undefined | null,
  sessionToken?: string | undefined | null,
): Promise<GetPollResult> {
  const pollRows = (await sql`
    SELECT id, question FROM polls WHERE id = ${pollId}
  `) as unknown as { id: number; question: string }[];

  if (pollRows.length === 0) {
    return { ok: false, error: "not_found" };
  }
  const poll = pollRows[0];

  const choiceRows = (await sql`
    SELECT id, label, position FROM choices WHERE poll_id = ${pollId} ORDER BY position ASC
  `) as unknown as PollChoice[];

  let hasVoted = false;
  if (voterToken) {
    const voteRows = await sql`
      SELECT 1 FROM votes WHERE poll_id = ${pollId} AND voter_token = ${voterToken} LIMIT 1
    `;
    hasVoted = voteRows.length > 0;
  }

  const resultsVisible = hasVoted || isOperatorSession(sessionToken);

  const base: PollView = {
    id: poll.id,
    question: poll.question,
    choices: choiceRows,
    hasVoted,
    resultsVisible,
  };

  if (!resultsVisible) {
    return { ok: true, poll: base };
  }

  const voteCountRows = (await sql`
    SELECT choice_id, COUNT(*)::int AS votes
    FROM votes
    WHERE poll_id = ${pollId}
    GROUP BY choice_id
  `) as unknown as { choice_id: number; votes: number }[];

  const countByChoiceId = new Map(voteCountRows.map((row) => [row.choice_id, row.votes]));
  const totalVotes = [...countByChoiceId.values()].reduce((sum, n) => sum + n, 0);

  const results: PollResult[] = choiceRows.map((choice) => {
    const votes = countByChoiceId.get(choice.id) ?? 0;
    const percent = totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 1000) / 10;
    return { choiceId: choice.id, label: choice.label, votes, percent };
  });

  return { ok: true, poll: { ...base, totalVotes, results } };
}

export type CastVoteResult =
  | { ok: true; voterToken: string; poll: PollView }
  | { ok: false; error: "already_voted"; voterToken: string }
  | { ok: false; error: "not_found" }
  | { ok: false; error: "invalid_choice" };

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

/**
 * Casts a Vote for `choiceId` on `pollId`. If `voterToken` is missing, mints a
 * new opaque one (the caller is responsible for persisting it back into the
 * cookie). Rejects a second vote from the same voter_token on the same poll,
 * both via an application-level pre-check and, as a safety net for
 * concurrent requests, the DB's `UNIQUE (poll_id, voter_token)` constraint.
 */
export async function castVote(
  pollId: number,
  choiceId: number,
  voterToken: string | undefined | null,
): Promise<CastVoteResult> {
  const token = voterToken || randomUUID();

  const choiceRows = await sql`
    SELECT id FROM choices WHERE id = ${choiceId} AND poll_id = ${pollId}
  `;
  if (choiceRows.length === 0) {
    const pollRows = await sql`SELECT id FROM polls WHERE id = ${pollId}`;
    if (pollRows.length === 0) {
      return { ok: false, error: "not_found" };
    }
    return { ok: false, error: "invalid_choice" };
  }

  const existingVote = await sql`
    SELECT 1 FROM votes WHERE poll_id = ${pollId} AND voter_token = ${token} LIMIT 1
  `;
  if (existingVote.length > 0) {
    return { ok: false, error: "already_voted", voterToken: token };
  }

  try {
    await sql`
      INSERT INTO votes (poll_id, choice_id, voter_token) VALUES (${pollId}, ${choiceId}, ${token})
    `;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "already_voted", voterToken: token };
    }
    throw error;
  }

  const afterVote = await getPoll(pollId, token, undefined);
  if (!afterVote.ok) {
    throw new Error("Poll disappeared immediately after a vote was cast.");
  }

  return { ok: true, voterToken: token, poll: afterVote.poll };
}
