import { redirect } from "next/navigation";
import Link from "next/link";
import { isOperatorLoggedIn } from "@/lib/operator-session";
import { listPolls } from "@/lib/actions/polls";
import { logoutAction } from "./actions";
import { CreatePollForm } from "./CreatePollForm";
import { DeletePollButton } from "./DeletePollButton";

export default async function OperatorDashboardPage() {
  if (!(await isOperatorLoggedIn())) {
    redirect("/operator/login");
  }

  const polls = await listPolls();

  return (
    <div className="flex flex-1 flex-col gap-8 px-6 py-16 sm:px-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">운영자 대시보드</h1>
        <div className="flex items-center gap-4">
          <Link
            href="/polls"
            className="text-sm text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            설문 목록 보기
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
            >
              로그아웃
            </button>
          </form>
        </div>
      </div>

      <CreatePollForm />

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">내가 만든 설문</h2>
        {polls.length === 0 && (
          <p className="text-sm text-zinc-500">아직 만든 설문이 없습니다.</p>
        )}
        <ul className="flex flex-col gap-2">
          {polls.map((poll) => (
            <li
              key={poll.id}
              className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800"
            >
              <Link
                href={`/operator/polls/${poll.id}`}
                className="text-sm font-medium underline"
              >
                {poll.question}
              </Link>
              <DeletePollButton pollId={poll.id} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
