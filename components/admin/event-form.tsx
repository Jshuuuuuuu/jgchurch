"use client";
import { useActionState, useState } from "react";
import { createEvent } from "@/app/admin/actions";
import { EVENT_TYPES, EVENT_LABELS, type EventType } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form-controls";

export function EventForm() {
  const [eventType, setEventType] = useState<EventType>("sunday_service");
  const [state, action, pending] = useActionState(createEvent, { error: "" });
  return <form action={action} className="space-y-4">
    <div><Label htmlFor="event-type">Event / QR type</Label><Select id="event-type" name="eventType" value={eventType} onChange={(e) => setEventType(e.target.value as EventType)} className="mt-2">{EVENT_TYPES.map((type) => <option key={type} value={type}>{EVENT_LABELS[type]}</option>)}</Select></div>
    <div><Label htmlFor="event-name">Name</Label><Input id="event-name" name="name" required minLength={2} maxLength={160} className="mt-2" /></div>
    <div><Label htmlFor="event-location">Location {eventType === "sunday_service" && "(optional)"}</Label><Input id="event-location" name="location" required={eventType !== "sunday_service"} maxLength={500} className="mt-2" /></div>
    <p className="text-xs text-muted-foreground">All dates and times below use Philippine time (Asia/Manila).</p>
    <div><Label htmlFor="event-start">Event date and start time</Label><Input id="event-start" name="startsAt" type="datetime-local" required={eventType !== "sunday_service"} className="mt-2" /></div>
    <div><Label htmlFor="event-end">Event end {eventType !== "extracurricular" && "(optional)"}</Label><Input id="event-end" name="endsAt" type="datetime-local" required={eventType === "extracurricular"} className="mt-2" /></div>
    {eventType === "midweek_prayer" && <p className="rounded-xl bg-secondary p-4 text-sm">Pickup is fixed at <strong>6:00 PM</strong> on the event date. Communicate any exception personally. Set the prayer start time separately above.</p>}
    <div><Label htmlFor="event-expiry">QR expires (optional)</Label><Input id="event-expiry" name="expiresAt" type="datetime-local" className="mt-2" /><p className="mt-2 text-xs text-muted-foreground">Separate from the event end. Leave blank for no QR expiry.</p></div>
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    <Button disabled={pending}>{pending ? "Creating…" : "Create event & QR"}</Button>
  </form>;
}
