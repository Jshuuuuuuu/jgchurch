-- LOCAL TEST ONLY: empty disposable PostgreSQL database. NEVER run on Supabase.
\set ON_ERROR_STOP on
\ir events.integration.sql
do $$ begin
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public, auth to service_role;
\ir ../supabase/migrations/004_submission_controls_attendance.sql

insert into public.members(id,first_name,last_name,contact_number)
values('00000000-0000-4000-8000-000000000301','Attendance','Tester','TEST ONLY');

set role anon;
do $$ begin
  begin perform * from public.sunday_attendance; raise exception 'anonymous attendance leak'; exception when insufficient_privilege then null; end;
  begin perform public.submit_arc_reflection(repeat('s',32),'[]'); raise exception 'public ARC RPC bypass'; exception when insufficient_privilege then null; end;
  begin perform public.submit_prayer_request(repeat('s',32),null,true,'Fictional prayer','Family','leader_only',null,false,false); raise exception 'public prayer RPC bypass'; exception when insufficient_privilege then null; end;
  begin perform public.register_for_event(repeat('e',32),gen_random_uuid(),'Test','Test contact',null,true); raise exception 'public registration bypass'; exception when insufficient_privilege then null; end;
  begin perform public.check_public_rate_limit(repeat('a',64),'arc',8,15); raise exception 'public rate-limit bypass'; exception when insufficient_privilege then null; end;
  begin perform arc_private.submit_arc_reflection(null,'[]'); raise exception 'private schema exposed'; exception when insufficient_privilege then null; end;
end $$;
reset role;

set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}';
do $$ begin
  begin perform public.submit_prayer_request(repeat('s',32),null,true,'Fictional prayer','Family','leader_only',null,false,false); raise exception 'authenticated prayer bypass'; exception when insufficient_privilege then null; end;
  begin perform public.submit_arc_reflection(repeat('s',32),'[]'); raise exception 'authenticated ARC bypass'; exception when insufficient_privilege then null; end;
  begin perform public.register_for_event(repeat('e',32),gen_random_uuid(),'Test','Test contact',null,true); raise exception 'authenticated registration bypass'; exception when insufficient_privilege then null; end;
end $$;

set request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000104","role":"authenticated"}';
do $$ declare sunday date := (statement_timestamp() at time zone 'Asia/Manila')::date;
begin
  sunday := sunday - (extract(isodow from sunday)::int % 7);
  perform public.save_sunday_attendance('00000000-0000-4000-8000-000000000301',sunday,true);
  if not (select present from public.sunday_attendance where member_id='00000000-0000-4000-8000-000000000301' and sunday_date=sunday) then raise exception 'present not saved'; end if;
  perform public.save_sunday_attendance('00000000-0000-4000-8000-000000000301',sunday,false);
  if (select count(*) from public.sunday_attendance) <> 1 then raise exception 'duplicate attendance'; end if;
  if (select present from public.sunday_attendance where member_id='00000000-0000-4000-8000-000000000301' and sunday_date=sunday) then raise exception 'absence correction failed'; end if;
  begin perform public.save_sunday_attendance('00000000-0000-4000-8000-000000000301',sunday+1,true); raise exception 'weekday attendance accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.save_sunday_attendance('00000000-0000-4000-8000-000000000301',sunday+7,true); raise exception 'future attendance accepted'; exception when invalid_parameter_value then null; end;
  begin update public.sunday_attendance set present=true; raise exception 'direct write bypass'; exception when insufficient_privilege then null; end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.sunday_attendance) <> 0 then raise exception 'prayer team attendance leak'; end if;
  begin perform public.save_sunday_attendance('00000000-0000-4000-8000-000000000301','2026-10-11',true); raise exception 'prayer team attendance write'; exception when insufficient_privilege then null; end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.sunday_attendance) <> 0 then raise exception 'ministry leader attendance leak'; end if;
  begin perform public.save_sunday_attendance('00000000-0000-4000-8000-000000000301','2026-10-11',true); raise exception 'ministry leader attendance write'; exception when insufficient_privilege then null; end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.sunday_attendance) <> 1 then raise exception 'super admin attendance read failed'; end if;
  if (select count(*) from public.audit_logs where action='attendance_recorded') <> 2 then raise exception 'attendance audit missing'; end if;
end $$;
reset role;

set role service_role;
do $$ begin
  begin perform public.submit_prayer_request(null,null,true,'Fictional prayer test','Family','leader_only',null,false,false); raise exception 'missing prayer QR accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.submit_prayer_request(repeat('x',32),null,true,'Fictional prayer test','Family','leader_only',null,false,false); raise exception 'expired prayer QR accepted'; exception when invalid_parameter_value then null; end;
  if extract(isodow from statement_timestamp() at time zone 'Asia/Manila') <> 7 then
    begin perform public.submit_arc_reflection(repeat('s',32),'[{"type":"affirmation","ministryAreaId":"00000000-0000-4000-8000-000000000001","content":"This must not save on a weekday"}]'); raise exception 'weekday ARC accepted'; exception when invalid_parameter_value then null; end;
  else
    perform public.submit_arc_reflection(repeat('s',32),'[{"type":"affirmation","ministryAreaId":"00000000-0000-4000-8000-000000000001","content":"Valid Sunday feedback test"}]');
    begin perform public.submit_arc_reflection(null,'[]'); raise exception 'missing ARC QR accepted'; exception when invalid_parameter_value then null; end;
  end if;
end $$;
select public.submit_prayer_request(repeat('s',32),null,true,'Week-round prayer test','Family','leader_only',null,false,false);
select public.register_for_event(repeat('e',32),gen_random_uuid(),'Server registration','Test contact',null,true);
select public.check_public_rate_limit(repeat('a',64),'arc',8,15);
reset role;
select 'PASS: server-only writes, QR checks, Sunday schedule, attendance authorization, updates and audit' as result;
