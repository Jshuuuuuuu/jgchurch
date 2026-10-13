-- LOCAL TEST ONLY: run against an EMPTY disposable PostgreSQL database.
-- Creates fake Supabase roles/auth fixtures. Never run in a real Supabase project.
\set ON_ERROR_STOP on
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
\ir ../supabase/migrations/001_initial_schema.sql
\ir ../supabase/migrations/002_super_admin_prayer_access.sql
insert into public.events(id,name) values('00000000-0000-4000-8000-000000000100','Existing Sunday');
\ir ../supabase/migrations/003_event_registration.sql

insert into auth.users(id) values
('00000000-0000-4000-8000-000000000101'),
('00000000-0000-4000-8000-000000000102'),
('00000000-0000-4000-8000-000000000103'),
('00000000-0000-4000-8000-000000000104');
insert into public.admin_profiles(id,display_name,role_id)
select ('00000000-0000-4000-8000-' || case name
  when 'super_admin' then '000000000101' when 'ministry_leader' then '000000000102'
  when 'prayer_team' then '000000000103' else '000000000104' end)::uuid,
  'Test ' || name, id from public.admin_roles;

set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}';
select public.create_event_with_qr('Midweek test','midweek_prayer','Test church',now()+interval '2 days',null,null,repeat('m',32));
select public.create_event_with_qr('Outing test','extracurricular','Test park',now()+interval '3 days',now()+interval '3 days 3 hours',null,repeat('e',32));
select public.create_event_with_qr('Sunday test','sunday_service',null,null,null,null,repeat('s',32));
select public.create_event_with_qr('Expired test','midweek_prayer','Test church',now()+interval '2 days',null,now()-interval '1 day',repeat('x',32));
reset role;

set role anon;
do $$ begin
  if (select count(*) from public.get_registration_event(repeat('m',32))) <> 1 then raise exception 'public metadata failed'; end if;
  if (select count(*) from public.get_registration_event(repeat('x',32))) <> 0 then raise exception 'expired metadata exposed'; end if;
  begin perform * from public.event_registrations; raise exception 'anonymous could read attendees'; exception when insufficient_privilege then null; end;
end $$;
select public.register_for_event(repeat('m',32),'00000000-0000-4000-8000-000000000201','Pickup tester',null,'pickup',true);
select public.register_for_event(repeat('m',32),'00000000-0000-4000-8000-000000000201','Pickup tester',null,'pickup',true);
select public.register_for_event(repeat('m',32),'00000000-0000-4000-8000-000000000202','Own transport tester',null,'own',true);
select public.register_for_event(repeat('e',32),'00000000-0000-4000-8000-000000000203','Outing tester','Messenger test',null,true);
do $$ begin
  begin perform public.register_for_event(repeat('e',32),gen_random_uuid(),'No contact',null,null,true); raise exception 'missing contact accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.register_for_event(repeat('m',32),gen_random_uuid(),'No consent',null,'own',false); raise exception 'missing consent accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.register_for_event(repeat('m',32),gen_random_uuid(),'No transport',null,null,true); raise exception 'missing transport accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.register_for_event(repeat('s',32),gen_random_uuid(),'Sunday attendee',null,'own',true); raise exception 'Sunday registration accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.register_for_event(repeat('x',32),gen_random_uuid(),'Expired attendee',null,'own',true); raise exception 'expired registration accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.submit_arc_reflection(repeat('m',32),'[{"type":"affirmation","ministryAreaId":"00000000-0000-4000-8000-000000000001","content":"Test feedback with enough characters"}]'); exception when raise_exception then if sqlerrm <> 'Invalid or expired Sunday Service token' then raise; end if; end;
end $$;
select public.submit_arc_reflection(repeat('s',32),'[{"type":"affirmation","ministryAreaId":"00000000-0000-4000-8000-000000000001","content":"Test feedback with enough characters"}]');
select public.submit_arc_reflection(null,'[{"type":"affirmation","ministryAreaId":"00000000-0000-4000-8000-000000000001","content":"Anonymous general feedback test"}]');
select public.submit_prayer_request(repeat('s',32),null,true,'Fictional prayer request test','Family','leader_only',null,false,false);
reset role;

set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.event_registrations) <> 0 then raise exception 'prayer team attendee leak'; end if;
  if (select count(*) from public.prayer_requests) <> 0 then raise exception 'prayer privacy regressed'; end if;
  begin perform public.create_event_with_qr('Forbidden','sunday_service',null,null,null,null,repeat('f',32)); raise exception 'prayer team created event'; exception when insufficient_privilege then null; end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000104","role":"authenticated"}';
do $$ begin if (select count(*) from public.event_registrations) <> 0 then raise exception 'membership attendee leak'; end if; end $$;
set request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated"}';
do $$ begin if (select count(*) from public.event_registrations) <> 3 then raise exception 'ministry leader read failed'; end if; end $$;
set request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.event_registrations) <> 3 then raise exception 'retry duplicated or super admin read failed'; end if;
  if (select count(*) from public.arc_submissions) <> 2 then raise exception 'ARC flow regressed'; end if;
  if (select count(*) from public.prayer_requests) <> 1 then raise exception 'prayer flow regressed'; end if;
  if (select event_type from public.events where id='00000000-0000-4000-8000-000000000100') <> 'sunday_service' then raise exception 'existing event lost'; end if;
end $$;
reset role;
update public.events set active=false where name='Midweek test';
set role anon;
do $$ begin
  if (select count(*) from public.get_registration_event(repeat('m',32))) <> 0 then raise exception 'inactive metadata exposed'; end if;
  begin perform public.register_for_event(repeat('m',32),gen_random_uuid(),'Inactive attendee',null,'own',true); raise exception 'inactive registration accepted'; exception when invalid_parameter_value then null; end;
end $$;
reset role;
select 'PASS: migration, registration, retries, validation, token checks, roles, existing Sunday and prayer flows' as result;
