import { TURNSTILE_SITE_KEY } from "@/lib/turnstile-config";
import Link from "next/link";
import { PublicHeader } from "@/components/public/public-header";
import { EventRegistrationForm } from "@/components/public/event-registration-form";
import { getPublicEvent } from "@/lib/event-server";
import { EVENT_LABELS, eventDuration, type PublicEvent } from "@/lib/events";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Event registration", robots: { index: false, follow: false } };

export default async function EventRegistration({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let event: PublicEvent | null = null;
  let unavailable = false;
  try { event = await getPublicEvent(token); } catch { unavailable = true; }

  return <><PublicHeader /><main className="page-shell max-w-2xl py-10 sm:py-14">
    {!event ? <section role="alert" className="rounded-xl border bg-card p-6">
      <h1 className="text-2xl font-semibold">{unavailable ? "Event information is unavailable" : "This event link is inactive or expired"}</h1>
      <p className="mt-3">{unavailable ? "Please try again later or contact the organizer." : "Ask the organizer for a current QR code. No registration has been saved."}</p>
    </section> : <>
      <section className="public-intro mb-8 space-y-3">
        <p className="eyebrow">{EVENT_LABELS[event.event_type]}</p>
        <h1 className="font-serif text-4xl font-semibold">{event.name}</h1>
        {event.location && <p className="text-lg"><strong>Location:</strong> {event.location}</p>}
        {event.starts_at && <p><strong>Date and start:</strong> {formatDate(event.starts_at)} (Philippine time)</p>}
        {event.ends_at && <p><strong>Ends:</strong> {formatDate(event.ends_at)} (Philippine time)</p>}
        {event.starts_at && event.ends_at && <p><strong>Duration:</strong> {eventDuration(event.starts_at, event.ends_at)}</p>}
        {event.event_type === "midweek_prayer" && <p className="rounded-xl bg-secondary p-4"><strong>Pickup: 6:00 PM</strong> Philippine time on the event date. Any change will be communicated by the organizer. This is the pickup time, not the prayer start time.</p>}
      </section>
      {event.event_type === "sunday_service"
        ? <div className="flex flex-wrap gap-5"><Link className="font-semibold text-primary underline" href={`/arc?token=${encodeURIComponent(token)}`}>ARC Reflection</Link><Link className="font-semibold text-primary underline" href={`/prayer?token=${encodeURIComponent(token)}`}>Prayer Request</Link></div>
        : <EventRegistrationForm token={token} eventType={event.event_type} siteKey={TURNSTILE_SITE_KEY} />}
    </>}
  </main></>;
}
