import Link from "next/link";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/admin/page-heading";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { RecordControl } from "@/components/admin/record-control";

export default async function Members({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; ministry?: string; page?: string }> }) {
  const admin = await requireAdmin(["super_admin", "membership_admin"]);
  const params = await searchParams;
  // Do not interpolate PostgREST operators supplied by a search string.
  const q = (params.q ?? "").replace(/[^\p{L}\p{N}\s-]/gu, "").trim().slice(0, 100);
  const status = ["regular", "new", "visitor", "inactive"].includes(params.status ?? "") ? params.status! : "";
  const ministry = z.string().uuid().safeParse(params.ministry).success ? params.ministry! : "";
  const page = Math.min(100000, Math.max(1, Math.floor(Number(params.page) || 1)));
  const db = await createClient();
  // Filtering one membership must not hide the member's other ministries.
  let query = db.from("members").select("id,member_number,first_name,last_name,contact_number,email,status,member_ministries(ministry:ministries(name))" + (ministry ? ",matching:member_ministries!inner(ministry_id)" : ""), { count: "exact" })
    .eq("archived", false).order("last_name").order("first_name").order("id").range((page - 1) * 50, page * 50 - 1);
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,member_number.ilike.%${q}%`);
  if (status) query = query.eq("status", status);
  if (ministry) query = query.eq("matching.ministry_id", ministry);
  const [{ data, error, count }, ministries] = await Promise.all([query, db.from("ministries").select("id,name,active").order("name")]);
  const pageLink = (value: number) => "?" + new URLSearchParams({ q, status, ministry, page: String(value) });
  return <><PageHeading eyebrow="Directory" title="Church members" description="Search the directory and filter by ministry or membership status." action={<Link href="/admin/members/new" className={buttonVariants({ size: "sm" })}>Add member</Link>} />
    <form className="mb-5 flex flex-wrap items-center gap-2">
      <input aria-label="Name or member ID" name="q" defaultValue={q} placeholder="Name or member ID" className="h-10 rounded-xl border bg-card px-3 text-sm" />
      <select aria-label="Membership status" name="status" defaultValue={status} className="h-10 rounded-xl border bg-card px-3 text-sm"><option value="">All statuses</option>{["regular", "new", "visitor", "inactive"].map(s => <option key={s} value={s}>{s}</option>)}</select>
      <select aria-label="Ministry" name="ministry" defaultValue={ministry} className="h-10 max-w-full rounded-xl border bg-card px-3 text-sm"><option value="">All ministries</option>{ministries.data?.map(m => <option key={m.id} value={m.id}>{m.name}{m.active ? "" : " (inactive)"}</option>)}</select>
      <button className="h-10 rounded-xl bg-primary px-4 text-sm text-primary-foreground">Filter</button><Link className="px-2 text-sm underline" href="/admin/members">Reset</Link>
    </form>
    {error || ministries.error ? <p role="alert">The directory could not be loaded. Please refresh and try again.</p> : <>
      <p className="mb-3 text-sm text-muted-foreground">{count ?? 0} matching members · Page {page}</p>
      {!data?.length ? <p>No members found. Try clearing your filters.</p> : <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-left text-sm"><thead className="bg-muted/70"><tr>{["Member", "Ministries", "Contact", "Status", "Actions"].map(title => <th key={title} className="p-4">{title}</th>)}</tr></thead><tbody>
        {(data as any[]).map(m => <tr key={m.id} className="border-t transition-colors hover:bg-muted/40 motion-reduce:transition-none">
          <td className="p-4"><strong>{m.last_name}, {m.first_name}</strong><span className="block text-xs text-muted-foreground">{m.member_number}</span></td>
          <td className="p-4"><div className="flex flex-wrap gap-1">{m.member_ministries?.length ? m.member_ministries.map((mm: any, i: number) => <Badge key={i}>{mm.ministry?.name ?? "Unavailable ministry"}</Badge>) : <span className="text-muted-foreground">Not assigned</span>}</div></td>
          <td className="p-4">{m.contact_number}<span className="block text-xs text-muted-foreground">{m.email}</span></td>
          <td className="p-4"><Badge className="capitalize">{m.status}</Badge></td>
          <td className="p-4"><Link href={`/admin/members/${m.id}`} className="text-primary underline">Edit</Link>{admin.role === "super_admin" && <RecordControl kind="member" id={m.id} />}</td>
        </tr>)}
      </tbody></table></div>}
      <nav aria-label="Member pages" className="mt-5 flex gap-4">{page > 1 && <Link href={pageLink(page - 1)}>Previous</Link>}{(count ?? 0) > page * 50 && <Link href={pageLink(page + 1)}>Next</Link>}</nav>
    </>}
  </>;
}
