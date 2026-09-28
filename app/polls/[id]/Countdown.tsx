"use client";

import { useEffect, useState } from "react";

// Ticket 04: client-side, local-clock-driven countdown, ticking every 1s,
// deliberately independent of PollDetail's 3-5s server results polling (see
// .scratch/voting-app-deadline/issues/04-countdown.md). Excluded from
// automated tests per the spec's Testing Decisions — UI-only, manually
// verified, same as the existing results-polling behavior.

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const clock = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return days > 0 ? `${days}일 ${clock}` : clock;
}

/** Renders a live "마감까지 남은 시간" countdown for a poll's `closesAt`.
 * Caller is responsible for only rendering this when `closesAt` is set and
 * the poll isn't already closed (see PollDetail) — this component itself
 * also falls back to a "마감되었습니다" message if the countdown reaches
 * zero while the page is left open, ahead of the next results poll. */
export function Countdown({ closesAt }: { closesAt: string }) {
  const target = new Date(closesAt).getTime();
  // Starts null so the server-rendered markup and the first client render
  // match exactly (avoids a hydration mismatch from Date.now() differing
  // between the two passes) — the real value is filled in by the effect
  // below, which only runs on the client.
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    function tick() {
      setRemainingMs(target - Date.now());
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [target]);

  if (remainingMs === null) {
    return (
      <p className="text-sm text-zinc-500" aria-live="polite">
        &nbsp;
      </p>
    );
  }

  return (
    <p className="text-sm text-zinc-500" aria-live="polite">
      {remainingMs > 0 ? `마감까지 남은 시간: ${formatRemaining(remainingMs)}` : "마감되었습니다"}
    </p>
  );
}
