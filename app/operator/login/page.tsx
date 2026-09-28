import Link from "next/link";
import { redirect } from "next/navigation";
import { isOperatorLoggedIn } from "@/lib/operator-session";
import { LoginForm } from "./LoginForm";

export default async function OperatorLoginPage() {
  if (await isOperatorLoggedIn()) {
    redirect("/operator");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24">
      <h1 className="text-2xl font-semibold">운영자 로그인</h1>
      <LoginForm />
      <Link
        href="/"
        className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium dark:border-zinc-700"
      >
        처음으로 돌아가기
      </Link>
    </div>
  );
}
