"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { eventSchema, manilaDateTime } from "@/lib/events";
import { memberSchema } from "@/lib/validation";
async function audit(action: string, entityType: string, entityId?: string, details: Record<string, unknown> = {}) { const admin = await requireAdmin(); const db = await createClient(); await db.from("audit_logs").insert({ actor_id: admin.user.id, action, entity_type: entityType, entity_id: entityId || null, details }); }
export async function updateArcStatus(form: FormData) { await requireAdmin(["super_admin","ministry_leader"]); const id = String(form.get("id")); const status = String(form.get("status")); const note = String(form.get("note") ?? "").trim(); const db = await createClient(); await db.from("arc_entries").update({ status, updated_at: new Date().toISOString() }).eq("id", id); if (note) await db.from("admin_actions").insert({ entity_type: "arc_entry", entity_id: id, action: status, notes: note }); await audit("status_updated", "arc_entry", id, { status }); revalidatePath("/admin/arc"); }
export async function updatePrayerStatus(form: FormData) { await requireAdmin(["super_admin"]); const id = String(form.get("id")); const status = String(form.get("status")); const note = String(form.get("note") ?? "").trim(); const db = await createClient(); await db.from("prayer_requests").update({ status, updated_at: new Date().toISOString() }).eq("id", id); if (note) await db.from("prayer_followups").insert({ prayer_request_id: id, action_type: status, notes: note }); await audit("status_updated", "prayer_request", id, { status }); revalidatePath("/admin/prayers"); }
function memberValue(form: FormData) { return memberSchema.safeParse({ firstName: form.get("firstName"), middleName: form.get("middleName") || undefined, lastName: form.get("lastName"), birthdate: form.get("birthdate") || undefined, contactNumber: form.get("contactNumber"), email: form.get("email") || "", address: form.get("address") || undefined, status: form.get("status"), dateJoined: form.get("dateJoined") || undefined, notes: form.get("notes") || undefined, ministryIds: form.getAll("ministryIds") }); }
export async function saveMember(form: FormData) { await requireAdmin(["super_admin","membership_admin"]); const parsed = memberValue(form); if (!parsed.success) redirect("/admin/members/new?error=invalid"); const value = parsed.data; const id = String(form.get("id") || ""); const db = await createClient(); const payload = { first_name: value.firstName, middle_name: value.middleName || null, last_name: value.lastName, birthdate: value.birthdate || null, contact_number: value.contactNumber, email: value.email || null, address: value.address || null, status: value.status, date_joined: value.dateJoined || null, administrative_notes: value.notes || null }; let memberId = id; if (id) await db.from("members").update(payload).eq("id", id); else { const result = await db.from("members").insert(payload).select("id").single(); if (result.error) throw result.error; memberId = result.data.id; } await db.from("member_ministries").delete().eq("member_id", memberId); if (value.ministryIds.length) await db.from("member_ministries").insert(value.ministryIds.map((ministry_id) => ({ member_id: memberId, ministry_id }))); await audit(id ? "updated" : "created", "member", memberId); revalidatePath("/admin/members"); redirect("/admin/members"); }
export async function archiveMember(form: FormData) { await requireAdmin(["super_admin","membership_admin"]); const id = String(form.get("id")); const db = await createClient(); await db.from("members").update({ archived: true, archived_at: new Date().toISOString() }).eq("id", id); await audit("archived", "member", id); revalidatePath("/admin/members"); }
export async function createEvent(_state: { error: string }, form: FormData): Promise<{ error: string }> {
  await requireAdmin(["super_admin", "ministry_leader"]);
  const parsed = eventSchema.safeParse(Object.fromEntries(
    ["name", "eventType", "location", "startsAt", "endsAt", "expiresAt"].map((key) => [key, String(form.get(key) ?? "")])
  ));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the event details." };
  const value = parsed.data;
  let eventId: string;
  try {
    const db = await createClient();
    const result = await db.rpc("create_event_with_qr", {
      p_name: value.name, p_event_type: value.eventType, p_location: value.location || null,
      p_starts_at: value.startsAt ? manilaDateTime(value.startsAt) : null,
      p_ends_at: value.endsAt ? manilaDateTime(value.endsAt) : null,
      p_expires_at: value.expiresAt ? manilaDateTime(value.expiresAt) : null,
      p_token: randomBytes(24).toString("base64url"),
    });
    if (result.error || !result.data) return { error: "Event creation failed. Confirm migration 003 is applied and try again." };
    eventId = result.data as string;
  } catch {
    return { error: "Event creation could not be confirmed. Check Events before trying again." };
  }
  revalidatePath("/admin/events");
  revalidatePath("/admin/qr");
  redirect("/admin/events/" + eventId);
}
export async function addMinistry(form: FormData) { await requireAdmin(["super_admin"]); const name = String(form.get("name") ?? "").trim(); if (!name) return; const db = await createClient(); await db.from("ministry_areas").insert({ name }); await audit("created", "ministry_area", undefined, { name }); revalidatePath("/admin/settings"); }
export async function inviteAdmin(form: FormData) { const actor = await requireAdmin(["super_admin"]); const email = String(form.get("email")); const displayName = String(form.get("displayName")); const role = String(form.get("role")); const db = await createClient(); const roleResult = await db.from("admin_roles").select("id").eq("name", role).single(); if (!roleResult.data) throw new Error("Invalid role"); const adminDb = createAdminClient(); const result = await adminDb.auth.admin.inviteUserByEmail(email, { data: { display_name: displayName } }); if (result.error) throw result.error; await adminDb.from("admin_profiles").insert({ id: result.data.user.id, display_name: displayName, role_id: roleResult.data.id, is_active: true, created_by: actor.user.id }); await audit("invited", "admin_profile", result.data.user.id, { role }); revalidatePath("/admin/settings"); }
