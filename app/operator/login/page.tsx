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
    </div>
  );
}
