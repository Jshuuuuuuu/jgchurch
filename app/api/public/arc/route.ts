import { NextResponse } from "next/server";
import { arcSubmissionSchema } from "@/lib/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { submissionAccess } from "@/lib/submission-access";
import { isSundayInPhilippines, SUNDAY_CLOSED_MESSAGE } from "@/lib/submission-policy";
import { rateLimit, verifyHuman } from "@/lib/security";
import { readSubmissionJson } from "@/lib/submission-body";

export async function POST(request: Request) {
  if (!isSundayInPhilippines()) return NextResponse.json({ error: SUNDAY_CLOSED_MESSAGE }, { status: 403 });
  let input: unknown;
  try { input = await readSubmissionJson(request); } catch { return NextResponse.json({ error: "Invalid or oversized submission." }, { status: 400 }); }
  const parsed = arcSubmissionSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid reflection" }, { status: 400 });
  const value = parsed.data;
  try {
    if (!await verifyHuman(value.startedAt, value.website, value.turnstileToken)) return NextResponse.json({ error: "Please complete bot verification and wait a moment before submitting." }, { status: 400 });
    if (!await rateLimit("arc")) return NextResponse.json({ error: "Too many submissions. Please try again later." }, { status: 429 });
    const denied = await submissionAccess("arc", value.eventToken);
    if (denied) return NextResponse.json({ error: denied }, { status: 403 });
    const db = createAdminClient();
    const { error } = await db.rpc("submit_arc_reflection", { p_event_token: value.eventToken, p_entries: value.entries });
    if (error?.code === "22023") return NextResponse.json({ error: "ARC requires an active church QR link and is open only on Sundays in Philippine time." }, { status: 403 });
    if (error) throw new Error("Submission unavailable");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Submissions are temporarily unavailable. Please contact the church or try again later." }, { status: 503 });
  }
}
