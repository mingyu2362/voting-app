"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { login } from "@/lib/actions/auth";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  secureCookieOptions,
} from "@/lib/constants";

export type LoginFormState = { error?: string } | undefined;

/**
 * Thin "use server" wrapper: reads the submitted password, delegates to the
 * tested `login()` seam function, and (only here, not in the seam function
 * itself) owns setting the httpOnly session cookie and redirecting.
 */
export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const password = String(formData.get("password") ?? "");
  const result = await login(password);

  if (!result.ok) {
    return { error: "비밀번호가 올바르지 않습니다." };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE_NAME,
    result.token,
    secureCookieOptions(SESSION_MAX_AGE_SECONDS),
  );

  redirect("/operator");
}
