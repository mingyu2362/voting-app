import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
import { isOperatorSession } from "@/lib/actions/auth";

/** Reads the operator session cookie for the current request (Server Components only). */
export async function getOperatorSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

/** Whether the current request carries a valid, unexpired operator session. */
export async function isOperatorLoggedIn(): Promise<boolean> {
  return isOperatorSession(await getOperatorSessionToken());
}
