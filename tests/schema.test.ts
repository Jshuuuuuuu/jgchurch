import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync("supabase/migrations/001_initial_schema.sql", "utf8");
describe("database security contract", () => {
  it("enables RLS on sensitive tables", () => { for (const table of ["arc_entries","prayer_requests","members","audit_logs","public_rate_limits"]) expect(sql).toContain(`alter table public.${table} enable row level security`); });
  it("does not add identity columns to anonymous ARC submissions", () => { const definition = sql.match(/create table public\.arc_submissions \(([\s\S]*?)\);/)?.[1] ?? ""; expect(definition).not.toMatch(/email|name|member_id|user_id|ip_address/i); });
  it("restricts prayer requests and follow-ups to Super Admin in the follow-up migration", () => { const migration = readFileSync("supabase/migrations/002_super_admin_prayer_access.sql", "utf8"); for (const [policy, table] of [["prayer_manage", "prayer_requests"], ["followup_manage", "prayer_followups"]]) { expect(migration).toContain(`alter policy ${policy} on public.${table}`); } expect(migration.match(/public.has_role\(array\['super_admin'\]\)/g)).toHaveLength(4); expect(migration).not.toContain("'prayer_team'"); });
});
