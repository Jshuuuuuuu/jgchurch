import type { Metadata } from "next";
import { PublicHeader } from "@/components/public/public-header";
import { PrayerForm } from "@/components/public/prayer-form";
export const metadata: Metadata = { title: "Prayer Request" };
export default async function PrayerPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) { const { token = "" } = await searchParams; return <><PublicHeader /><main className="page-shell max-w-2xl py-10 sm:py-14"><p className="eyebrow">Held with care</p><h1 className="mt-3 font-serif text-4xl font-semibold">How can we pray with you?</h1><p className="mt-3 mb-8 text-muted-foreground">You decide who may see your request. Nothing is published automatically.</p><PrayerForm eventToken={token} turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""} /></main></>; }
