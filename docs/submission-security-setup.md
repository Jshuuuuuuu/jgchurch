# Submission protection and Sunday attendance

This release needs migration `004_submission_controls_attendance.sql` after 001–003. Do not rerun older migrations on your live project. Existing records are retained.

## Required private configuration before deploying this release

Enter values directly in `.env.local` for development and Vercel Project Settings → Environment Variables for production. Never commit them or send screenshots of secret values.

- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase secret/service-role credential for this project. The variable retains its existing name. Used only by the cookie-free server client; never prefix it with `NEXT_PUBLIC_`. It is now required for all public submissions, not just invitations. Do not replace the browser's publishable key with this secret.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`: retain the existing project URL and publishable key.
- `NEXT_PUBLIC_APP_URL`: the canonical production HTTPS origin, not localhost or a temporary preview URL.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`: configure a Cloudflare Turnstile widget for the canonical website hostname. The site key is public; the secret must remain server-only. Production refuses submissions if verification is missing or fails. The verified hostname must match `NEXT_PUBLIC_APP_URL`.

Development can omit both Turnstile keys; the server credential is still required after migration 004. Use Turnstile test credentials from Cloudflare's documentation for automated/local verification, never production. Restart development/redeploy production after changing environment values. Production previews need their own explicitly configured hostname/widget/environment; do not broaden the hostname check just to make previews submit into production data.

## Apply and test

Configure credentials and deploy matching code in a planned maintenance window, then apply 004. Until both code and database are updated, submissions may be unavailable; fail-closed behavior is intentional. Do not advertise forms until testing is complete. No external settings or migrations are applied by the code edits alone.

- ARC after migration 005: any day with an active, unexpired Sunday Service QR token and an active event. The Sunday-only restriction in 004 is replaced, not edited. Bot checks and server-only writes remain.
- Prayer: any day with an active Sunday Service QR token shared by the church. Keep the token active with a suitable expiry if sharing it all week. Super Admin-only content visibility is unchanged.
- Midweek/Extracurricular registration: remains tied to active event QR links, with no Sunday restriction. Its database write RPC is server-only too.
- Anonymous/signed-in browser roles cannot execute public submission or rate-limit functions directly. Implementation functions are moved to a non-public schema and their browser privileges revoked. The application server validates request size, form data, schedule, QR, bot proof and per-session rate limits before invoking write functions.
- No names, account IDs, attendance records or IP addresses are added to ARC submissions. Bot providers/hosting infrastructure process request metadata under their own policies.

## Firewall: manual deployment step still required

Vercel provides automatic DDoS mitigation, but application code is not a DDoS guarantee. In Vercel Firewall, review and configure rate limits for POST requests to `/api/public/arc`, `/api/public/prayer`, and `/api/public/registration`. Start by observing expected Sunday traffic; avoid strict per-IP caps that lock out everyone on church Wi-Fi. Session limits can be reset by discarding cookies, so they supplement—not replace—edge protection and Turnstile. Review project usage alerts/spending controls and test legitimate traffic after enabling rules. Firewall configuration and Cloudflare setup are not automatically performed by this repository.

Public read-only Supabase metadata endpoints remain accessible; Vercel cannot protect requests sent directly to Supabase. Review Supabase platform protections/quotas and project usage as well. QR links can be forwarded. Neither QR access nor bot checks establish that content is relevant; administrators must still review it. Disabling an event/token stops new submissions using it.

## Sunday attendance

Open **Sunday Attendance** as an active Super Admin or Membership Admin. The page includes every non-archived member, including inactive/visitor statuses, in pages of 100. Choose a past/current Sunday (defaults to the latest local Sunday). Each member starts as **Not recorded**; tick Present and save, or save unchecked to explicitly record **Absent**. Edits are audited and upsert one record per member/date. Other roles and signed-out visitors cannot read/write attendance. Future attendance cannot be recorded.

This is actual attendance entered by staff, distinct from event intentions (“I'm coming”). It is not linked to ARC feedback, prayer requests, or public submissions. Historical sheets use the current member directory; archived members are excluded, though their attendance records remain in the database until member deletion. This release does not implement a historical membership snapshot, automated check-in, or attendance retention policy.

## Active links and recoverable Trash (migration 005)

Apply `005_active_qr_trash.sql` once after 004, then deploy the matching application code. No environment changes are needed. Do not rerun 004. Until 005 is applied, the old database Sunday rule still applies and the new Events/QR/Trash screens may be unavailable.

Super Admin can move events, QR codes, members, individual ARC entries, and prayer requests to Trash and restore them from **Trash**. Related records are preserved. Trashing an event blocks all its links without trashing its registrations, feedback, or prayers. Restored events/QR codes stay inactive: activate them deliberately in Events/QR Codes. Existing QR expiration still applies. Other roles cannot use Trash; authorized Ministry Leaders can activate/deactivate non-trashed events and QR codes.

Trashed feedback/prayers are hidden from their working lists, but historical submission totals still include retained records. Pending reviews and the active member count exclude archived records. Existing explicit database retention procedures can still permanently remove aged feedback/prayers if an administrator runs or schedules them; Trash is not a backup and does not override retention. No new retention job or automatic purge is introduced.

Members now show all assigned ministries, with ministry/status filters, result counts, Reset, and 50-row pagination. Navigation highlights the current section, uses subtle transitions, and respects reduced-motion preferences.

Test the upgrade with fictional data: submit through an active QR on a weekday; deactivate it and confirm rejection; trash/restore each record type; confirm attendance and member ministries survive restore; confirm a non-Super-Admin cannot use Trash; filter a member assigned to multiple ministries and verify all their ministries remain displayed. Local database regression: `tests/trash.integration.sql` is for an empty disposable database only, never Supabase.
