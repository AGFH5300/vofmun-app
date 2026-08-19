# API and chat runtime contract

VOFMUN production runs the unified server in `server/chat/server.ts`.

## Express-owned routes

Express owns chat rooms, people search, friend requests, messages, members, receipts, room lifecycle, and `/chat-ws`. These routes authenticate the Supabase bearer token and use the server-only Supabase client.

## Next-owned routes forwarded by Express

Every Next route below must appear in the explicit forwarding list in `server/chat/server.ts`:

- `/api/health`
- `/api/auth/profile`
- `/api/delegates`
- `/api/notifications`
- `/api/conference`
- `/api/admin/support-requests`
- `/api/admin/notifications`
- `/api/admin/users`
- `/api/upload-image`
- `/api/chat/attachments/upload`
- `/api/chat/attachments/sign`
- `/api/chat/attachments/pending`

Do not add route handlers under `server/api`; that directory is not registered by Next or Express.

## Receipt behavior

Read receipts are persisted only for the bearer-token user after room-membership verification. A read receipt also counts as delivery.

The client retries only transient failures:

- network errors
- HTTP 429
- HTTP 5xx

Permanent client failures such as 400, 401, 403, 404, and 409 are discarded rather than requeued indefinitely.

The readiness workflow tests these route boundaries before every release.
