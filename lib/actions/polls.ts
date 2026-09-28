import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { isOperatorSession } from "@/lib/actions/auth";
import { computePercent } from "@/lib/poll-percent";
import { isPollClosed, sortPollsByStatus, toDateMs, type ClosesAt } from "@/lib/poll-status";

// This is the server-action seam for 설문(Poll)/선택지(Choice)/투표(Vote), per
// .scratch/voting-app/spec.md "Testing Decisions". Like lib/actions/auth.ts,
// these functions accept session/voter tokens as plain arguments instead of
// reading `next/headers` cookies() directly, so they're callable from Vitest
// with no mocking and from the thin "use server" wrappers under app/**.

/** Normalizes a closes_at value coming back from Postgres (a Date, an ISO
 * string, or null depending on the driver) into a plain ISO string or null —
 * the shape every server-action return type uses so it's safe to pass across
 * the server/client boundary. */
function toIsoOrNull(value: ClosesAt): string | null {
  const ms = toDateMs(value);
  return ms === null ? null : new Date(ms).toISOString();
}

export type CreatePollResult =
  | { ok: true; poll: PollSummary }
  | { ok: false; error: "unauthorized" }
  | { ok: false; error: "invalid_input"; message: string };

export type PollSummary = {
  id: number;
  question: string;
  choices: { id: number; label: string; position: number }[];
  closesAt: string | null;
};

/**
 * Creates a Poll and its Choices atomically. Requires a valid operator
 * session. Rejects fewer than 2 non-empty choice labels. Implemented as a
 * single SQL statement (a data-modifying CTE feeding a second insert) so
 * Postgres itself guarantees "poll + choices, or neither" with no
 * multi-statement transaction wiring needed.
 *
 * `closesAt` is optional and, unlike `question`/choices, remains mutable
 * after creation via `updatePollDeadline` (see 설문/마감 in CONTEXT.md) —
 * omitting it (or passing null) means the poll runs forever.
 */
export async function createPoll(
  sessionToken: string | undefined | null,
  question: string,
  choiceLabels: string[],
  closesAt: Date | null = null,
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
      INSERT INTO polls (question, closes_at) VALUES (${trimmedQuestion}, ${closesAt})
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
    poll: {
      id: pollId,
      question: trimmedQuestion,
      choices,
      // No need to round-trip through the DB for this — it's exactly the
      // value we just inserted.
      closesAt: closesAt ? closesAt.toISOString() : null,
    },
  };
}

export type UpdatePollDeadlineResult =
  | { ok: true; poll: { id: number; closesAt: string | null } }
  | { ok: false; error: "unauthorized" }
  | { ok: false; error: "not_found" };

/**
 * Sets, changes, or clears (`closesAt = null`) a Poll's `closes_at` — the one
 * field an Operator can edit after creation (question/choices stay
 * immutable, per CONTEXT.md). "지금 마감하기" (close now) is just this
 * function called with `closesAt = new Date(now)`; there is no separate
 * boolean/status column (docs/adr/0004-deadline-computed-not-scheduled.md).
 * Requires a valid operator session, checked with the same injectable-clock
 * pattern as `isOperatorSession` elsewhere in this codebase.
 */
export async function updatePollDeadline(
  sessionToken: string | undefined | null,
  pollId: number,
  closesAt: Date | null,
  now: number = Date.now(),
): Promise<UpdatePollDeadlineResult> {
  if (!isOperatorSession(sessionToken, now)) {
    return { ok: false, error: "unauthorized" };
  }

  const rows = (await sql`
    UPDATE polls SET closes_at = ${closesAt} WHERE id = ${pollId}
    RETURNING id, closes_at
  `) as unknown as { id: number; closes_at: string | Date | null }[];

  if (rows.length === 0) {
    return { ok: false, error: "not_found" };
  }

  return { ok: true, poll: { id: rows[0].id, closesAt: toIsoOrNull(rows[0].closes_at) } };
}

export type PollListItem = {
  id: number;
  question: string;
  closesAt: string | null;
  isClosed: boolean;
};

/**
 * Returns every Poll's id/question/closesAt/isClosed (no vote counts). Open
 * polls are listed before 마감(Closed) ones, newest-first within each group
 * — see .scratch/voting-app-deadline/issues/05-poll-list-sorting.md. The
 * ordering itself is delegated to the pure, unit-tested `sortPollsByStatus`;
 * this function's own job is only the DB fetch, newest-first as a tie-break
 * baseline within each group.
 */
export async function listPolls(now: number = Date.now()): Promise<PollListItem[]> {
  const rows = (await sql`
    SELECT id, question, closes_at FROM polls ORDER BY created_at DESC, id DESC
  `) as unknown as { id: number; question: string; closes_at: string | Date | null }[];

  const items: PollListItem[] = rows.map((row) => ({
    id: row.id,
    question: row.question,
    closesAt: toIsoOrNull(row.closes_at),
    isClosed: isPollClosed(row.closes_at, now),
  }));

  return sortPollsByStatus(items, now);
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
  /** True if the caller (voter who already voted on this poll, an operator,
   * or anyone once the poll is 마감/Closed) is allowed to see vote counts.
   * Computed live from `isClosed` on every call, never a stored "revealed"
   * flag — see docs/adr/0003-live-computed-result-visibility.md. If an
   * operator extends `closesAt` back into the future, this flips back to the
   * normal voted-only gate (intentional, not a bug). */
  resultsVisible: boolean;
  /** True when the caller holds a valid operator session. The vote
   * form/button must never render for an operator view (it's a read-only
   * monitoring page, not a ballot) — `hasVoted` alone isn't enough to tell,
   * since an operator has no voter_token and so is indistinguishable from a
   * "hasn't voted yet" visitor on that field alone. */
  isOperatorView: boolean;
  /** Null means the poll runs forever (무기한). */
  closesAt: string | null;
  /** `closesAt !== null && closesAt <= now`, recomputed on every call — no
   * stored status column (docs/adr/0004-deadline-computed-not-scheduled.md). */
  isClosed: boolean;
  totalVotes?: number;
  results?: PollResult[];
};

export type GetPollResult = { ok: true; poll: PollView } | { ok: false; error: "not_found" };

/**
 * Returns a Poll's question and choices. Numbers (vote counts, percentages,
 * total votes) are only included when the caller has already voted on this
 * poll (identified by `voterToken`), holds a valid operator session
 * (`sessionToken`), or the poll is 마감(Closed) — see docs/adr/0003 and
 * ticket 03/05/08 acceptance criteria. `now` is injectable (defaults to the
 * real clock) so tests can deterministically simulate "just past closesAt"
 * without waiting for real time to pass.
 */
export async function getPoll(
  pollId: number,
  voterToken: string | undefined | null,
  sessionToken?: string | undefined | null,
  now: number = Date.now(),
): Promise<GetPollResult> {
  const pollRows = (await sql`
    SELECT id, question, closes_at FROM polls WHERE id = ${pollId}
  `) as unknown as { id: number; question: string; closes_at: string | Date | null }[];

  if (pollRows.length === 0) {
    return { ok: false, error: "not_found" };
  }
  const poll = pollRows[0];
  const isClosed = isPollClosed(poll.closes_at, now);

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

  const isOperatorView = isOperatorSession(sessionToken, now);
  const resultsVisible = hasVoted || isOperatorView || isClosed;

  const base: PollView = {
    id: poll.id,
    question: poll.question,
    choices: choiceRows,
    hasVoted,
    resultsVisible,
    isOperatorView,
    closesAt: toIsoOrNull(poll.closes_at),
    isClosed,
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
    const percent = computePercent(votes, totalVotes);
    return { choiceId: choice.id, label: choice.label, votes, percent };
  });

  return { ok: true, poll: { ...base, totalVotes, results } };
}

export type CastVoteResult =
  | { ok: true; voterToken: string; poll: PollView }
  | { ok: false; error: "already_voted"; voterToken: string }
  | { ok: false; error: "not_found" }
  | { ok: false; error: "invalid_choice" }
  | { ok: false; error: "poll_closed" };

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
 * Also rejects any vote once the poll is 마감(Closed) — re-checked here
 * server-side on every call (ticket 03) regardless of what a client's
 * disabled-button/countdown UI shows, since those can't be trusted alone.
 * `now` is injectable for the same reason as `getPoll`'s.
 */
export async function castVote(
  pollId: number,
  choiceId: number,
  voterToken: string | undefined | null,
  now: number = Date.now(),
): Promise<CastVoteResult> {
  const token = voterToken || randomUUID();

  const pollRows = (await sql`
    SELECT id, closes_at FROM polls WHERE id = ${pollId}
  `) as unknown as { id: number; closes_at: string | Date | null }[];
  if (pollRows.length === 0) {
    return { ok: false, error: "not_found" };
  }

  const choiceRows = await sql`
    SELECT id FROM choices WHERE id = ${choiceId} AND poll_id = ${pollId}
  `;
  if (choiceRows.length === 0) {
    return { ok: false, error: "invalid_choice" };
  }

  if (isPollClosed(pollRows[0].closes_at, now)) {
    return { ok: false, error: "poll_closed" };
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

  const afterVote = await getPoll(pollId, token, undefined, now);
  if (!afterVote.ok) {
    throw new Error("Poll disappeared immediately after a vote was cast.");
  }

  return { ok: true, voterToken: token, poll: afterVote.poll };
}
