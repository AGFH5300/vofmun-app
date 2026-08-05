# Auth bootstrap regression guard

This repository intentionally keeps the public login page visible in its server-rendered state and recovers a persisted Supabase session when `INITIAL_SESSION` is transiently null during token refresh. The CI check in `scripts/verify-auth-bootstrap.mjs` prevents either regression from returning.
