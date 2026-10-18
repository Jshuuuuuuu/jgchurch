import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  checkSiteverifyResult,
  checkSubmissionTiming,
  verificationFailure,
  type HumanVerificationResult,
} from "@/lib/human-verification";

export async function verifyHumanDetailed(
  startedAt: number,
  honeypot: string,
  turnstileToken?: string,
): Promise<HumanVerificationResult> {
  const timing = checkSubmissionTiming(startedAt, honeypot);
  if (timing) return timing;

  const secret = process.env.TURNSTILE_SECRET_KEY;
  const production = process.env.NODE_ENV === "production";
  if (!secret) return production ? verificationFailure("configuration") : { ok: true };

  const configuredSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (production && (!configuredSiteKey || !appUrl)) return verificationFailure("configuration");
  if (!turnstileToken) return verificationFailure("challenge_missing");

  // Never accept a challenge from a different hostname than our configured site.
  let expectedHostname: string | null = null;
  if (production) {
    try {
      expectedHostname = new URL(appUrl!).hostname;
      if (!expectedHostname) return verificationFailure("configuration");
    } catch {
      return verificationFailure("configuration");
    }
  }

  const body = new FormData();
  body.set("secret", secret);
  body.set("response", turnstileToken);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return verificationFailure("verification_unavailable");
    const result = await response.json() as {
      success?: boolean;
      hostname?: string;
      "error-codes"?: string[];
    };
    return checkSiteverifyResult(result, expectedHostname);
  } catch {
    return verificationFailure("verification_unavailable");
  }
}

// Retain the boolean API for callers that only need success/failure.
export async function verifyHuman(startedAt: number, honeypot: string, turnstileToken?: string) {
  return (await verifyHumanDetailed(startedAt, honeypot, turnstileToken)).ok;
}

export async function rateLimit(scope: "arc" | "prayer" | "registration") {
  const store = await cookies();
  let id = store.get("arc_session")?.value;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    id = randomUUID();
    store.set("arc_session", id, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 2592000, path: "/" });
  }
  // Session-based limits avoid blocking the congregation's shared Wi-Fi.
  // This is not a substitute for edge/WAF rate limiting.
  const digest = createHash("sha256").update(`${scope}:${id}`).digest("hex");
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("check_public_rate_limit", { p_key_hash: digest, p_scope: scope, p_limit: 8, p_window_minutes: 15 });
  if (error) throw new Error("Submission limits unavailable");
  return Boolean(data);
}
