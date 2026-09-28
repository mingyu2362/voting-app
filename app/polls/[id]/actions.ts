"use server";

import { cookies } from "next/headers";
import { castVote, getPoll, type GetPollResult, type CastVoteResult } from "@/lib/actions/polls";
import {
  VOTER_TOKEN_COOKIE_NAME,
  VOTER_TOKEN_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
  secureCookieOptions,
} from "@/lib/constants";

/** Thin wrapper used both for the initial poll-detail render and for the
 * 3-5s results polling (ticket 07/08): reads the voter_token + operator
 * session cookies and delegates to the tested `getPoll()` seam function. */
export async function fetchPollAction(pollId: number): Promise<GetPollResult> {
  const cookieStore = await cookies();
  const voterToken = cookieStore.get(VOTER_TOKEN_COOKIE_NAME)?.value;
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return getPoll(pollId, voterToken, sessionToken);
}

/** Thin wrapper: reads the voter_token cookie (if any), delegates to the
 * tested `castVote()` seam function, and (only here) persists the returned
 * voter_token back into the cookie on success. */
export async function voteAction(
  pollId: number,
  choiceId: number,
): Promise<CastVoteResult> {
  const cookieStore = await cookies();
  const existingToken = cookieStore.get(VOTER_TOKEN_COOKIE_NAME)?.value;

  const result = await castVote(pollId, choiceId, existingToken);

  if (result.ok) {
    cookieStore.set(
      VOTER_TOKEN_COOKIE_NAME,
      result.voterToken,
      secureCookieOptions(VOTER_TOKEN_MAX_AGE_SECONDS),
    );
  }

  return result;
}
