import Link from "next/link";
import { listPolls } from "@/lib/actions/polls";

function PollListGroup({ polls }: { polls: { id: number; question: string }[] }) {
  return (
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
  );
}

export default async function PollsListPage() {
  // listPolls() already returns open polls before 마감(closed) ones
  // (sortPollsByStatus, ticket 05); this page just needs to render the two
  // groups under separate headings so the split is visible.
  const polls = await listPolls();
  const openPolls = polls.filter((poll) => !poll.isClosed);
  const closedPolls = polls.filter((poll) => poll.isClosed);

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-16 sm:px-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">투표 목록</h1>
        <Link
          href="/operator/login"
          className="text-sm text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          운영자 로그인
        </Link>
      </div>
      {polls.length === 0 && (
        <p className="text-sm text-zinc-500">아직 등록된 투표가 없습니다.</p>
      )}
      {openPolls.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-zinc-500">진행 중</h2>
          <PollListGroup polls={openPolls} />
        </div>
      )}
      {closedPolls.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-zinc-500">마감됨</h2>
          <PollListGroup polls={closedPolls} />
        </div>
      )}
    </div>
  );
}
