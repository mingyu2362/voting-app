import type { PollResult } from "@/lib/actions/polls";

// Ticket 06: plain CSS bars, no chart library — added alongside the existing
// votes/percent numbers (never replacing them, see
// .scratch/voting-app-deadline/issues/06-results-bar-chart.md). A single
// magnitude series per choice, so one neutral fill color is enough (no
// categorical color coding needed — see the dataviz skill's color-by-job
// rule); the existing numeric text next to each bar is the direct label, so
// bar length alone never has to carry the value. Renders sanely with 0 total
// votes: `computePercent` already returns 0 (never NaN) in that case, so
// every bar is just an empty (0-width) track — no special-casing needed here.
export function ResultsBarChart({ results }: { results: PollResult[] }) {
  return (
    <div className="flex flex-col gap-2">
      {results.map((result) => (
        <div key={result.choiceId} className="flex items-center gap-2">
          <span
            className="w-16 shrink-0 truncate text-xs text-zinc-500 dark:text-zinc-400"
            title={result.label}
          >
            {result.label}
          </span>
          <div
            role="img"
            aria-label={`${result.label}: ${result.percent}%`}
            className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
          >
            <div
              className="h-full rounded-full bg-foreground transition-[width]"
              style={{ width: `${result.percent}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
