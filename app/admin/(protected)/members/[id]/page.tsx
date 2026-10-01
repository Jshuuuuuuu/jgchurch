import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/admin/page-heading";
import { MemberForm } from "@/components/admin/member-form";
export default async function EditMember({ params }: { params: Promise<{ id: string }> }) { await requireAdmin(["super_admin","membership_admin"]); const { id } = await params; const db = await createClient(); const [member, ministries] = await Promise.all([db.from("members").select("*,member_ministries(ministry_id)").eq("id", id).single(), db.from("ministries").select("id,name").eq("active", true).order("name")]); if (!member.data) notFound(); return <><PageHeading eyebrow="Directory" title={`Edit ${member.data.first_name} ${member.data.last_name}`} /><MemberForm ministries={ministries.data ?? []} member={member.data} /></>; }
