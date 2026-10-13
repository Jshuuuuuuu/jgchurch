import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/admin/page-heading";
import { RecordControl } from "@/components/admin/record-control";
import { formatDate } from "@/lib/utils";

export default async function Trash({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdmin(["super_admin"]);
  const params = await searchParams;
  const page = Math.min(100000, Math.max(1, Math.floor(Number(params.page) || 1)));
  const db = await createClient();
  const { data, error } = await db.rpc("list_trash", { p_offset: (page - 1) * 50 });
  return <><PageHeading title="Trash" description="Restore records without losing their related data. Restored events and QR codes remain inactive until you activate them. An expired QR code remains expired." />
    <p className="mb-5 text-sm text-muted-foreground">Trashing an event keeps its QR codes and registrations, but blocks all of its links. Restore the event to view them again. ARC and prayer records remain in their own lists unless separately trashed. Previously archived members also appear here. No permanent-delete action is provided.</p>
    {error ? <p role="alert">Trash could not be loaded. Confirm migration 005 is applied.</p> : <div className="space-y-3">
      {data?.slice(0, 50).map((row: any) => <article key={`${row.kind}-${row.id}`} className="rounded-xl border bg-card p-5">
        <p className="text-xs uppercase text-muted-foreground">{row.kind}</p><h2 className="font-semibold">{row.label}</h2>
        <p className="text-xs text-muted-foreground">{row.trashed_at ? formatDate(row.trashed_at) : "Previously archived"}</p>
        <RecordControl kind={row.kind} id={row.id} operation="restore" />
      </article>)}
      {!data?.length && <p>No records in Trash on this page.</p>}
      <div className="flex gap-4">{page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}{data?.length > 50 && <Link href={`?page=${page + 1}`}>Next</Link>}</div>
    </div>}
  </>;
}
