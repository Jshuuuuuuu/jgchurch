import { RecordControl } from "@/components/admin/record-control";
import Link from "next/link";
import { PageHeading } from "@/components/admin/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventForm } from "@/components/admin/event-form";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { EVENT_LABELS, type EventType } from "@/lib/events";
import { formatDate } from "@/lib/utils";

interface EventRow {
  id: string; active: boolean; name: string; event_type: EventType; location: string | null; starts_at: string | null;
  arc_submissions: { count: number }[]; prayer_requests: { count: number }[];
  event_registrations: { count: number }[];
}

export default async function Events() {
  const admin = await requireAdmin(["super_admin", "ministry_leader"]);
  const db = await createClient();
  const { data, error } = await db.from("events").select("id,active,name,event_type,location,starts_at,arc_submissions(count),prayer_requests(count),event_registrations(count)").is("deleted_at", null).order("created_at", { ascending: false });
  return <>
    <PageHeading eyebrow="Participation" title="Events" description="Choose a QR flow: Sunday Service feedback, Midweek Prayer registration, or Extracurricular registration." />
    {error ? <p role="alert" className="rounded-xl border p-5">Events could not be loaded. Apply migration 003 in Supabase if you have not done so, then refresh.</p> :
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card><CardHeader><CardTitle>New event</CardTitle></CardHeader><CardContent><EventForm /></CardContent></Card>
        <div className="space-y-3">{((data as unknown as EventRow[]) ?? []).map((event) => <Card key={event.id}><CardContent className="space-y-3 p-5">
          <Link className="font-semibold underline" href={`/admin/events/${event.id}`}>{event.name}</Link>
          <p className="text-sm">{EVENT_LABELS[event.event_type]}</p>
          {event.location && <p className="text-sm">{event.location}</p>}
          <p className="text-xs text-muted-foreground">{event.starts_at ? `${formatDate(event.starts_at)} (Philippine time)` : "Date not set"}</p>
          <p className="text-sm">{event.event_type === "sunday_service"
            ? `${event.arc_submissions?.[0]?.count ?? 0} ARC${admin.role === "super_admin" ? ` · ${event.prayer_requests?.[0]?.count ?? 0} prayers` : ""}`
            : `${event.event_registrations?.[0]?.count ?? 0} registrations`}</p>
          <p className="text-sm">{event.active ? "Active" : "Inactive"}</p><RecordControl key={String(event.active)} kind="event" id={event.id} operation={event.active ? "deactivate" : "activate"} />{admin.role === "super_admin" && <RecordControl kind="event" id={event.id} />}
          <Link href={`/admin/events/${event.id}`} className="text-sm font-semibold text-primary underline">Event details &amp; QR link</Link>
        </CardContent></Card>)}{!data?.length && <p className="text-sm text-muted-foreground">No events yet.</p>}</div>
      </div>}
  </>;
}
