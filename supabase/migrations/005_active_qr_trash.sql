-- Apply after 004. Recoverable Trash; no records are deleted.
begin;

-- Active, unexpired Sunday Service links accept feedback on any day.
create or replace function public.submit_arc_reflection(p_event_token text, p_entries jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  perform public.resolve_event(p_event_token);
  return arc_private.submit_arc_reflection(p_event_token, p_entries);
end $$;
revoke all on function public.submit_arc_reflection(text,jsonb) from public, anon, authenticated;
grant execute on function public.submit_arc_reflection(text,jsonb) to service_role;

alter table public.events add column deleted_at timestamptz;
alter table public.qr_tokens add column deleted_at timestamptz;
-- Existing resolvers already require active on BOTH event and token.
-- These constraints also prevent direct database updates reopening trash.
alter table public.events add constraint trashed_event_inactive check (deleted_at is null or not active);
alter table public.qr_tokens add constraint trashed_qr_inactive check (deleted_at is null or not active);

-- Broad pre-existing management policies must not let another role restore/trash
-- records by updating these columns directly instead of using the new RPC.
create function public.guard_trash_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (to_jsonb(new)->tg_argv[0]) is distinct from (to_jsonb(old)->tg_argv[0])
    and not public.has_role(array['super_admin']) then
    raise exception 'Only Super Admin can change Trash state' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger events_trash_guard before update on public.events for each row execute function public.guard_trash_change('deleted_at');
create trigger qr_trash_guard before update on public.qr_tokens for each row execute function public.guard_trash_change('deleted_at');
create trigger members_trash_guard before update on public.members for each row execute function public.guard_trash_change('archived');
create trigger arc_trash_guard before update on public.arc_entries for each row execute function public.guard_trash_change('archived');
create trigger prayer_trash_guard before update on public.prayer_requests for each row execute function public.guard_trash_change('archived');

-- Normal authenticated clients use recoverable Trash, never hard deletion.
create policy events_no_hard_delete on public.events as restrictive for delete to authenticated using(false);
create policy qr_no_hard_delete on public.qr_tokens as restrictive for delete to authenticated using(false);
create policy members_no_hard_delete on public.members as restrictive for delete to authenticated using(false);
create policy arc_no_hard_delete on public.arc_entries as restrictive for delete to authenticated using(false);
create policy prayer_no_hard_delete on public.prayer_requests as restrictive for delete to authenticated using(false);

create function public.set_record_trash(p_kind text, p_id uuid, p_restore boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_count integer; v_at timestamptz;
begin
  if not public.has_role(array['super_admin']) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if p_restore is null then raise exception 'Invalid action' using errcode = '22023'; end if;
  v_at := case when p_restore then null else now() end;
  case p_kind
    -- Restored links stay inactive until explicitly activated.
    when 'event' then update public.events set deleted_at=v_at, active=false where id=p_id;
    when 'qr' then update public.qr_tokens set deleted_at=v_at, active=false where id=p_id;
    when 'member' then update public.members set archived=not p_restore, archived_at=v_at where id=p_id;
    when 'arc' then update public.arc_entries set archived=not p_restore, archived_at=v_at where id=p_id;
    when 'prayer' then update public.prayer_requests set archived=not p_restore, archived_at=v_at where id=p_id;
    else raise exception 'Invalid record type' using errcode = '22023';
  end case;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Record unavailable' using errcode = '22023'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id)
    values(auth.uid(),case when p_restore then 'restored' else 'trashed' end,p_kind,p_id);
end $$;
revoke all on function public.set_record_trash(text,uuid,boolean) from public, anon;
grant execute on function public.set_record_trash(text,uuid,boolean) to authenticated;

create function public.set_link_active(p_kind text,p_id uuid,p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if not public.has_role(array['super_admin','ministry_leader']) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if p_active is null then raise exception 'Invalid action' using errcode = '22023'; end if;
  case p_kind
    when 'event' then update public.events set active=p_active where id=p_id and deleted_at is null;
    when 'qr' then update public.qr_tokens set active=p_active where id=p_id and deleted_at is null;
    else raise exception 'Invalid record type' using errcode = '22023';
  end case;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Restore the record first' using errcode = '22023'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
    values(auth.uid(),'activation_changed',p_kind,p_id,jsonb_build_object('active',p_active));
end $$;
revoke all on function public.set_link_active(text,uuid,boolean) from public, anon;
grant execute on function public.set_link_active(text,uuid,boolean) to authenticated;

-- One paginated list, only for Super Admin. No sensitive prayer text in labels.
create function public.list_trash(p_offset integer default 0)
returns table(kind text,id uuid,label text,trashed_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_role(array['super_admin']) then raise exception 'Forbidden' using errcode = '42501'; end if;
  return query select t.* from (
    select 'event'::text,e.id,e.name,e.deleted_at from public.events e where e.deleted_at is not null
    union all select 'qr',q.id,e.name,q.deleted_at from public.qr_tokens q join public.events e on e.id=q.event_id where q.deleted_at is not null
    union all select 'member',m.id,m.first_name||' '||m.last_name,m.archived_at from public.members m where m.archived
    union all select 'arc',a.id,a.type::text||' · '||left(a.id::text,8),a.archived_at from public.arc_entries a where a.archived
    union all select 'prayer',p.id,'Prayer request · '||left(p.id::text,8),p.archived_at from public.prayer_requests p where p.archived
  ) t order by 4 desc nulls last,1,2 limit 51 offset greatest(0,p_offset);
end $$;
revoke all on function public.list_trash(integer) from public, anon;
grant execute on function public.list_trash(integer) to authenticated;

commit;
