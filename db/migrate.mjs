// Tiny migration runner: applies db/migrations/*.sql (in filename order) to the
// database pointed at by DATABASE_URL. No migration framework/ORM is installed
// (see .scratch/voting-app/issues/01-foundation-schema-test-harness.md) — this
// project has exactly one real Neon Postgres branch, so "migrating" just means
// running the SQL against it once. Safe to re-run: every statement is
// CREATE TABLE/INDEX IF NOT EXISTS.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local"), quiet: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set (checked .env.local).");
  process.exit(1);
}

const sql = neon(connectionString);
const migrationsDir = path.join(__dirname, "migrations");
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

for (const file of files) {
  const fullPath = path.join(migrationsDir, file);
  const contents = readFileSync(fullPath, "utf8");
  console.log(`Applying ${file}...`);
  // The Neon HTTP driver executes one statement per call, so split the file
  // on statement-terminating semicolons (fine here: no semicolons appear
  // inside string literals in these migrations).
  const statements = contents
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await sql.query(statement);
  }
}

console.log(`Done. Applied ${files.length} migration file(s).`);
