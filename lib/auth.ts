import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
export type AdminRole = "super_admin" | "ministry_leader" | "prayer_team" | "membership_admin";
export const getAdmin = cache(async () => { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return null; const { data: profile } = await supabase.from("admin_profiles").select("id, display_name, role:admin_roles(name), is_active").eq("id", user.id).maybeSingle(); if (!profile?.is_active) return null; const roleData = Array.isArray(profile.role) ? profile.role[0] : profile.role; return { user, profile, role: (roleData as { name?: AdminRole } | null)?.name as AdminRole | undefined }; });
export async function requireAdmin(allowed?: AdminRole[]) { const admin = await getAdmin(); if (!admin) redirect("/admin/login"); if (allowed && (!admin.role || !allowed.includes(admin.role))) redirect("/admin/dashboard?forbidden=1"); return admin; }
