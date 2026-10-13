"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form-controls";
import { Turnstile } from "@/components/public/turnstile";
import type { EventType } from "@/lib/events";

export function EventRegistrationForm({ token, eventType, siteKey }: {
  token: string; eventType: EventType; siteKey: string;
}) {
  const startedAt = useRef(0);
  const requestKey = useRef("");
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const [transport, setTransport] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  const midweek = eventType === "midweek_prayer";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    const form = new FormData(e.currentTarget);
    requestKey.current ||= crypto.randomUUID();
    try {
      const response = await fetch("/api/public/registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventToken: token, requestKey: requestKey.current,
          name: form.get("name"), contact: form.get("contact"),
          transport: midweek ? transport : null, consent: form.get("consent") === "on",
          startedAt: startedAt.current, website: form.get("website"), turnstileToken,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Registration could not be saved. Please try again.");
        setCaptchaAttempt((value) => value + 1);
        return;
      }
      setComplete(true);
    } catch {
      setCaptchaAttempt((value) => value + 1);
      setError("We could not confirm your registration. Check your connection and retry this form; the same registration will not be added twice.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  if (complete) return <section role="status" className="rounded-xl border bg-secondary p-6">
    <h2 className="text-xl font-semibold">You’re on the registration list!</h2>
    <p className="mt-3">{midweek
      ? "Your intention to join Midweek Prayer has been recorded. This is advance registration, not an arrival check-in."
      : "Your intention to join has been recorded. An organizer will contact you and arrange your addition to the logistics group chat manually; the website does not add you automatically."}</p>
    {midweek && transport === "pickup" && <p className="mt-3">Pickup is at 6:00 PM Philippine time on the event date unless an organizer communicates a change. Please coordinate your pickup location with the organizer.</p>}
  </section>;

  return <form onSubmit={submit} onFocusCapture={() => { startedAt.current ||= Date.now(); }}
    onPointerDown={() => { startedAt.current ||= Date.now(); }} className="space-y-5 rounded-xl border bg-card p-6">
    <h2 className="text-xl font-semibold">{midweek ? "I'm coming" : "I want to join"}</h2>
    <p className="text-sm text-muted-foreground">Register your intention to attend. This does not mark you as present at the event.</p>
    <input name="website" className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
    <div><Label htmlFor="registration-name">Name</Label><Input id="registration-name" name="name" required minLength={2} maxLength={120} autoComplete="name" className="mt-2" /></div>
    <div><Label htmlFor="registration-contact">Phone number or Facebook Messenger {midweek ? "(optional)" : "(required)"}</Label>
      <Input id="registration-contact" name="contact" required={!midweek} maxLength={255} className="mt-2" placeholder="Phone number, Messenger name, or profile link" />
      <p className="mt-2 text-xs text-muted-foreground">For event communication{!midweek && " and the logistics group chat"}. Never enter a password.</p>
    </div>
    {midweek && <div><Label htmlFor="transport">Way of going</Label>
      <Select id="transport" required value={transport} onChange={(e) => setTransport(e.target.value)} className="mt-2">
        <option value="">Choose transportation</option><option value="own">By my own transportation</option><option value="pickup">I need pickup</option>
      </Select>
      {transport === "pickup" && <p className="mt-3 rounded-xl bg-secondary p-4 text-sm">Pickup: <strong>6:00 PM Philippine time</strong> on the event date. This time is fixed in the form; any change will be communicated personally. Coordinate your pickup location with the organizer. If you leave contact details blank, please contact the organizer yourself.</p>}
    </div>}
    <label className="flex items-start gap-3 text-sm"><input name="consent" type="checkbox" required className="mt-1" />
      <span>I agree that authorized event organizers (Super Admin and Ministry Leader accounts) may use my name and any contact details I provide to coordinate this event{!midweek && " and invite me to its logistics group chat, where my profile/contact details may be visible to other participants"}. My registration is not anonymous and is stored separately from ARC feedback.</span>
    </label>
    <Turnstile siteKey={siteKey} onToken={setTurnstileToken} resetKey={captchaAttempt} />
    {siteKey && !turnstileToken && <p className="text-sm text-muted-foreground">Complete the bot verification to enable registration.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" disabled={pending || Boolean(siteKey && !turnstileToken)}>{pending ? "Saving…" : "Confirm registration"}</Button>
  </form>;
}
