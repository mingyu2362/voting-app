"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { PollView } from "@/lib/actions/polls";
import { fetchPollAction, voteAction } from "./actions";

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
            ? "이미 이 설문에 투표했습니다."
            : "투표를 제출할 수 없습니다.",
        );
        return;
      }
      setPoll(result.poll);
    });
  }

  if (!poll.resultsVisible) {
    return (
      <div className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          {poll.choices.map((choice) => (
            <label
              key={choice.id}
              className="flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
            >
              <input
                type="radio"
                name="choice"
                value={choice.id}
                checked={selectedChoiceId === choice.id}
                onChange={() => setSelectedChoiceId(choice.id)}
              />
              {choice.label}
            </label>
          ))}
        </fieldset>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="button"
          onClick={handleVote}
          disabled={isPending}
          className="self-start rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {isPending ? "제출 중..." : "투표하기"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-zinc-500">총 {poll.totalVotes}표</p>
      <ul className="flex flex-col gap-2">
        {poll.results?.map((result) => (
          <li
            key={result.choiceId}
            className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800"
          >
            <span>{result.label}</span>
            <span className="tabular-nums">
              {result.votes}표 ({result.percent}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
