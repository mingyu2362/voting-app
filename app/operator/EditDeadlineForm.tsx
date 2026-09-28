"use client";

import { updatePollDeadlineFormAction, closePollNowFormAction } from "./actions";

/** Formats an ISO closesAt string into the value a
 * `<input type="datetime-local">` expects ("YYYY-MM-DDTHH:mm"), in the
 * browser's local time — or "" (empty/무기한) when there is none. */
function toLocalInputValue(closesAt: string | null): string {
  if (!closesAt) return "";
  const date = new Date(closesAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Ticket 02: lets an Operator set/change/clear a Poll's closes_at, or close
 * it immediately ("지금 마감하기"). Question/choices stay immutable — this is
 * the one field editable after creation (see 마감 in CONTEXT.md). */
export function EditDeadlineForm({
  pollId,
  closesAt,
  isClosed,
}: {
  pollId: number;
  closesAt: string | null;
  isClosed: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      {isClosed && (
        <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
          마감됨
        </span>
      )}
      <form action={updatePollDeadlineFormAction} className="flex items-center gap-2">
        <input type="hidden" name="pollId" value={pollId} />
        <label htmlFor={`closesAt-${pollId}`} className="text-zinc-500">
          마감 시각
        </label>
        <input
          id={`closesAt-${pollId}`}
          name="closesAt"
          type="datetime-local"
          defaultValue={toLocalInputValue(closesAt)}
          className="rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button type="submit" className="font-medium underline">
          저장
        </button>
      </form>
      <form action={closePollNowFormAction}>
        <input type="hidden" name="pollId" value={pollId} />
        <button
          type="submit"
          disabled={isClosed}
          className="font-medium text-red-600 underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400"
        >
          지금 마감하기
        </button>
      </form>
    </div>
  );
}
