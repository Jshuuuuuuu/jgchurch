import { TURNSTILE_ACTIONS } from "@/lib/turnstile-config";
import { NextResponse } from "next/server";
import { prayerRequestSchema } from "@/lib/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { submissionAccess } from "@/lib/submission-access";
import { rateLimit, verifyHumanDetailed } from "@/lib/security";
import { readSubmissionJson } from "@/lib/submission-body";

export async function POST(request: Request) {
  let input: unknown;
  try { input = await readSubmissionJson(request); } catch { return NextResponse.json({ error: "Invalid or oversized submission." }, { status: 400 }); }
  const parsed = prayerRequestSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid prayer request" }, { status: 400 });
  const value = parsed.data;
  try {
    const human = await verifyHumanDetailed(value.startedAt, value.website, value.turnstileToken, TURNSTILE_ACTIONS.prayer);
    if (!human.ok) return NextResponse.json({ error: human.error, reason: human.reason }, { status: human.status });
    if (!await rateLimit("prayer")) return NextResponse.json({ error: "Too many submissions. Please try again later." }, { status: 429 });
    const denied = await submissionAccess(value.eventToken);
    if (denied) return NextResponse.json({ error: denied }, { status: 403 });
    const db = createAdminClient();
    const { error } = await db.rpc("submit_prayer_request", {
      p_event_token: value.eventToken, p_name: value.anonymous ? null : value.name || null,
      p_is_anonymous: value.anonymous, p_request: value.request, p_category: value.category,
      p_visibility: value.visibility, p_contact: value.contactConsent ? value.contact || null : null,
      p_contact_consent: value.contactConsent, p_share_consent: value.shareConsent,
    });
    if (error?.code === "22023") return NextResponse.json({ error: "Please use an active Sunday Service QR link shared by the church." }, { status: 403 });
    if (error) throw new Error("Submission unavailable");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Submissions are temporarily unavailable. Please contact the church or try again later." }, { status: 503 });
  }
}
