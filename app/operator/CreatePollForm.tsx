"use client";

import { useActionState, useState } from "react";
import { createPollFormAction } from "./actions";

export function CreatePollForm() {
  const [state, action, pending] = useActionState(createPollFormAction, undefined);
  const [choiceCount, setChoiceCount] = useState(2);

  return (
    <form
      action={action}
      className="flex w-full max-w-lg flex-col gap-4 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800"
    >
      <h2 className="text-lg font-semibold">새 투표 만들기</h2>

      <div className="flex flex-col gap-2">
        <label htmlFor="question" className="text-sm font-medium">
          질문
        </label>
        <input
          id="question"
          name="question"
          type="text"
          required
          placeholder="예: 다음 회식 메뉴는?"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">선택지 (2개 이상)</span>
        {Array.from({ length: choiceCount }).map((_, index) => (
          <input
            key={index}
            name="choice"
            type="text"
            placeholder={`선택지 ${index + 1}`}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        ))}
        <button
          type="button"
          onClick={() => setChoiceCount((n) => n + 1)}
          className="self-start text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
        >
          + 선택지 추가
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="closesAt" className="text-sm font-medium">
          마감 시각 (선택, 비워두면 무기한)
        </label>
        <input
          id="closesAt"
          name="closesAt"
          type="datetime-local"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? "만드는 중..." : "투표 만들기"}
      </button>
    </form>
  );
}
