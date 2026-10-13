-- Preserve existing requests and sharing preferences. Only Super Admin
-- accounts can read/manage requests and private follow-ups within ARC.
-- Forwarding to the requested recipient is handled personally, not automatically.
begin;

alter policy prayer_manage on public.prayer_requests
  using (public.has_role(array['super_admin']))
  with check (public.has_role(array['super_admin']));

alter policy followup_manage on public.prayer_followups
  using (public.has_role(array['super_admin']))
  with check (public.has_role(array['super_admin']));

commit;
