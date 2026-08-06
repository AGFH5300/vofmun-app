# Chat runtime contract

The unified VOFMUN server owns the chat WebSocket and forwards attachment route handlers to Next.js.

Protected chat endpoints must always return structured JSON authentication errors rather than Express HTML 404 pages:

- `POST /api/chat/attachments/upload`
- `POST /api/chat/attachments/sign`
- `DELETE /api/chat/attachments/pending`
- `POST /api/rooms/:roomId/receipts`

Read receipts are persisted only for the bearer-token user after room membership verification. A read receipt also counts as delivery. The client deduplicates receipt batches, backs off after server failures, and treats an open visible room as read immediately.

The readiness smoke test exercises these route boundaries before each release.