"use client";
import { useActionState, useState } from "react";
import { saveAttendance } from "@/app/admin/attendance-actions";
import { Button } from "@/components/ui/button";

export function AttendanceMark({ memberId, name, sunday, recorded }: {
  memberId: string; name: string; sunday: string; recorded: boolean | null;
}) {
  const [state, action, pending] = useActionState(saveAttendance, { error: "", saved: "" });
  const [present, setPresent] = useState(recorded === true);
  return <form action={action} className="space-y-2">
    <input type="hidden" name="memberId" value={memberId} /><input type="hidden" name="sunday" value={sunday} />
    <div className="flex items-center gap-4">
      <label className="flex items-center gap-2"><input type="checkbox" name="present" checked={present} disabled={pending} onChange={(e) => setPresent(e.target.checked)} aria-label={`${name} present on ${sunday}`} className="size-4" />Present</label>
      <Button size="sm" variant="outline" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
    </div>
    <p aria-live="polite" className="text-xs text-muted-foreground">{state.saved || (recorded === null ? "Not recorded" : recorded ? "Saved: present" : "Saved: absent")}</p>
    {state.error && <p role="alert" className="text-xs text-destructive">{state.error}</p>}
  </form>;
}
