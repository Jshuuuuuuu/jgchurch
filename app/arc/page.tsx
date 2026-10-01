import type { Metadata } from "next";
import { PublicHeader } from "@/components/public/public-header";
import { ArcForm } from "@/components/public/arc-form";
import { DEFAULT_MINISTRIES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/config";
export const metadata: Metadata = { title: "ARC Reflection" };
export default async function ArcPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) { const { token = "" } = await searchParams; let ministries = DEFAULT_MINISTRIES.map((name, i) => ({ id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, name })); if (hasSupabaseEnv()) { const db = await createClient(); const result = await db.from("ministry_areas").select("id,name").eq("active", true).order("sort_order"); if (result.data?.length) ministries = result.data; } return <><PublicHeader /><main className="page-shell max-w-3xl py-10 sm:py-14"><div className="mb-8"><p className="eyebrow">Anonymous reflection</p><h1 className="mt-3 font-serif text-4xl font-semibold">What would you like to share?</h1><p className="mt-3 text-muted-foreground">Choose one or more categories. Each response remains independent while staying part of one submission.</p></div><ArcForm ministries={ministries} eventToken={token} turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""} /></main></>; }
