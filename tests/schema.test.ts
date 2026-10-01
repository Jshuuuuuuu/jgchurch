import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync("supabase/migrations/001_initial_schema.sql", "utf8");
describe("database security contract", () => {
  it("enables RLS on sensitive tables", () => { for (const table of ["arc_entries","prayer_requests","members","audit_logs","public_rate_limits"]) expect(sql).toContain(`alter table public.${table} enable row level security`); });
  it("does not add identity columns to anonymous ARC submissions", () => { const definition = sql.match(/create table public\.arc_submissions \(([\s\S]*?)\);/)?.[1] ?? ""; expect(definition).not.toMatch(/email|name|member_id|user_id|ip_address/i); });
  it("restricts prayer data to prayer care roles", () => expect(sql).toContain("public.has_role(array['super_admin','prayer_team'])"));
});
