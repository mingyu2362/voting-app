"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { logout } from "@/lib/actions/auth";
import { createPoll, deletePoll } from "@/lib/actions/polls";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
import { getOperatorSessionToken } from "@/lib/operator-session";

/** Thin wrapper: delegates to the tested `logout()` seam function, then
 * clears the session cookie (the actual "log the browser out" side effect)
 * and redirects to the login page. */
export async function logoutAction(): Promise<void> {
  await logout();
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/operator/login");
}

export type CreatePollFormState = { error?: string } | undefined;

/** Thin wrapper: reads the operator session cookie + form fields, delegates
 * to the tested `createPoll()` seam function, and revalidates the dashboard
 * so the new poll shows up immediately. */
export async function createPollFormAction(
  _prevState: CreatePollFormState,
  formData: FormData,
): Promise<CreatePollFormState> {
  const token = await getOperatorSessionToken();
  const question = String(formData.get("question") ?? "");
  const choices = formData.getAll("choice").map(String);

  const result = await createPoll(token, question, choices);

  if (!result.ok) {
    if (result.error === "unauthorized") {
      redirect("/operator/login");
    }
    return { error: result.message };
  }

  revalidatePath("/operator");
  return undefined;
}

/** Thin wrapper: reads the operator session cookie, delegates to the tested
 * `deletePoll()` seam function, and revalidates the dashboard. Irreversible —
 * there is no confirmation/undo step beyond the browser's own button click. */
export async function deletePollFormAction(formData: FormData): Promise<void> {
  const token = await getOperatorSessionToken();
  const pollId = Number(formData.get("pollId"));

  const result = await deletePoll(token, pollId);

  if (!result.ok && result.error === "unauthorized") {
    redirect("/operator/login");
  }

  revalidatePath("/operator");
}
