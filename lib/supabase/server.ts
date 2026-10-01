import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./config";
export async function createClient() { const { url, key } = getSupabaseEnv(); const store = await cookies(); return createServerClient(url, key, { cookies: { getAll: () => store.getAll(), setAll: (items: { name: string; value: string; options?: any }[]) => { try { items.forEach(({ name, value, options }) => store.set(name, value, options)); } catch {} } } }); }
