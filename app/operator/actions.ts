"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { logout } from "@/lib/actions/auth";
import { createPoll, deletePoll, updatePollDeadline } from "@/lib/actions/polls";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
import { getOperatorSessionToken } from "@/lib/operator-session";

/** Parses a `<input type="datetime-local">` value ("" or "YYYY-MM-DDTHH:mm")
 * into a Date in the browser's local time, or null when left blank (마감
 * 시각 없음/무기한). `new Date()` treats a timezone-less date-time string as
 * local time, which matches what the datetime-local input represents. */
function parseClosesAt(value: FormDataEntryValue | null): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

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
  const closesAt = parseClosesAt(formData.get("closesAt"));

  const result = await createPoll(token, question, choices, closesAt);

  if (!result.ok) {
    if (result.error === "unauthorized") {
      redirect("/operator/login");
    }
    return { error: result.message };
  }

  revalidatePath("/operator");
  return undefined;
}

/** Shared by `updatePollDeadlineFormAction` and `closePollNowFormAction`:
 * both are "set this poll's closes_at to X" and only differ in what X is.
 * Delegates to the tested `updatePollDeadline()` seam function and
 * revalidates the dashboard. */
async function submitDeadlineUpdate(pollId: number, closesAt: Date | null): Promise<void> {
  const token = await getOperatorSessionToken();
  const result = await updatePollDeadline(token, pollId, closesAt);

  if (!result.ok && result.error === "unauthorized") {
    redirect("/operator/login");
  }

  revalidatePath("/operator");
}

/** Thin wrapper: reads form fields and delegates to `submitDeadlineUpdate`.
 * An empty `closesAt` input clears the deadline back to null (무기한) — see
 * 마감 in CONTEXT.md. */
export async function updatePollDeadlineFormAction(formData: FormData): Promise<void> {
  const pollId = Number(formData.get("pollId"));
  const closesAt = parseClosesAt(formData.get("closesAt"));
  await submitDeadlineUpdate(pollId, closesAt);
}

/** Thin wrapper for "지금 마감하기" (close now): `submitDeadlineUpdate` with
 * `closesAt = new Date()` — no separate close/open state exists, per
 * docs/adr/0004. */
export async function closePollNowFormAction(formData: FormData): Promise<void> {
  const pollId = Number(formData.get("pollId"));
  await submitDeadlineUpdate(pollId, new Date());
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
