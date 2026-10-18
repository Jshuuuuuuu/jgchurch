# Permanent deletion (migration 006)

Apply `006_permanent_delete.sql` once after migration 005, then deploy the matching code. Applying the migration itself does not delete records. No new credentials are required.

Only an active Super Admin can permanently delete records. Move a record to Trash first, open **Trash → Delete permanently…**, read the warning, then type `DELETE`. There is no bulk-delete action or in-app undo. Restoring a record before deletion makes deletion fail safely.

Deletion effects:

- Event: removes the event, all its QR tokens and registrations. ARC and prayer records remain with their event association cleared.
- QR: removes that token only; the event and existing submissions remain.
- Member: removes member details, ministry assignments and Sunday attendance; a separate administrator login is unaffected.
- ARC: removes one entry and its action notes, leaving sibling entries intact. The submission container is removed when its last entry is deleted.
- Prayer: removes the request and its private follow-ups/contact details.

Audit history remains for accountability, with actor, record ID and deletion action; the deletion audit does not copy the removed content. Existing database backups, exports, and previous audit details are not erased by this feature. This is not a backup-erasure tool.

Test using fictional records first. `tests/permanent-delete.integration.sql` is an automated regression fixture for an **empty disposable local PostgreSQL database only**, never a live Supabase project.
