"use client";

import { deletePollFormAction } from "./actions";

export function DeletePollButton({ pollId }: { pollId: number }) {
  return (
    <form
      action={deletePollFormAction}
      onSubmit={(event) => {
        if (!confirm("이 투표를 삭제할까요? 삭제하면 되돌릴 수 없습니다.")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="pollId" value={pollId} />
      <button
        type="submit"
        className="text-sm font-medium text-red-600 underline dark:text-red-400"
      >
        삭제
      </button>
    </form>
  );
}
