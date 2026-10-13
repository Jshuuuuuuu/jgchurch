-- LOCAL EMPTY DISPOSABLE DATABASE ONLY. Never run in Supabase.
\set ON_ERROR_STOP on
\ir submission-controls.integration.sql
\ir ../supabase/migrations/005_active_qr_trash.sql

set role service_role;
select public.submit_arc_reflection(repeat('s',32),'[{"type":"affirmation","ministryAreaId":"00000000-0000-4000-8000-000000000001","content":"Active QR works on any day"}]');
do $$ begin
  begin perform public.submit_arc_reflection(null,'[]'); raise exception 'blank token accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.submit_arc_reflection(repeat('x',32),'[]'); raise exception 'expired token accepted'; exception when invalid_parameter_value then null; end;
end $$;
reset role;
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated"}';
do $$ begin
  begin perform public.list_trash(); raise exception 'Trash leaked'; exception when insufficient_privilege then null; end;
  begin perform public.set_record_trash('member','00000000-0000-4000-8000-000000000301',false); raise exception 'unauthorized trash'; exception when insufficient_privilege then null; end;
  begin update public.events set deleted_at=now(),active=false; raise exception 'direct trash bypass'; exception when insufficient_privilege then null; end;
  begin perform public.submit_arc_reflection(repeat('s',32),'[]'); raise exception 'browser RPC bypass'; exception when insufficient_privilege then null; end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}';
do $$ declare e uuid; q uuid; a uuid; p uuid; total integer;
begin
  select id,event_id into q,e from public.qr_tokens where token=repeat('s',32);
  select id into a from public.arc_entries limit 1;
  select id into p from public.prayer_requests limit 1;
  perform public.set_record_trash('event',e,false);
  if exists(select 1 from public.get_registration_event(repeat('s',32))) then raise exception 'trashed event public'; end if;
  begin perform public.set_link_active('event',e,true); raise exception 'activated trash'; exception when invalid_parameter_value then null; end;
  perform public.set_record_trash('event',e,true);
  if exists(select 1 from public.get_registration_event(repeat('s',32))) then raise exception 'restore silently activated'; end if;
  perform public.set_link_active('event',e,true);
  perform public.set_record_trash('qr',q,false);
  if exists(select 1 from public.get_registration_event(repeat('s',32))) then raise exception 'trashed QR public'; end if;
  perform public.set_record_trash('member','00000000-0000-4000-8000-000000000301',false);
  perform public.set_record_trash('arc',a,false);
  perform public.set_record_trash('prayer',p,false);
  select count(*) into total from public.list_trash();
  if total <> 4 then raise exception 'trash list missing records: %',total; end if;
  if not exists(select 1 from public.sunday_attendance where member_id='00000000-0000-4000-8000-000000000301') then raise exception 'attendance lost'; end if;
  perform public.set_record_trash('member','00000000-0000-4000-8000-000000000301',true);
  perform public.set_record_trash('arc',a,true);
  perform public.set_record_trash('prayer',p,true);
  perform public.set_record_trash('qr',q,true);
  perform public.set_link_active('qr',q,true);
  if not exists(select 1 from public.get_registration_event(repeat('s',32))) then raise exception 'restored QR unavailable'; end if;
  if exists(select 1 from public.list_trash()) then raise exception 'restored records still trashed'; end if;
  delete from public.members where id='00000000-0000-4000-8000-000000000301';
  if not exists(select 1 from public.members where id='00000000-0000-4000-8000-000000000301') then raise exception 'hard deletion allowed'; end if;
end $$;
reset role;
select 'PASS: active QR any day, Trash/restore all five kinds, authorization and preserved attendance' as result;
