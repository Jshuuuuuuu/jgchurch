"use client";
import { useActionState, useState } from "react";
import { changeRecord } from "@/app/admin/record-actions";

export function RecordControl({ id, kind, operation = "trash" }: {
  id: string; kind: "event" | "qr" | "member" | "arc" | "prayer";
  operation?: "trash" | "restore" | "activate" | "deactivate";
}) {
  const [state, action, pending] = useActionState(changeRecord, { error: "" });
  const [confirming, setConfirming] = useState(false);
  const label = { trash: "Move to Trash", restore: "Restore", activate: "Activate", deactivate: "Deactivate" }[operation];
  return <form action={action} className="mt-3 text-sm">
    <input type="hidden" name="id" value={id} /><input type="hidden" name="kind" value={kind} /><input type="hidden" name="operation" value={operation} />
    {operation === "trash" && !confirming ? <button type="button" className="text-destructive underline" onClick={() => setConfirming(true)}>{label}</button> : <>
      {operation === "trash" && <p className="mb-2 text-muted-foreground">Move this record to recoverable Trash? {kind === "event" || kind === "qr" ? "The link will stop accepting submissions. Related records are kept." : "It will be hidden from the active list. Related records are kept."}</p>}
      <button disabled={pending} className="rounded-lg border px-3 py-2 font-medium disabled:opacity-50">{pending ? "Saving…" : label}</button>
      {operation === "trash" && <button type="button" disabled={pending} className="ml-3 underline" onClick={() => setConfirming(false)}>Cancel</button>}
    </>}
    {state.error && <p role="alert" className="mt-2 text-destructive">{state.error}</p>}
    {state.success && <span role="status" className="ml-2">{state.success}</span>}
  </form>;
}
