"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { PollView } from "@/lib/actions/polls";
import { fetchPollAction, voteAction } from "./actions";
import { Countdown } from "./Countdown";
import { ResultsBarChart } from "./ResultsBarChart";

const POLL_INTERVAL_MS = 4000; // within the 3-5s window from ADR 0002 / ticket 07

export function PollDetail({
  pollId,
  initialPoll,
}: {
  pollId: number;
  initialPoll: PollView;
}) {
  const [poll, setPoll] = useState<PollView>(initialPoll);
  const [selectedChoiceId, setSelectedChoiceId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ticket 07: only poll for fresh results once results are visible, and stop
  // polling when the poll stops being visible (shouldn't normally happen) or
  // the component unmounts.
  useEffect(() => {
    if (!poll.resultsVisible) return;

    intervalRef.current = setInterval(() => {
      startTransition(async () => {
        const result = await fetchPollAction(pollId);
        if (result.ok) {
          setPoll(result.poll);
        }
      });
    }, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [poll.resultsVisible, pollId]);

  function handleVote() {
    if (poll.isClosed) return; // server re-checks regardless (ticket 03); this is just belt-and-suspenders for a stale disabled state
    if (selectedChoiceId === null) {
      setError("선택지를 하나 골라주세요.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await voteAction(pollId, selectedChoiceId);
      if (!result.ok) {
        setError(
          result.error === "already_voted"
            ? "이미 이 투표에 투표했습니다."
            : result.error === "poll_closed"
              ? "마감된 투표에는 투표할 수 없습니다."
              : "투표를 제출할 수 없습니다.",
        );
        return;
      }
      setPoll(result.poll);
    });
  }

  // Ticket 03: once a poll is 마감(Closed), results become visible to
  // everyone regardless of hasVoted (docs/adr/0003) — but the vote
  // button/form must still be shown (disabled, with an explanatory message),
  // never hidden. So the vote section is rendered whenever the caller hasn't
  // voted yet, independently of resultsVisible; the results section is
  // rendered whenever resultsVisible is true. Both can show at once (closed,
  // not-yet-voted visitor). An operator view is never a voter (no
  // voter_token, so hasVoted is always false there too) — it's a read-only
  // monitoring page, so the vote section must stay hidden for it regardless.
  return (
    <div className="flex flex-col gap-6">
      {/* Ticket 04: no deadline at all (closesAt === null, 무기한) renders
          nothing here; an already-closed poll shows a static "마감됨" status
          instead of a live countdown. */}
      {poll.closesAt && !poll.isClosed && <Countdown closesAt={poll.closesAt} />}
      {poll.closesAt && poll.isClosed && (
        <p className="text-sm text-zinc-500">마감된 투표입니다.</p>
      )}

      {!poll.hasVoted && !poll.isOperatorView && (
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2" disabled={poll.isClosed}>
            {poll.choices.map((choice) => (
              <label
                key={choice.id}
                className="flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 has-[:disabled]:opacity-50"
              >
                <input
                  type="radio"
                  name="choice"
                  value={choice.id}
                  checked={selectedChoiceId === choice.id}
                  onChange={() => setSelectedChoiceId(choice.id)}
                  disabled={poll.isClosed}
                />
                {choice.label}
              </label>
            ))}
          </fieldset>
          {poll.isClosed && (
            <p className="text-sm text-zinc-500">
              마감된 투표입니다. 더 이상 투표할 수 없습니다.
            </p>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="button"
            onClick={handleVote}
            disabled={isPending || poll.isClosed}
            className="self-start rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {isPending ? "제출 중..." : "투표하기"}
          </button>
        </div>
      )}

      {poll.resultsVisible && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-500">총 {poll.totalVotes}표</p>
          {/* Ticket 06: bar chart alongside (not replacing) the votes/percent
              numbers in the list below — renders fine at 0 total votes too. */}
          <ResultsBarChart results={poll.results ?? []} />
          <ul className="flex flex-col gap-2">
            {poll.results?.map((result) => (
              <li
                key={result.choiceId}
                className="flex flex-col gap-2 rounded-md border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800"
              >
                <div className="flex items-center justify-between">
                  <span>{result.label}</span>
                  <span className="tabular-nums">
                    {result.votes}표 ({result.percent}%)
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
