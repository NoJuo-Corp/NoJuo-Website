/* Applies db/schema.sql to DATABASE_URL (Neon). Idempotent: run it after every deploy that changes the schema. */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (copy it from the Vercel project's environment variables).");
  process.exit(1);
}
const client = neon(url);
const statements = readFileSync("db/schema.sql", "utf8")
  .split(/;\s*(?:\n|$)/)
  .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
  .filter(Boolean);
for (const statement of statements) await client.query(statement);
console.log(`Applied ${statements.length} statements.`);
