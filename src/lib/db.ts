/*
 * Database access. One tagged-template function, `sql`, returns rows as objects.
 *   - Production / preview: Neon over HTTP (DATABASE_URL), which suits serverless functions.
 *   - Tests and local development without DATABASE_URL: an in-memory Postgres (PGlite) with the same schema.
 * Values are always passed as parameters; never build SQL by string concatenation.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Row = Record<string, unknown>;
export type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Row[]>;

// Kept on globalThis so that in `next dev` the route and page bundles share one in-memory database.
const g = globalThis as unknown as { __njSql?: Promise<Sql> };

export function schemaSql(): string {
  return readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8");
}

async function open(): Promise<Sql> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const client = neon(url);
    return (strings, ...values) => client.query(toText(strings), values) as Promise<Row[]>;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is not set");
  }
  // PGlite is a devDependency: it is only ever imported here, without DATABASE_URL, outside production.
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  await db.exec(schemaSql());
  return async (strings, ...values) => (await db.query(toText(strings), values as unknown[])).rows as Row[];
}

function toText(strings: TemplateStringsArray): string {
  let text = strings[0];
  for (let i = 1; i < strings.length; i++) text += `$${i}${strings[i]}`;
  return text;
}

export function getSql(): Promise<Sql> {
  return (g.__njSql ??= open());
}

/** Tests: start over with an empty in-memory database. */
export function resetDatabaseForTests(): void {
  g.__njSql = undefined;
}
