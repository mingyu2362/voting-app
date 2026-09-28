import Link from "next/link";
import { listPolls } from "@/lib/actions/polls";

export default async function PollsListPage() {
  const polls = await listPolls();

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-16 sm:px-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">설문 목록</h1>
        <Link
          href="/operator/login"
          className="text-sm text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          운영자 로그인
        </Link>
      </div>
      {polls.length === 0 && (
        <p className="text-sm text-zinc-500">아직 등록된 설문이 없습니다.</p>
      )}
      <ul className="flex flex-col gap-2">
        {polls.map((poll) => (
          <li
            key={poll.id}
            className="rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800"
          >
            <Link href={`/polls/${poll.id}`} className="text-sm font-medium underline">
              {poll.question}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
