# VOFMUN ONE operations runbook

## Account model

VOFMUN ONE is invitation-only. There is intentionally no public signup route.

Administrators and secretariat members provision accounts from **Admin → Users**. The server sends a Supabase invitation, creates the matching legacy conference identity, and creates the canonical `app_users` profile. Delegates and chairs must be assigned to a committee.

Before inviting users, configure the Supabase Auth Site URL and `APP_URL` / `NEXT_PUBLIC_APP_URL` to the deployed application origin. Invitation and recovery links return to `/reset-password`.

For first-admin bootstrap, same-project QA cohorts, conference CSV validation, bulk invitations, reconciliation, retries, and exact QA cleanup, follow [`docs/conference-user-provisioning.md`](conference-user-provisioning.md). The consolidated command defaults to read-only preflight and requires explicit project, row-count, and production confirmations before writes.

## Required environment

Copy `.env.example` and provide:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for browser Auth, Realtime, and permitted Data API reads.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for server-only APIs.
- `APP_URL` for invitation redirects.
- `PORT` for the unified Next.js, Express, and WebSocket server.

Never place a service-role or secret key in a `NEXT_PUBLIC_` variable.

## Database deployment

Apply every file in `supabase/migrations` in filename order. The first migration is a clean-project schema contract; later migrations are idempotent hardening and operational additions.

After applying migrations:

1. Run Supabase Database Linter/Security Advisor and resolve all errors.
2. Confirm the `Updates` bucket is public and limited to JPEG, PNG, and WebP up to 8 MB.
3. Confirm `chat-attachments` is private and limited to 25 MB.
4. Verify Data API grants and RLS separately. Operational tables are deliberately server-only.
5. Regenerate `db/supabase-database.types.ts` from the deployed project if the schema changes.

CI applies the full migration chain to a clean PostgreSQL 16 service with Supabase-compatible auth/storage stubs. This catches ordering, syntax, missing-object, and dependency failures.

## Release verification

Run:

```bash
npm ci
npm test
npm run verify:release
npm run verify:database
npx tsc --noEmit
npm run lint
npm run build
npm audit --omit=dev
```

Then perform an authenticated acceptance test for each role:

- Delegate: home, live notifications, support request, messages, resolutions, speeches.
- Chair: committee delegate list, resolution permission changes, messages, speeches.
- Secretariat/Admin: account invitation, support status changes, notification targeting, conference schedule, crisis briefing, live-update image publishing.
- Password recovery/invitation: email link lands on `/reset-password` and the new password can sign in.

## Health and monitoring

`GET /api/health` returns HTTP 200 only when the server and database are available. Configure the hosting provider to check this endpoint.

Application logs use bounded context and never log access tokens, service keys, message content, or uploaded file bytes. Alert on repeated health-check failures and sustained 5xx responses.

## Rollback

- Application: redeploy the previous known-good commit.
- Database: migrations are additive and security-oriented. Take a Supabase database backup before release; restore from that backup for data-level rollback rather than editing applied migration history.
- Storage: failed live-update writes remove the uploaded object automatically.


## Chair Command acceptance

1. In Admin Control Centre → Users, assign every chair to exactly one committee.
2. Provision delegates with a country from that committee's published matrix and their school.
3. Sign in as each chair and confirm only the assigned committee is visible.
4. Verify session, speaker, and caucus timers persist after refresh.
5. Add delegates to both speakers lists, advance and complete a speaker, and confirm the activity timeline.
6. Record roll call, quick tallies, assessment scores, notes, and award tracking.
7. Add and resolve a motion, run a roll-call vote, then confirm a second chair sees the saved state within the polling window.
8. Confirm an attempted cross-committee delegate or committee request is rejected.

The chair tables are server-only Data API surfaces: public, anon, and authenticated grants are revoked, RLS is enabled for defense in depth, and the verified server route performs the committee authorization check.
