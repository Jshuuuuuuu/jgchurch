import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isSundayInPhilippines, latestSunday, validAttendanceDate } from "../lib/submission-policy";
import { arcSubmissionSchema, prayerRequestSchema } from "../lib/validation";
import { readSubmissionJson } from "../lib/submission-body";

describe("Philippine Sunday boundaries", () => {
  it("opens precisely at local Sunday midnight and closes at Monday midnight", () => {
    expect(isSundayInPhilippines(new Date("2026-10-17T15:59:59Z"))).toBe(false);
    expect(isSundayInPhilippines(new Date("2026-10-17T16:00:00Z"))).toBe(true);
    expect(isSundayInPhilippines(new Date("2026-10-18T15:59:59Z"))).toBe(true);
    expect(isSundayInPhilippines(new Date("2026-10-18T16:00:00Z"))).toBe(false);
  });
  it("selects the most recent local Sunday", () => {
    expect(latestSunday(new Date("2026-10-13T12:00:00Z"))).toBe("2026-10-11");
    expect(latestSunday(new Date("2026-10-17T16:00:00Z"))).toBe("2026-10-18");
  });
  it("allows past Sunday attendance corrections but not future or invalid dates", () => {
    const now = new Date("2026-10-13T12:00:00Z");
    expect(validAttendanceDate("2026-10-11", now)).toBe(true);
    for (const value of ["2026-10-12", "2026-10-18", "2026-02-30", "bad date"]) {
      expect(validAttendanceDate(value, now)).toBe(false);
    }
  });
});

describe("public request boundary", () => {
  it("rejects ARC and prayer requests without QR tokens", () => {
    expect(arcSubmissionSchema.safeParse({ eventToken: "", entries: [{ type: "affirmation", ministryAreaId: "00000000-0000-4000-8000-000000000001", content: "A long enough response" }], startedAt: Date.now() }).success).toBe(false);
    expect(prayerRequestSchema.safeParse({ eventToken: "", request: "A long enough request", category: "Family", visibility: "prayer_team", startedAt: Date.now() }).success).toBe(false);
  });
  it("parses bounded JSON and rejects malformed or oversized actual bodies", async () => {
    expect(await readSubmissionJson(new Request("https://test.invalid", { method: "POST", body: '{"test":true}' }))).toEqual({ test: true });
    await expect(readSubmissionJson(new Request("https://test.invalid", { method: "POST", body: "not json" }))).rejects.toThrow();
    await expect(readSubmissionJson(new Request("https://test.invalid", { method: "POST", body: JSON.stringify({ data: "x".repeat(33000) }) }))).rejects.toThrow("Body too large");
  });
});

describe("protected database contract", () => {
  const sql = readFileSync("supabase/migrations/004_submission_controls_attendance.sql", "utf8");
  it("denies browser submission RPC access including authenticated accounts", () => {
    for (const signature of ["submit_arc_reflection(text,jsonb)", "submit_prayer_request(text,text,boolean,text,text,text,text,boolean,boolean)", "register_for_event(text,uuid,text,text,text,boolean)", "check_public_rate_limit(text,text,integer,integer)"]) {
      expect(sql).toContain(`revoke all on function public.${signature} from public, anon, authenticated`);
      expect(sql).toContain(`grant execute on function public.${signature} to service_role`);
    }
    expect(sql).toContain("statement_timestamp() at time zone 'Asia/Manila'");
  });
  it("isolates attendance, authorizes writes and audits changes", () => {
    expect(sql).toContain("alter table public.sunday_attendance enable row level security");
    expect(sql).toContain("primary key (sunday_date, member_id)");
    expect(sql).toContain("public.has_role(array['super_admin','membership_admin'])");
    expect(sql).toContain("'attendance_recorded'");
    expect(sql).not.toMatch(/alter table public\.arc_(entries|submissions)/);
  });
});
