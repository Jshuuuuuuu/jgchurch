-- EMPTY DISPOSABLE LOCAL DATABASE ONLY. Never run on Supabase.
\set ON_ERROR_STOP on
\ir trash.integration.sql
\ir ../supabase/migrations/006_permanent_delete.sql
set role anon;
do $$ begin
  begin perform public.permanently_delete_record('member',gen_random_uuid(),'DELETE'); raise exception 'anonymous access'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated"}';
do $$ begin
  begin perform public.permanently_delete_record('member',gen_random_uuid(),'DELETE'); raise exception 'leader access'; exception when insufficient_privilege then null; end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}';
do $$ declare e uuid; q uuid; a uuid; p uuid; s uuid; n integer;
begin
  begin perform public.permanently_delete_record('member','00000000-0000-4000-8000-000000000301','DELETE'); raise exception 'active record deleted'; exception when invalid_parameter_value then null; end;
  perform public.set_record_trash('member','00000000-0000-4000-8000-000000000301',false);
  begin perform public.permanently_delete_record('member','00000000-0000-4000-8000-000000000301','delete'); raise exception 'missing confirmation accepted'; exception when invalid_parameter_value then null; end;
  perform public.permanently_delete_record('member','00000000-0000-4000-8000-000000000301','DELETE');
  if exists(select 1 from public.members where id='00000000-0000-4000-8000-000000000301') or exists(select 1 from public.sunday_attendance where member_id='00000000-0000-4000-8000-000000000301') then raise exception 'member cascade failed'; end if;
  begin perform public.permanently_delete_record('member','00000000-0000-4000-8000-000000000301','DELETE'); raise exception 'missing record accepted'; exception when invalid_parameter_value then null; end;
  select id into p from public.prayer_requests limit 1;
  insert into public.prayer_followups(prayer_request_id,action_type,notes) values(p,'test','Fictional private note');
  perform public.set_record_trash('prayer',p,false);
  perform public.permanently_delete_record('prayer',p,'DELETE');
  if exists(select 1 from public.prayer_requests where id=p) or exists(select 1 from public.prayer_followups where prayer_request_id=p) then raise exception 'prayer cascade failed'; end if;
  select id,submission_id into a,s from public.arc_entries limit 1;
  select count(*) into n from public.arc_entries where submission_id=s;
  insert into public.admin_actions(entity_type,entity_id,action,notes) values('arc_entry',a,'test','Fictional note');
  perform public.set_record_trash('arc',a,false);
  perform public.permanently_delete_record('arc',a,'DELETE');
  if (select count(*) from public.arc_entries where submission_id=s) <> n-1 then raise exception 'sibling entries affected'; end if;
  if n=1 and exists(select 1 from public.arc_submissions where id=s) then raise exception 'empty submission retained'; end if;
  if exists(select 1 from public.admin_actions where entity_id=a) then raise exception 'ARC notes retained'; end if;
  select id,event_id into q,e from public.qr_tokens where token=repeat('s',32);
  perform public.set_record_trash('qr',q,false);
  perform public.permanently_delete_record('qr',q,'DELETE');
  if exists(select 1 from public.qr_tokens where id=q) or not exists(select 1 from public.events where id=e) then raise exception 'QR scope incorrect'; end if;
  select event_id into e from public.qr_tokens where token=repeat('e',32);
  perform public.set_record_trash('event',e,false);
  perform public.permanently_delete_record('event',e,'DELETE');
  if exists(select 1 from public.events where id=e) or exists(select 1 from public.qr_tokens where event_id=e) or exists(select 1 from public.event_registrations where event_id=e) then raise exception 'event cascade failed'; end if;
  if (select count(*) from public.audit_logs where action='permanently_deleted') <> 5 then raise exception 'deletion audit incorrect'; end if;
end $$;
reset role;
select 'PASS: permanent deletion, confirmation, Trash prerequisite, permissions, cascades and audit' as result;
