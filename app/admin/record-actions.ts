"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function changeRecord(_state: { error: string; success?: string }, form: FormData) {
  const parsed = z.object({
    id: z.string().uuid(), kind: z.enum(["event", "qr", "member", "arc", "prayer"]),
    operation: z.enum(["trash", "restore", "activate", "deactivate"]),
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Invalid request." };
  const { id, kind, operation } = parsed.data;
  const activation = operation === "activate" || operation === "deactivate";
  await requireAdmin(activation ? ["super_admin", "ministry_leader"] : ["super_admin"]);
  if (activation && kind !== "event" && kind !== "qr") return { error: "Invalid action." };
  try {
    const db = await createClient();
    const { error } = activation
      ? await db.rpc("set_link_active", { p_kind: kind, p_id: id, p_active: operation === "activate" })
      : await db.rpc("set_record_trash", { p_kind: kind, p_id: id, p_restore: operation === "restore" });
    if (error) return { error: "Change not saved. Check your permissions and that migration 005 is applied." };
    revalidatePath("/admin", "layout");
    revalidatePath("/", "layout");
    return { error: "", success: "Saved." };
  } catch { return { error: "Unable to confirm the change. Refresh before trying again." }; }
}
