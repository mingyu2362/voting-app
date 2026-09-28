import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-6 text-center dark:bg-black">
      <h1 className="text-3xl font-semibold">투표 앱</h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        운영자가 만든 설문에 로그인 없이 투표하고, 투표 직후 실시간 결과를 확인하세요.
      </p>
      <div className="flex gap-4">
        <Link
          href="/polls"
          className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background"
        >
          설문 목록 보기
        </Link>
        <Link
          href="/operator/login"
          className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium dark:border-zinc-700"
        >
          운영자 로그인
        </Link>
      </div>
    </div>
  );
}
