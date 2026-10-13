import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/admin/page-heading";
import { EVENT_LABELS, eventDuration, type EventType } from "@/lib/events";
import { formatDate } from "@/lib/utils";

export default async function EventDetails({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin(["super_admin", "ministry_leader"]);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const db = await createClient();
  const { data: event, error } = await db.from("events").select("id,name,event_type,location,starts_at,ends_at,active").eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) return <p role="alert">Event details could not be loaded. Check that migration 003 has been applied.</p>;
  if (!event) notFound();
  const { data: tokens, error: tokenError } = await db.from("qr_tokens").select("id,token,active,expires_at").eq("event_id", id).is("deleted_at", null).order("created_at", { ascending: false });
  const registrationEvent = event.event_type !== "sunday_service";
  const registrations = registrationEvent ? await db.from("event_registrations")
    .select("id,name,contact,transport,created_at", { count: "exact" }).eq("event_id", id).order("created_at", { ascending: false }).limit(500) : null;
  return <>
    <PageHeading eyebrow={EVENT_LABELS[event.event_type as EventType]} title={event.name} description="Event links are for participants. Attendee details are restricted to Super Admin and Ministry Leader accounts." />
    <Link className="text-sm text-primary underline" href="/admin/events">Back to events</Link>
    <section className="my-6 space-y-3 rounded-xl border bg-card p-5">
      {event.location && <p><strong>Location:</strong> {event.location}</p>}
      {event.starts_at && <p><strong>Starts:</strong> {formatDate(event.starts_at)} (Philippine time)</p>}
      {event.ends_at && <p><strong>Ends:</strong> {formatDate(event.ends_at)} (Philippine time)</p>}
      {event.starts_at && event.ends_at && <p><strong>Duration:</strong> {eventDuration(event.starts_at, event.ends_at)}</p>}
      <p>{event.active ? "Active event" : "Inactive event"}</p>
      {event.event_type === "midweek_prayer" && <p>Pickup: <strong>6:00 PM Philippine time</strong> on the event date. Communicate any changes personally.</p>}
    </section>
    <section className="mb-6 space-y-4 rounded-xl border bg-card p-5">
      <h2 className="text-xl font-semibold">QR codes and participant links</h2>
      {tokenError && <p role="alert">QR links could not be loaded.</p>}
      {!tokenError && !tokens?.length && <p>No QR token was found for this event.</p>}
      {tokens?.map((qr) => <div key={qr.id} className="space-y-2">
        <p className="text-sm">{qr.active ? "Active token" : "Inactive token"} · {qr.expires_at ? `Expires ${formatDate(qr.expires_at)}` : "No expiry"}</p>
        <div className="flex flex-wrap gap-4 text-sm text-primary underline">
          <Link href={`/?token=${encodeURIComponent(qr.token)}`} target="_blank" rel="noopener noreferrer">Open participant link</Link>
          <a href={`/api/admin/qr/${qr.id}?download=1`}>Download QR PNG</a>
        </div>
      </div>)}
    </section>
    {registrationEvent && <section className="rounded-xl border bg-card p-5">
      <h2 className="text-xl font-semibold">Advance registrations{!registrations?.error && ` (${registrations?.count ?? 0})`}</h2>
      <p className="mt-2 text-sm text-muted-foreground">These people intend to join; this is not an arrival check-in list. Contact participants personally for pickup arrangements or group-chat invitations. Nothing is sent automatically.</p>
      {registrations?.error ? <p role="alert" className="mt-4">The attendee list could not be loaded.</p> : <>
        {(registrations?.count ?? 0) > 500 && <p className="mt-3 text-sm">Showing the latest 500 registrations.</p>}
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">Name</th><th className="p-3">Contact / Messenger</th>{event.event_type === "midweek_prayer" && <th className="p-3">Transportation</th>}<th className="p-3">Registered (PH time)</th></tr></thead>
          <tbody>{registrations?.data?.map((row) => <tr key={row.id} className="border-b"><td className="p-3">{row.name}</td><td className="break-all p-3">{row.contact || "Not provided"}</td>{event.event_type === "midweek_prayer" && <td className="p-3">{row.transport === "pickup" ? "Pickup — 6 PM (unless communicated otherwise)" : "Own transportation"}</td>}<td className="p-3">{formatDate(row.created_at)}</td></tr>)}</tbody>
        </table></div>
        {!registrations?.data?.length && <p className="mt-4 text-sm">No registrations yet.</p>}
      </>}
    </section>}
  </>;
}
