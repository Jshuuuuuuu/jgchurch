import { BookHeart, ClipboardList, Clock3, MessageSquareText, Users } from "lucide-react";
import { PageHeading } from "@/components/admin/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyticsChart } from "@/components/admin/analytics-chart";
import { createClient } from "@/lib/supabase/server";
type Summary = { arc_submissions_today?: number; arc_entries_today?: number; prayer_requests_today?: number; members?: number; pending_reviews?: number };

export default async function Dashboard() {
  const db = await createClient();
  const [summaryResult, trend] = await Promise.all([
    db.rpc("dashboard_summary"),
    db.rpc("dashboard_daily_trend", { p_days: 14 })
  ]);
  const summary = (summaryResult.data ?? {}) as Summary;
  const cards = [
    { label: "ARC submissions today", value: summary.arc_submissions_today ?? 0, icon: ClipboardList },
    { label: "Feedback entries today", value: summary.arc_entries_today ?? 0, icon: MessageSquareText },
    { label: "Prayer requests today", value: summary.prayer_requests_today ?? 0, icon: BookHeart },
    { label: "Registered members", value: summary.members ?? 0, icon: Users },
    { label: "Pending reviews", value: summary.pending_reviews ?? 0, icon: Clock3 }
  ];
  return <><PageHeading eyebrow="Overview" title="Church pulse" description="Live aggregate counts from authorized database functions." /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{cards.map(({ label, value, icon: Icon }) => <Card key={label}><CardContent className="p-5"><div className="flex items-center justify-between"><span className="grid size-9 place-items-center rounded-xl bg-secondary text-primary"><Icon className="size-4" /></span><span className="text-3xl font-semibold">{value}</span></div><p className="mt-5 text-sm text-muted-foreground">{label}</p></CardContent></Card>)}</div><Card className="mt-6"><CardHeader><CardTitle>14-day activity</CardTitle></CardHeader><CardContent><AnalyticsChart data={(trend.data ?? []).map((row: { day: string; arc: number; prayer: number }) => row)} /></CardContent></Card></>;
}
