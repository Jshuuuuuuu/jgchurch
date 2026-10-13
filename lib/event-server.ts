import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PublicEvent } from "@/lib/events";

export async function getPublicEvent(token: string): Promise<PublicEvent | null> {
  if (token.length < 24 || token.length > 160) return null;
  const db = await createClient();
  const { data, error } = await db.rpc("get_registration_event", { p_token: token });
  if (error) throw new Error("Event lookup unavailable");
  return (data?.[0] as PublicEvent | undefined) ?? null;
}
