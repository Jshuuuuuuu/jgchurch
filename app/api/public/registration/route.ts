import { TURNSTILE_ACTIONS } from "@/lib/turnstile-config";
import { NextResponse } from "next/server";
import { registrationSchema, registrationProblem } from "@/lib/events";
import { getPublicEvent } from "@/lib/event-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readSubmissionJson } from "@/lib/submission-body";
import { rateLimit, verifyHumanDetailed } from "@/lib/security";

export async function POST(request: Request) {
  let input: unknown;
  try { input = await readSubmissionJson(request); } catch {
    return NextResponse.json({ error: "Invalid registration data." }, { status: 400 });
  }
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid registration" }, { status: 400 });
  const value = parsed.data;
  try {
    const human = await verifyHumanDetailed(value.startedAt, value.website, value.turnstileToken, TURNSTILE_ACTIONS.registration);
    if (!human.ok) return NextResponse.json({ error: human.error, reason: human.reason }, { status: human.status });
    if (!await rateLimit("registration")) return NextResponse.json({ error: "Too many registration attempts. Please try again later." }, { status: 429 });
    const event = await getPublicEvent(value.eventToken);
    if (!event) return NextResponse.json({ error: "This event link is inactive or expired. Ask the organizer for a current link." }, { status: 400 });
    const problem = registrationProblem(event.event_type, value);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    const db = createAdminClient();
    const { error } = await db.rpc("register_for_event", {
      p_token: value.eventToken, p_request_key: value.requestKey,
      p_name: value.name, p_contact: value.contact || null,
      p_transport: value.transport, p_consent: value.consent,
    });
    if (error?.code === "22023") return NextResponse.json({ error: "Registration was not accepted. Check the event link and your details, then try again." }, { status: 400 });
    if (error) throw new Error("Registration unavailable");
    return NextResponse.json({ ok: true });
  } catch {
    // Do not log participant details, contact information, or event tokens.
    return NextResponse.json({ error: "Registration is temporarily unavailable. Please retry this form later." }, { status: 503 });
  }
}
