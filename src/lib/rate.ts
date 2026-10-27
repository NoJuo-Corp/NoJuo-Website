/* Fixed-window rate limiting in the database (serverless functions share no memory). */
import { getSql } from "./db";

export async function hit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; retryAfter: number }> {
  const sql = await getSql();
  const now = Date.now();
  const start = new Date(Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000);
  const rows = await sql`
    INSERT INTO rate_limits (key, window_start, count) VALUES (${key}, ${start.toISOString()}, 1)
    ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
    RETURNING count`;
  if (Math.random() < 0.02) await sql`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`;
  const count = Number(rows[0].count);
  return { allowed: count <= limit, retryAfter: Math.max(1, Math.ceil((start.getTime() + windowSeconds * 1000 - now) / 1000)) };
}
