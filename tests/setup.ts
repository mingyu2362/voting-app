// Vitest doesn't load .env.local the way `next dev`/`next build` do, so we load
// it here explicitly for the test process. See lib/db.ts for how
// TEST_DATABASE_URL vs. DATABASE_URL selection works in tests.
import dotenv from "dotenv";
import path from "node:path";
import { afterAll } from "vitest";

dotenv.config({ path: path.resolve(__dirname, "..", ".env.local"), quiet: true });

// Belt-and-suspenders cleanup: individual test files truncate in beforeEach
// (so every test starts from a clean slate), but nothing otherwise clears
// rows left behind by the *last* test in a file. Since there's no separate
// Neon test branch (see lib/db.ts), this file runs against the one real
// database, so this hook makes sure a test run never leaves junk polls
// behind. Registered here (a setupFile) so every test file gets it for free.
//
// The `truncateAll` import is dynamic (rather than a static top-level
// import) so it's only evaluated after dotenv.config() above has already run
// — lib/db.ts reads DATABASE_URL/TEST_DATABASE_URL at module-load time, and
// static imports would otherwise be hoisted ahead of the dotenv.config() call.
//
// Skipped entirely when TEST_DATABASE_URL isn't configured: this setupFile
// runs for *every* test file, including DB-free pure-function ones (e.g.
// tests/lib/*.test.ts), which never touch the database and shouldn't be
// failed by a cleanup hook for a connection they never opened. A file that
// does use the DB already fails fast at its own top-level `lib/db.ts`
// import in that case, so this guard doesn't hide a real problem there.
afterAll(async () => {
  if (!process.env.TEST_DATABASE_URL) return;
  const { truncateAll } = await import("./helpers/db");
  await truncateAll();
});
