-- Apply once after 005. Installing this function does not delete any data.
begin;
create function public.permanently_delete_record(p_kind text,p_id uuid,p_confirmation text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_count integer; v_submission uuid;
begin
  if not public.has_role(array['super_admin']) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if p_confirmation is distinct from 'DELETE' or p_id is null then
    raise exception 'Explicit confirmation required' using errcode = '22023';
  end if;
  case p_kind
    when 'event' then
      -- Cascades to QR tokens and registrations; feedback/prayer event_id becomes null.
      delete from public.events where id=p_id and deleted_at is not null;
    when 'qr' then delete from public.qr_tokens where id=p_id and deleted_at is not null;
    when 'member' then
      -- Cascades to ministry memberships and Sunday attendance.
      delete from public.members where id=p_id and archived;
    when 'prayer' then
      -- Private prayer follow-ups cascade with their request.
      delete from public.prayer_requests where id=p_id and archived;
    when 'arc' then
      -- Serialize sibling deletions so the final entry removes its empty container.
      select s.id into v_submission from public.arc_submissions s
        join public.arc_entries a on a.submission_id=s.id
        where a.id=p_id for update of s;
      delete from public.arc_entries where id=p_id and archived;
    else raise exception 'Invalid record type' using errcode = '22023';
  end case;
  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'Record unavailable or not in Trash' using errcode = '22023';
  end if;
  if p_kind='arc' then
    delete from public.admin_actions where entity_type='arc_entry' and entity_id=p_id;
    delete from public.arc_submissions s where s.id=v_submission
      and not exists(select 1 from public.arc_entries a where a.submission_id=s.id);
  end if;
  -- Keep an accountability record, not a copy of deleted personal/content data.
  insert into public.audit_logs(actor_id,action,entity_type,entity_id)
    values(auth.uid(),'permanently_deleted',p_kind,p_id);
end $$;
revoke all on function public.permanently_delete_record(text,uuid,text) from public,anon,service_role;
grant execute on function public.permanently_delete_record(text,uuid,text) to authenticated;
-- Existing restrictive DELETE policies remain: ordinary table deletes stay blocked.
commit;
