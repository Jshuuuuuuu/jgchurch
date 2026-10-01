import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/admin/page-heading";
import { MemberForm } from "@/components/admin/member-form";
export default async function NewMember() { await requireAdmin(["super_admin","membership_admin"]); const db = await createClient(); const { data = [] } = await db.from("ministries").select("id,name").eq("active", true).order("name"); return <><PageHeading eyebrow="Directory" title="Add member" /><MemberForm ministries={data ?? []} /></>; }
