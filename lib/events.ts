import { z } from "zod";

export const EVENT_TYPES = ["sunday_service", "midweek_prayer", "extracurricular"] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export const EVENT_LABELS: Record<EventType, string> = {
  sunday_service: "Sunday Service — ARC + Prayer",
  midweek_prayer: "Midweek Prayer — I'm coming",
  extracurricular: "Extracurricular — I want to join",
};

// datetime-local values are church wall-clock times, never the host's timezone.
export function manilaDateTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+08:00`);
  if (!Number.isFinite(date.getTime())) return null;
  const wallClock = new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16);
  return wallClock === value ? date.toISOString() : null;
}

const optionalDate = z.string().refine((value) => !value || Boolean(manilaDateTime(value)), "Enter a valid date and time");
export const eventSchema = z.object({
  name: z.string().trim().min(2).max(160),
  eventType: z.enum(EVENT_TYPES),
  location: z.string().trim().max(500),
  startsAt: optionalDate,
  endsAt: optionalDate,
  expiresAt: optionalDate,
}).superRefine((value, ctx) => {
  if (value.eventType !== "sunday_service") {
    if (!value.location) ctx.addIssue({ code: "custom", path: ["location"], message: "Enter the event location" });
    if (!value.startsAt) ctx.addIssue({ code: "custom", path: ["startsAt"], message: "Enter the event date and start time" });
  }
  if (value.eventType === "extracurricular" && !value.endsAt) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "Enter the end time so attendees can see the duration" });
  }
  if (value.endsAt && (!value.startsAt || value.endsAt <= value.startsAt)) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "The end must be after the start" });
  }
});

export const registrationSchema = z.object({
  eventToken: z.string().min(24).max(160),
  requestKey: z.string().uuid(),
  name: z.string().trim().min(2, "Enter your name (at least 2 characters)").max(120),
  contact: z.string().trim().max(255).default(""),
  transport: z.enum(["own", "pickup"]).nullable().default(null),
  consent: z.literal(true, { errorMap: () => ({ message: "Please agree to the registration and communication notice" }) }),
  startedAt: z.number().int().positive(),
  website: z.string().max(0).default(""),
  turnstileToken: z.string().optional(),
});

export interface PublicEvent {
  name: string;
  event_type: EventType;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
}

export function registrationProblem(eventType: EventType, value: { contact: string; transport: string | null }) {
  if (eventType === "sunday_service") return "This event uses ARC and Prayer, not attendance registration.";
  if (eventType === "midweek_prayer" && !["own", "pickup"].includes(value.transport ?? "")) return "Choose your transportation.";
  if (eventType === "extracurricular" && !value.contact.trim()) return "Enter a phone number or Facebook Messenger contact for logistics.";
  if (eventType === "extracurricular" && value.transport !== null) return "Transportation choices are only available for Midweek Prayer.";
  return null;
}

export function eventDuration(start: string, end: string) {
  const minutes = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return [hours ? `${hours} hour${hours === 1 ? "" : "s"}` : "", remainder ? `${remainder} minute${remainder === 1 ? "" : "s"}` : ""].filter(Boolean).join(" ");
}
