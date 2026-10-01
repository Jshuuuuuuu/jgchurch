# ARC — Church Feedback, Prayer Care & Membership

ARC is a production-oriented Next.js application for anonymous church reflections, consent-aware prayer requests, member administration, event QR codes, and role-restricted operations.

## Included

- Mobile-first public landing, ARC form with all seven category combinations, review, and confirmation
- Prayer form with anonymity, visibility, contact, and congregational-sharing consent controls
- Supabase Auth administration with Super Admin, Ministry Leader, Prayer Team, and Membership Admin roles
- Live dashboard counts and Recharts trends; ARC and prayer work queues; notes, statuses, audit events, filters, and CSV export
- Member directory with member numbers, search, status filters, multiple ministries, edit, and archive
- Event-specific expiring QR tokens and downloadable PNG files
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
