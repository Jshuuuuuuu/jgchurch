import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function verifyHuman(startedAt: number, honeypot: string, turnstileToken?: string) {
  if (honeypot || Date.now() - startedAt < 2500 || Date.now() - startedAt > 86_400_000) return false;
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const production = process.env.NODE_ENV === "production";
  if (!secret) {
    if (production) throw new Error("Production bot protection is not configured");
    return true;
  }
  if (production && (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || !process.env.NEXT_PUBLIC_APP_URL)) {
    throw new Error("Production bot protection is not configured");
  }
  if (!turnstileToken) return false;
  const body = new FormData();
  body.set("secret", secret);
  body.set("response", turnstileToken);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST", body, cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return false;
  const result = await response.json() as { success?: boolean; hostname?: string };
  if (result.success !== true) return false;
  if (production && result.hostname !== new URL(process.env.NEXT_PUBLIC_APP_URL!).hostname) return false;
  return true;
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
