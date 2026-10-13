import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { eventSchema, manilaDateTime, eventDuration, registrationSchema, registrationProblem } from "../lib/events";

const event = { name: "Test event", eventType: "sunday_service", location: "", startsAt: "", endsAt: "", expiresAt: "" };
const registration = { eventToken: "a".repeat(32), requestKey: "00000000-0000-4000-8000-000000000001", name: "Test Person", contact: "", transport: "own", consent: true, startedAt: Date.now() - 5000 };

describe("event creation", () => {
  it("preserves Sunday events without location or schedule", () => expect(eventSchema.safeParse(event).success).toBe(true));
  it("requires location and start for registration events", () => {
    for (const eventType of ["midweek_prayer", "extracurricular"]) expect(eventSchema.safeParse({ ...event, eventType }).success).toBe(false);
  });
  it("requires an end for extracurricular duration", () => {
    const value = { ...event, eventType: "extracurricular", location: "Church", startsAt: "2026-10-21T19:00" };
    expect(eventSchema.safeParse(value).success).toBe(false);
    expect(eventSchema.safeParse({ ...value, endsAt: "2026-10-21T21:30" }).success).toBe(true);
    expect(eventSchema.safeParse({ ...value, endsAt: "2026-10-21T18:00" }).success).toBe(false);
  });
  it("keeps QR expiry separate from duration", () => expect(eventSchema.safeParse({ ...event, expiresAt: "2026-10-21T18:00" }).success).toBe(true));
  it("uses Philippine time regardless of server timezone", () => {
    expect(manilaDateTime("2026-10-21T18:00")).toBe("2026-10-21T10:00:00.000Z");
    expect(manilaDateTime("2026-02-30T18:00")).toBeNull();
    expect(manilaDateTime("bad date")).toBeNull();
    expect(eventDuration("2026-10-21T10:00:00Z", "2026-10-21T12:30:00Z")).toBe("2 hours 30 minutes");
  });
});

describe("registration", () => {
  it("accepts optional contact for midweek, including pickup", () => {
    expect(registrationSchema.safeParse(registration).success).toBe(true);
    expect(registrationProblem("midweek_prayer", { contact: "", transport: "pickup" })).toBeNull();
    expect(registrationProblem("midweek_prayer", { contact: "", transport: null })).not.toBeNull();
  });
  it("requires a logistics contact for extracurricular events", () => {
    expect(registrationProblem("extracurricular", { contact: "", transport: null })).not.toBeNull();
    expect(registrationProblem("extracurricular", { contact: "Messenger Test", transport: null })).toBeNull();
    expect(registrationProblem("extracurricular", { contact: "Messenger Test", transport: "pickup" })).not.toBeNull();
  });
  it("rejects Sunday attendance, missing consent, whitespace name, and invalid retry key", () => {
    expect(registrationProblem("sunday_service", registration)).not.toBeNull();
    for (const change of [{ consent: false }, { name: "  " }, { requestKey: "invalid" }, { eventToken: "short" }, { website: "spam" }]) {
      expect(registrationSchema.safeParse({ ...registration, ...change }).success).toBe(false);
    }
  });
});

describe("registration migration contract", () => {
  const sql = readFileSync("supabase/migrations/003_event_registration.sql", "utf8");
  it("restricts named attendees to event organizers", () => {
    expect(sql).toContain("alter table public.event_registrations enable row level security");
    expect(sql).toContain("revoke all on public.event_registrations from anon, authenticated");
    expect(sql).toContain("using (public.has_role(array['super_admin', 'ministry_leader']))");
  });
  it("preserves ARC anonymity and defaults existing events to Sunday", () => {
    expect(sql).toContain("default 'sunday_service'");
    expect(sql).not.toMatch(/alter table public\.arc_(entries|submissions)/);
  });
  it("makes retries idempotent and rejects inactive/expired event tokens", () => {
    expect(sql).toContain("request_key uuid not null unique");
    expect(sql).toContain("on conflict(request_key) do nothing");
    expect(sql).toContain("q.active and e.active");
    expect(sql).toContain("q.expires_at > now()");
  });
});
