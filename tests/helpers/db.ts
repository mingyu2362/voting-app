import { sql } from "@/lib/db";

/**
 * Truncates every table the voting-app test suite touches. Call this before
 * (or after) each test so tests don't leak Poll/Choice/Vote rows into the one
 * real Neon database we have access to (see the comment in lib/db.ts about
 * why there's no separate Neon test branch).
 */
export async function truncateAll() {
  await sql.query(
    "TRUNCATE TABLE votes, choices, polls RESTART IDENTITY CASCADE",
  );
}
