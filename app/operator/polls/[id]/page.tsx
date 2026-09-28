import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isOperatorLoggedIn } from "@/lib/operator-session";
import { fetchPollAction } from "@/app/polls/[id]/actions";
import { PollDetail } from "@/app/polls/[id]/PollDetail";

export default async function OperatorPollResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isOperatorLoggedIn())) {
    redirect("/operator/login");
  }

  const { id } = await params;
  const pollId = Number(id);
  if (!Number.isInteger(pollId)) {
    notFound();
  }

  const result = await fetchPollAction(pollId);
  if (!result.ok) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-16 sm:px-16">
      <Link href="/operator" className="text-sm underline">
        ← 대시보드로
      </Link>
      <h1 className="text-2xl font-semibold">{result.poll.question}</h1>
      <p className="text-sm text-zinc-500">
        운영자는 투표 여부와 상관없이 실시간 결과를 볼 수 있습니다.
      </p>
      <PollDetail pollId={pollId} initialPoll={result.poll} />
    </div>
  );
}
