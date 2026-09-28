import { notFound } from "next/navigation";
import { fetchPollAction } from "./actions";
import { PollDetail } from "./PollDetail";

export default async function PollDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
      <h1 className="text-2xl font-semibold">{result.poll.question}</h1>
      <PollDetail pollId={pollId} initialPoll={result.poll} />
    </div>
  );
}
