"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validAttendanceDate } from "@/lib/submission-policy";

export async function saveAttendance(_state: { error: string; saved: string }, form: FormData) {
  await requireAdmin(["super_admin", "membership_admin"]);
  const memberId = String(form.get("memberId") ?? "");
  const sunday = String(form.get("sunday") ?? "");
  if (!z.string().uuid().safeParse(memberId).success || !validAttendanceDate(sunday)) {
    return { error: "Choose a valid current or past Sunday and member.", saved: "" };
  }
  const present = form.get("present") === "on";
  try {
    const db = await createClient();
    const { error } = await db.rpc("save_sunday_attendance", { p_member_id: memberId, p_sunday: sunday, p_present: present });
    if (error) return { error: "Attendance could not be saved. Check your access and that migration 004 is applied.", saved: "" };
  } catch {
    return { error: "Attendance could not be confirmed. Refresh and check before retrying.", saved: "" };
  }
  revalidatePath("/admin/attendance");
  return { error: "", saved: present ? "Saved: present" : "Saved: absent" };
}
