"use client";
import { useActionState, useId, useState } from "react";
import { permanentlyDeleteRecord } from "@/app/admin/record-actions";

const warnings = {
  event: "This also deletes all QR codes and registrations for this event. ARC and prayer records remain, but lose their event association.",
  qr: "This permanently removes this QR link. The event and its submissions remain.",
  member: "This also deletes this member’s ministry assignments and all recorded Sunday attendance. It does not delete a separate administrator login.",
  arc: "This deletes this ARC entry and its internal action notes. Other entries in the same submission remain. If this is the final entry, its submission record is also deleted.",
  prayer: "This deletes the prayer request, its contact details, and all private follow-up notes.",
};
export function PermanentDelete({ id, kind, label }: { id: string; kind: keyof typeof warnings; label: string }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [state, action, pending] = useActionState(permanentlyDeleteRecord, { error: "" });
  const inputId = useId();
  if (!open) return <button type="button" className="mt-4 text-sm text-destructive underline" onClick={() => setOpen(true)}>Delete permanently…</button>;
  return <form action={action} className="mt-4 space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
    <input type="hidden" name="id" value={id} /><input type="hidden" name="kind" value={kind} />
    <p className="font-semibold">Permanently delete “{label}”?</p>
    <p>{warnings[kind]}</p><p>This cannot be undone in the app. Audit history is retained. There is no restore option after deletion.</p>
    <label htmlFor={inputId} className="block font-medium">Type DELETE to confirm</label>
    <input id={inputId} name="confirmation" value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="off" spellCheck={false} required pattern="DELETE" disabled={pending} className="block w-full max-w-xs rounded-lg border bg-background px-3 py-2" />
    <div className="flex flex-wrap gap-3"><button disabled={pending || confirmation !== "DELETE"} className="rounded-lg bg-destructive px-4 py-2 text-destructive-foreground disabled:opacity-50">{pending ? "Deleting…" : "Delete permanently"}</button>
      <button type="button" disabled={pending} onClick={() => { setOpen(false); setConfirmation(""); }} className="rounded-lg border px-4 py-2">Cancel</button></div>
    {state.error && <p role="alert" className="text-destructive">{state.error}</p>}
  </form>;
}
