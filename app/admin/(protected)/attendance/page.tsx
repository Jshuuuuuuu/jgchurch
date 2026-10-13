import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { latestSunday, validAttendanceDate, philippineDate } from "@/lib/submission-policy";
import { AttendanceMark } from "@/components/admin/attendance-mark";
import { PageHeading } from "@/components/admin/page-heading";

export const metadata = { title: "Sunday attendance" };
export const dynamic = "force-dynamic";

export default async function Attendance({ searchParams }: { searchParams: Promise<{ date?: string; page?: string }> }) {
  await requireAdmin(["super_admin", "membership_admin"]);
  const params = await searchParams;
  const sunday = params.date ?? latestSunday();
  const pageNumber = Number(params.page ?? 1);
  const page = Number.isSafeInteger(pageNumber) && pageNumber > 0 ? Math.min(pageNumber, 100000) : 1;
  const size = 100;
  const valid = validAttendanceDate(sunday);
  const db = await createClient();
  const members = valid ? await db.from("members")
    .select("id,member_number,first_name,middle_name,last_name,status", { count: "exact" })
    .eq("archived", false).order("last_name").order("first_name").order("id").range((page - 1) * size, page * size - 1) : null;
  const ids = members?.data?.map((member) => member.id) ?? [];
  const attendance = valid ? await db.from("sunday_attendance")
    .select("member_id,present,updated_at").eq("sunday_date", sunday).in("member_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]) : null;
  const records = new Map(attendance?.data?.map((row) => [row.member_id, row]) ?? []);
  const pages = Math.max(1, Math.ceil((members?.count ?? 0) / size));

  return <>
    <PageHeading eyebrow="Members" title="Sunday attendance" description="Private attendance sheet for Super Admin and Membership Admin accounts. Attendance is never linked to anonymous ARC feedback." />
    <form className="mb-6 flex flex-wrap items-end gap-3">
      <label className="text-sm font-medium">Sunday date (Philippine time)<input type="date" name="date" required defaultValue={valid ? sunday : latestSunday()} max={philippineDate()} className="mt-2 block h-11 rounded-xl border bg-card px-3" /></label>
      <button className="h-11 rounded-xl bg-primary px-5 text-sm text-primary-foreground">Open attendance sheet</button>
    </form>
    {!valid ? <p role="alert">Choose a Sunday that is today or in the past.</p> : members?.error || attendance?.error ?
      <p role="alert">The attendance sheet could not be loaded. Confirm migration 004 has been applied and try again.</p> : <>
        <p className="mb-4 text-sm text-muted-foreground">{members?.count ?? 0} non-archived members · Sunday {sunday}. All membership statuses are included. Check Present and save each row; saving an unchecked row records Absent. Unmarked rows remain Not recorded. Historical sheets use the current member directory.</p>
        <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-left text-sm">
          <thead className="bg-muted"><tr><th scope="col" className="p-4">Member</th><th scope="col" className="p-4">Member number</th><th scope="col" className="p-4">Status</th><th scope="col" className="p-4">Attendance</th></tr></thead>
          <tbody>{members?.data?.map((member) => {
            const name = `${member.last_name}, ${member.first_name}${member.middle_name ? ` ${member.middle_name}` : ""}`;
            const record = records.get(member.id);
            return <tr key={member.id} className="border-t"><th scope="row" className="p-4 font-medium">{name}</th><td className="p-4">{member.member_number}</td><td className="p-4 capitalize">{member.status}</td><td className="p-4"><AttendanceMark key={`${member.id}:${sunday}:${record?.updated_at ?? "new"}`} memberId={member.id} name={name} sunday={sunday} recorded={record?.present ?? null} /></td></tr>;
          })}</tbody>
        </table></div>
        {!members?.data?.length && <p className="mt-4">No members on this page. Add members in the member directory first.</p>}
        <nav aria-label="Attendance pages" className="mt-5 flex flex-wrap gap-5 text-sm">
          {page > 1 && <Link className="underline" href={`/admin/attendance?date=${sunday}&page=${page - 1}`}>Previous</Link>}
          <span>Page {page} of {pages} · up to 100 members per page</span>
          {page < pages && <Link className="underline" href={`/admin/attendance?date=${sunday}&page=${page + 1}`}>Next</Link>}
        </nav>
      </>}
  </>;
}
