# ARC — Church Feedback, Prayer Care & Membership

ARC is a production-oriented Next.js application for anonymous church reflections, consent-aware prayer requests, member administration, event QR codes, and role-restricted operations.

## Included

- Mobile-first public landing, ARC form with all seven category combinations, review, and confirmation
- Prayer form with anonymity, visibility, contact, and congregational-sharing consent controls
- Supabase Auth administration with Super Admin, Ministry Leader, Prayer Team, and Membership Admin roles
- Live dashboard counts and Recharts trends; ARC and prayer work queues; notes, statuses, audit events, filters, and CSV export
- Member directory with member numbers, search, status filters, multiple ministries, edit, and archive
- Event-specific expiring QR tokens and downloadable PNG files
- Sunday Service ARC + Prayer, Midweek Prayer advance registration with transport choice, and Extracurricular registration with logistics contact
- PostgreSQL schema, indexes, constraints, RPCs, row-level security, rate limiting, and retention helper
- Zod validation, honeypot/timing bot checks, optional Cloudflare Turnstile, secure headers, and no application-controlled IP logging

## Local setup

Requirements: Node.js 20 or 22 LTS, npm, a Supabase project, and optionally the Supabase CLI.

1. Install dependencies: `npm install`.
2. Copy `.env.example` to `.env.local` and fill in the Supabase project URL and publishable/anon key. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only; it is needed for administrator invitations, not normal public use.
3. Apply [the migration](supabase/migrations/001_initial_schema.sql) with `supabase link --project-ref YOUR_PROJECT_REF` followed by `supabase db push`. The same SQL can be run once in the Supabase SQL Editor.
4. In Supabase Authentication, create the first user. Bootstrap only that user as Super Admin in the SQL Editor:

   ```sql
   insert into public.admin_profiles (id, display_name, role_id)
   select 'AUTH_USER_UUID', 'Administrator', id
   from public.admin_roles where name = 'super_admin';
   ```

5. In Authentication → URL Configuration, set the local Site URL to `http://localhost:3000`, add `http://localhost:3000/auth/callback` as a redirect URL, and add the production equivalents later.
6. Run `npm run dev`. Visit `http://localhost:3000` or `/admin/login`.

## Security and privacy notes

Anonymous ARC rows intentionally contain no name, email, member, account, or IP fields. Public clients cannot insert directly; narrowly scoped database functions validate inputs and event tokens. Prayer content has stricter RLS than aggregate analytics. Rate limiting uses a random HttpOnly browser-session identifier that is SHA-256 hashed before storage, not an IP address.

Cloudflare Turnstile is optional locally. For production, set both Turnstile variables. Access/QR tokens reduce casual misuse but cannot guarantee anonymity or eliminate all spam. Choose documented retention periods and schedule `apply_retention` only after reviewing pastoral, legal, and Philippine Data Privacy Act obligations. Obtain local privacy/legal review before production.

## Verification

### Event registration upgrade

Apply migrations in order: `001_initial_schema.sql`, `002_super_admin_prayer_access.sql`, then `003_event_registration.sql`. For an existing installation that already applied 001/002, run **only 003** in Supabase SQL Editor. This upgrade preserves existing events as Sunday Service and leaves all feedback/prayer/member records intact. New code needs migration 003 before event links and the event manager work.

In **Events**, choose the event type before creating its QR. Midweek and Extracurricular events require location and start date/time; Extracurricular also requires an end for duration. All event times are interpreted as Philippine time, independently of the hosting timezone. QR expiry is separate from event end. Midweek pickup is fixed at **6 PM on the event date**, not the prayer start; exceptions and pickup locations are coordinated personally.

Registration means “I'm coming / I want to join,” not an arrival check-in. Midweek contact is optional (even for pickup); Extracurricular contact is required for logistics. A participant consents to organizer use of their details; group-chat invitations are manual, not a Messenger integration. Only active Super Admin and Ministry Leader accounts can read attendee lists, via **Events → event details**. Prayer content remains Super Admin-only. Registrations neither create members nor change ARC/prayer dashboard counts.

Use **Open participant link** to test without scanning on another device. Retry of the same form uses an idempotency key; a fresh form can create another registration. No public attendee directory is exposed. The registration API uses the existing timing/honeypot, optional Turnstile, and session rate-limit protections. These API checks do not prevent clients calling the public database registration RPC directly; assess production abuse controls before public launch. Attendance retention is not included in the existing ARC/prayer retention helper.

Manual checks after applying 003:

1. Existing Sunday QR still opens ARC + Prayer; non-event anonymous submissions still work.
2. Midweek QR shows location/schedule first. Register with own transportation, then another test name with pickup and no contact. Confirm the 6 PM pickup notice and both rows in event details.
3. Extracurricular QR shows date/location/duration. Missing contact or consent blocks submission. A valid registration displays the manual group-chat confirmation and appears in event details.
4. Inactive/expired QR links do not offer registration. A repeated request with the same request key creates only one row.
5. Signed-out users, Prayer Team, and Membership Admin cannot read attendance details. Super Admin and Ministry Leader can. Test both the UI and database RLS against disposable test records.

For repeatable database checks, `tests/events.integration.sql` bootstraps mock auth roles and applies all migrations to an **empty, disposable local PostgreSQL database**. Run with `psql -v ON_ERROR_STOP=1 -d YOUR_EMPTY_TEST_DATABASE -f tests/events.integration.sql`. Never run this test fixture in Supabase or a database containing real data. It checks role restrictions, expired/inactive links, consent, event-type validation, idempotent registration, and preservation of Sunday ARC/prayer behavior.

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

Tests cover all seven ARC combinations, consent validation, anonymous schema invariants, and sensitive-table RLS declarations. A live Supabase project is still required for end-to-end authentication/RLS integration testing.

## Vercel deployment

1. Push the repository to a Git provider and import it into Vercel.
2. Add every value from `.env.example` under Project Settings → Environment Variables. Set `NEXT_PUBLIC_APP_URL` to the canonical HTTPS URL.
3. Apply the migration to the production Supabase project and add the production callback URL to Supabase Auth.
4. Deploy with the default Next.js preset.
5. Smoke-test an event QR, an anonymous ARC submission, each prayer visibility, every role, CSV downloads, and archive operations.

No successful external database connection is claimed by this repository alone. Until valid Supabase credentials and the migration are present, public submission endpoints return a service-unavailable response and admin login shows a setup notice.
