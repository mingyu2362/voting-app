import { neon } from "@neondatabase/serverless";

// Tests truncate every table they touch (see tests/helpers/db.ts) before and
// after each run, so they must never point at the real DATABASE_URL — doing
// so would wipe real Poll/Choice/Vote data. TEST_DATABASE_URL must name a
// separate Neon branch reserved for tests; there is no fallback to
// DATABASE_URL, on purpose.
const connectionString =
  process.env.NODE_ENV === "test"
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    process.env.NODE_ENV === "test"
      ? "TEST_DATABASE_URL is not set. Create a separate Neon branch for tests and set TEST_DATABASE_URL in .env.local — tests must never run against the real DATABASE_URL."
      : "DATABASE_URL is not set. Check .env.local.",
  );
}

export const sql = neon(connectionString);
