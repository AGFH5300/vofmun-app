# VOFMUN ONE

VOFMUN ONE is the authenticated conference operations application for Voices of the Future Model United Nations.

It supports provisioned participant accounts, committee-scoped chair controls, resolutions, speech preparation, messaging, live announcements, conference schedules, crisis briefings, notifications, and participant support.

## Chair Command

Every chair is assigned to one committee by an admin. The chair workspace includes the VOFMUN 2026 country matrix, delegate school/grade details, roll call, quick contribution tallies, six-part scoring, award tracking, persistent session/speaker/caucus timers, GSL and moderated-caucus queues, motions, roll-call voting, resolution permissions, and a session activity timeline. Multiple chairs assigned to the same committee share the same versioned session state.

## Account access

Accounts are intentionally invitation-only. There is no public application signup. Admin and secretariat users provision accounts from the in-app Admin Control Centre.

## Local development

Requirements:

- Node.js 22
- npm
- A Supabase project with the committed migrations applied

```bash
cp .env.example .env.local
npm ci
npm run dev
```

The production command starts the unified Next.js, Express, and WebSocket server:

```bash
npm run build
npm start
```

## Verification

```bash
npm test
npm run verify:release
npm run verify:database
npx tsc --noEmit
npm run lint
npm run build
```

Deployment, database, role-by-role acceptance, monitoring, and rollback instructions are in [docs/operations-runbook.md](docs/operations-runbook.md).

## License

Copyright © 2026 Ansh Gupta. All rights reserved.

This repository is publicly viewable for reference only. Copying, reuse, modification, redistribution, deployment, and derivative works are prohibited without written permission. Contact: dxb.avg@gmail.com.

