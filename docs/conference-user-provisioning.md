# VOFMUN conference user provisioning

VOFMUN ONE is invitation-only. Use the consolidated conference user manager for the first administrator, QA cohorts, bulk conference invitations, retrying failed rows, reconciliation, and exact QA cleanup.

## 1. Local secrets

Create `.env.local` in the repository root. Never commit it.

```dotenv
SUPABASE_URL=https://gqymcyupsfemseybtmle.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace-with-the-server-only-key
```

If the complete service-role key has ever been pasted into a committed file, browser bundle, public log, or public message, rotate it in Supabase before continuing.

## 2. Prepare the roster

Copy `scripts/conference-users.example.csv` into `.private/` and replace every `example.com` address. The command deliberately rejects the placeholder domain.

Required columns:

| Column | Delegate | Chair | Admin/Secretariat |
|---|---|---|---|
| `email` | Required | Required | Required |
| `first_name`, `last_name` | Required | Required | Required |
| `role` | `delegate` | `chair` | `admin` / `secretariat` |
| `committee_code` | Required | Required | Blank |
| `country` | Published matrix country | Blank | Blank |
| `school` | Required | Blank | Blank |
| `grade` | Optional | Blank | Blank |

Only one delegate may occupy a committee/country seat. Multiple chairs may share one committee, but every chair is locked to exactly one committee.

## 3. Read-only preflight

```bash
npm run conference:users -- preflight --roster .private/conference-roster.csv
```

Preflight validates CSV structure, duplicate emails, role fields, committee codes, matrix countries, occupied seats, Auth users, `app_users`, and every legacy role table. It makes no writes.

## 4. Provision QA users in the same Supabase project

The QA roster must not contain the permanent administrator if that account should survive cleanup.

```bash
npm run conference:users -- provision \
  --mode qa \
  --roster .private/qa-roster.csv \
  --redirect-to https://YOUR-STABLE-PREVIEW/reset-password \
  --emails-per-hour 25 \
  --apply \
  --confirm-project gqymcyupsfemseybtmle \
  --confirm-count 8
```

The preview URL must be allow-listed in Supabase Auth Redirect URLs. Use a stable URL: an invitation already sent to an expired development URL cannot be repaired by changing the configuration later.

## 5. Provision actual conference users

Set up and test custom SMTP first. Set `--emails-per-hour` at or below the configured Supabase Auth and SMTP quota.

```bash
npm run conference:users -- provision \
  --mode production \
  --roster .private/conference-roster.csv \
  --redirect-to https://app.vofmun.org/reset-password \
  --emails-per-hour 100 \
  --apply \
  --confirm-project gqymcyupsfemseybtmle \
  --confirm-count 125 \
  --confirm-production VOFMUN-2026
```

The count must exactly match the CSV row count. Change `125` to the displayed preflight count. Re-running the same command is the retry mechanism: complete identities are skipped, incomplete identities are repaired, and only missing Auth users receive new email invitations.

Each successful row is verified across:

1. Supabase Auth
2. The role-specific legacy table
3. `app_users`

If a new Auth invitation is created but profile provisioning fails, the new Auth user and partial profile are rolled back. The email link will be invalid and the failed row can be retried after fixing the reported cause.

## 6. Invitation status and reconciliation

```bash
npm run conference:users -- status \
  --mode production \
  --roster .private/conference-roster.csv
```

The report includes invitation, confirmation and last-sign-in timestamps. Reports and provisioning logs are written with restricted permissions under `.private/conference-user-logs/`.

## 7. Exact QA cleanup

QA cleanup uses a separate email-only allowlist, for example `.private/qa-cleanup.csv`:

```csv
email
qa.delegate.one@yourdomain.org
qa.delegate.two@yourdomain.org
```

It independently reads each target's live role and refuses to delete administrators. It deletes only identities whose normalized emails appear in the supplied cleanup file. Test-created chat rooms are deleted only when every room member belongs to the same exact allowlist; otherwise the command stops.

```bash
npm run conference:users -- cleanup-test \
  --mode qa \
  --roster .private/qa-cleanup.csv
```

The first command is read-only and prints every target email/UUID, application and legacy profile, room ID, and Storage-object path. Apply the deletion only after reviewing that exact preview:

```bash
npm run conference:users -- cleanup-test \
  --mode qa \
  --roster .private/qa-cleanup.csv \
  --apply \
  --confirm-project gqymcyupsfemseybtmle \
  --confirm-count 8 \
  --confirm-cleanup DELETE-QA-USERS
```

The command removes owned attachment objects before database metadata, deletes QA-created chat data and social rows, deletes legacy and application profiles, deletes Auth users last, and verifies that the target identities are gone.

## Conference sequence

1. Back up Supabase.
2. Bootstrap the permanent primary admin with a one-row production roster.
3. Invite and verify a second admin and secretariat.
4. Run the QA cohort, complete role acceptance testing, then clean it with the exact QA roster.
5. Invite chairs and complete committee-specific training.
6. Dry-run the final delegate roster.
7. Send a 10-person delivery wave, then controlled larger waves.
8. Run `status` after every wave and one day before the conference.
