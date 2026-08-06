from pathlib import Path
import re

server_path = Path('server/chat/server.ts')
server = server_path.read_text()
server = server.replace(
    "const chatWriteRateLimit = createUserRateLimit(60_000, 40);\n",
    "const chatWriteRateLimit = createUserRateLimit(60_000, 40);\nconst chatReceiptRateLimit = createUserRateLimit(60_000, 240);\n",
    1,
)
server = server.replace(
    "app.post('/api/rooms/:roomId/receipts', chatWriteRateLimit, requireAuth, async (req: AuthedRequest, res: Response) => {",
    "app.post('/api/rooms/:roomId/receipts', chatReceiptRateLimit, requireAuth, async (req: AuthedRequest, res: Response) => {",
    1,
)
old_forward = """app.all('/api/chat/attachments/upload', (req: Request, res: Response) => {
  nextHandler(req, res);
});
"""
new_forward = """// These attachment handlers live in Next route files, while every /api/* request
// enters Express first. Forward the complete attachment API surface explicitly.
app.all(
  [
    '/api/chat/attachments/upload',
    '/api/chat/attachments/sign',
    '/api/chat/attachments/pending',
  ],
  (req: Request, res: Response) => {
    void nextHandler(req, res);
  },
);
"""
if old_forward not in server:
    raise SystemExit('Attachment API forwarding block missing')
server_path.write_text(server.replace(old_forward, new_forward, 1))

context_path = Path('app/messages/context/ChatContext.tsx')
context = context_path.read_text()
context = context.replace(
    "const RECEIPT_DEBOUNCE_MS = 300;\n",
    "const RECEIPT_DEBOUNCE_MS = 300;\nconst RECEIPT_FAILURE_BACKOFF_MS = 8_000;\n",
    1,
)
context = context.replace(
    "  const scheduledReceiptKeysRef = useRef<Map<string, string>>(new Map());\n",
    "  const scheduledReceiptKeysRef = useRef<Map<string, string>>(new Map());\n  const receiptFailureBackoffRef = useRef<Map<string, number>>(new Map());\n",
    1,
)

old_unread_merge = """      const serverUnreadCount = typeof room.unreadCount === 'number' ? Math.max(0, room.unreadCount) : 0;
      const localUnreadCount = unreadByRoomRef.current[normalizedRoomId];
      const rpcUnreadCount = authoritativeUnreadByRoom[normalizedRoomId];
      const mergedUnreadCount = Math.max(localUnreadCount ?? 0, serverUnreadCount, rpcUnreadCount ?? 0);
"""
new_unread_merge = """      const serverUnreadCount = typeof room.unreadCount === 'number' ? Math.max(0, room.unreadCount) : 0;
      const localUnreadCount = unreadByRoomRef.current[normalizedRoomId];
      const hasAuthoritativeUnreadCount = Object.prototype.hasOwnProperty.call(
        authoritativeUnreadByRoom,
        normalizedRoomId,
      );
      const authoritativeUnreadCount = hasAuthoritativeUnreadCount
        ? Math.max(0, Math.floor(authoritativeUnreadByRoom[normalizedRoomId] || 0))
        : null;
      const mergedUnreadCount = isRoomActivelyRead(normalizedRoomId)
        ? 0
        : authoritativeUnreadCount ?? Math.max(localUnreadCount ?? 0, serverUnreadCount);
"""
if old_unread_merge not in context:
    raise SystemExit('Unread merge block missing')
context = context.replace(old_unread_merge, new_unread_merge, 1)
context = context.replace(
    "  }, [fetchAuthoritativeUnreadCounts, fetchWithTimeout, getVisibleLastMessageForRoom, mergeUsersIntoDirectory, pinnedRoomIds, userId, withAuthHeaders]);",
    "  }, [fetchAuthoritativeUnreadCounts, fetchWithTimeout, getVisibleLastMessageForRoom, isRoomActivelyRead, mergeUsersIntoDirectory, pinnedRoomIds, userId, withAuthHeaders]);",
    1,
)

mark_pattern = re.compile(
    r"  const markReceipts = useCallback\(.*?\n  const flushScheduledReceipts = useCallback\(",
    re.S,
)
mark_match = mark_pattern.search(context)
if not mark_match:
    raise SystemExit('markReceipts/flushScheduledReceipts block missing')
replacement = """  const markReceipts = useCallback(
    async (roomId: string, messageIds: string[], markRead = false) => {
      if (!userId || messageIds.length === 0) return;

      const normalizedMessageIds = Array.from(new Set(messageIds.map((id) => String(id)))).sort();
      const receiptKey = getReceiptSignature(roomId, normalizedMessageIds, markRead);
      const dedupeScopeKey = `${roomId}|${markRead ? 'read' : 'delivered'}`;
      const blockedUntil = receiptFailureBackoffRef.current.get(dedupeScopeKey) || 0;
      if (blockedUntil > Date.now()) {
        logReceiptsDebug('receipt_post:backoff', {
          roomId,
          markRead,
          retryInMs: blockedUntil - Date.now(),
        });
        return;
      }
      if (postedReceiptKeysRef.current.get(dedupeScopeKey) === receiptKey || inFlightReceiptKeysRef.current.has(receiptKey)) {
        logReceiptsDebug('receipt_post:deduped', { roomId, markRead, messageIds: normalizedMessageIds });
        return;
      }

      inFlightReceiptKeysRef.current.add(receiptKey);
      const payload = { messageIds: normalizedMessageIds, markRead };
      logReceiptsDebug('receipt_post:request', { roomId, payload });
      try {
        const response = await fetch(`${CHAT_API_URL}/api/rooms/${roomId}/receipts`, await withAuthHeaders({
          method: 'POST',
          body: JSON.stringify(payload),
        }));
        const responseBody = await response
          .clone()
          .json()
          .catch(() => null);

        if (response.ok) {
          postedReceiptKeysRef.current.set(dedupeScopeKey, receiptKey);
          receiptFailureBackoffRef.current.delete(dedupeScopeKey);
          if (markRead) {
            setRoomUnreadCount(roomId, 0);
          }
        } else {
          const retryAfterSeconds = Number.parseInt(response.headers.get('Retry-After') || '', 10);
          const retryDelay = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
            ? retryAfterSeconds * 1000
            : RECEIPT_FAILURE_BACKOFF_MS;
          receiptFailureBackoffRef.current.set(dedupeScopeKey, Date.now() + retryDelay);
        }

        logReceiptsDebug('receipt_post:response', {
          roomId,
          status: response.status,
          ok: response.ok,
          body: responseBody,
        });
      } catch (error) {
        receiptFailureBackoffRef.current.set(dedupeScopeKey, Date.now() + RECEIPT_FAILURE_BACKOFF_MS);
        logReceiptsDebug('receipt_post:error', {
          roomId,
          markRead,
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        inFlightReceiptKeysRef.current.delete(receiptKey);
      }
    },
    [getReceiptSignature, setRoomUnreadCount, userId, withAuthHeaders]
  );

  const flushScheduledReceipts = useCallback("""
context = context[:mark_match.start()] + replacement + context[mark_match.end():]

old_flush_body = """    const deliveredIds = Array.from(queued.delivered);
    const readIds = Array.from(queued.read);

    scheduledReceiptKeysRef.current.delete(`${queued.roomId}|delivered`);
    scheduledReceiptKeysRef.current.delete(`${queued.roomId}|read`);

    if (deliveredIds.length > 0) {
      await markReceipts(queued.roomId, deliveredIds, false);
    }
    if (readIds.length > 0) {
      await markReceipts(queued.roomId, readIds, true);
    }
"""
new_flush_body = """    const readIds = Array.from(queued.read);
    const readIdSet = new Set(readIds);
    const deliveredOnlyIds = Array.from(queued.delivered).filter((id) => !readIdSet.has(id));

    scheduledReceiptKeysRef.current.delete(`${queued.roomId}|delivered`);
    scheduledReceiptKeysRef.current.delete(`${queued.roomId}|read`);

    // A read receipt also records delivery, so never post the same messages twice.
    if (readIds.length > 0) {
      await markReceipts(queued.roomId, readIds, true);
    }
    if (deliveredOnlyIds.length > 0) {
      await markReceipts(queued.roomId, deliveredOnlyIds, false);
    }
"""
if old_flush_body not in context:
    raise SystemExit('Receipt flush body missing')
context = context.replace(old_flush_body, new_flush_body, 1)

old_active_receipts = """    if (isActiveRoom) {
      scheduleReceiptsForMessages(normalizedRoomId, roomMessages, false);
      if (isRoomActivelyRead(normalizedRoomId)) {
        scheduleReceiptsForMessages(normalizedRoomId, roomMessages, true);
      }
    }
"""
new_active_receipts = """    if (isActiveRoom) {
      scheduleReceiptsForMessages(normalizedRoomId, roomMessages, false);
      if (isRoomActivelyRead(normalizedRoomId)) {
        setRoomUnreadCount(normalizedRoomId, 0);
        scheduleReceiptsForMessages(normalizedRoomId, roomMessages, true);
      }
    }
"""
if old_active_receipts not in context:
    raise SystemExit('Active-room receipt scheduling block missing')
context = context.replace(old_active_receipts, new_active_receipts, 1)
context = context.replace(
    "    scheduleReceiptsForMessages,\n    upsertRoomMessage,\n",
    "    scheduleReceiptsForMessages,\n    setRoomUnreadCount,\n    upsertRoomMessage,\n",
    1,
)

old_select_active = """      setActiveRoom(roomsRef.current.find((candidate) => toComparableId(candidate.id) === normalizedRoomId) || { ...room, id: normalizedRoomId });
      if (!messagesRef.current[normalizedRoomId]) {
"""
new_select_active = """      setActiveRoom(roomsRef.current.find((candidate) => toComparableId(candidate.id) === normalizedRoomId) || { ...room, id: normalizedRoomId });
      setRoomUnreadCount(normalizedRoomId, 0);
      if (!messagesRef.current[normalizedRoomId]) {
"""
if old_select_active not in context:
    raise SystemExit('selectRoom active-room block missing')
context = context.replace(old_select_active, new_select_active, 1)
context = context.replace(
    "    [ensureRoomSubscriptions, joinSocketRooms, refreshRoomMessages, sendTyping]\n  );",
    "    [ensureRoomSubscriptions, joinSocketRooms, refreshRoomMessages, sendTyping, setRoomUnreadCount]\n  );",
    1,
)
context_path.write_text(context)

smoke_path = Path('scripts/smoke-next-hmr.mjs')
smoke = smoke_path.read_text()
insertion_marker = "  console.log('Authenticated profile endpoint routing smoke test passed.');\n\n"
protected_checks = """  console.log('Authenticated profile endpoint routing smoke test passed.');

  const protectedChatEndpoints = [
    { path: '/api/chat/attachments/upload', init: { method: 'POST' } },
    {
      path: '/api/chat/attachments/sign',
      init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    },
    {
      path: '/api/chat/attachments/pending',
      init: { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    },
    {
      path: '/api/rooms/00000000-0000-4000-8000-000000000001/receipts',
      init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageIds: [] }) },
    },
  ];

  for (const endpoint of protectedChatEndpoints) {
    const response = await fetch(`${origin}${endpoint.path}`, { ...endpoint.init, cache: 'no-store' });
    const contentType = response.headers.get('content-type') || '';
    const payload = await response.json().catch(() => null);
    if (response.status !== 401 || !contentType.includes('application/json') || payload?.error !== 'Unauthorized') {
      throw new Error(`${endpoint.path} is not routed through its authenticated JSON handler: ${response.status} ${contentType} ${JSON.stringify(payload)}`);
    }
  }
  console.log('Attachment and receipt API routing smoke tests passed.');

"""
if insertion_marker not in smoke:
    raise SystemExit('Smoke test insertion marker missing')
smoke_path.write_text(smoke.replace(insertion_marker, protected_checks, 1))

verify_path = Path('scripts/verify-auth-bootstrap.mjs')
verify = verify_path.read_text()
verify += """

const chatContextSource = fs.readFileSync('app/messages/context/ChatContext.tsx', 'utf8');
const footerSource = fs.readFileSync('components/ui/site-footer.tsx', 'utf8');

for (const endpoint of [
  '/api/chat/attachments/upload',
  '/api/chat/attachments/sign',
  '/api/chat/attachments/pending',
]) {
  if (!serverSource.includes(endpoint)) {
    throw new Error(`Unified server does not forward ${endpoint} to its Next route handler.`);
  }
}

if (!serverSource.includes('chatReceiptRateLimit') || !serverSource.includes("app.post('/api/rooms/:roomId/receipts', chatReceiptRateLimit")) {
  throw new Error('Receipt writes still share the low-volume generic chat write limit.');
}

if (!chatContextSource.includes('RECEIPT_FAILURE_BACKOFF_MS') || !chatContextSource.includes('receiptFailureBackoffRef')) {
  throw new Error('Receipt failures can still create an unbounded retry loop.');
}

if (!chatContextSource.includes('deliveredOnlyIds') || !chatContextSource.includes('isRoomActivelyRead(normalizedRoomId)')) {
  throw new Error('Receipt batching or active-room unread clearing has regressed.');
}

if (!smokeSource.includes('Attachment and receipt API routing smoke tests passed.')) {
  throw new Error('CI does not exercise every attachment route and the receipt route through the unified server.');
}

if (/href=[\"']vofmun\.org\//.test(footerSource)) {
  throw new Error('Footer still contains relative vofmun.org links that trigger local Next prefetch 404s.');
}
"""
verify_path.write_text(verify)

footer_path = Path('components/ui/site-footer.tsx')
footer = footer_path.read_text()
footer = footer.replace('import Link from "next/link";\n', '')
footer = re.sub(
    r'<Link href="vofmun\.org/([^\"]+)" className="([^"]+)">([\s\S]*?)</Link>',
    lambda match: f'<a href="https://vofmun.org/{match.group(1)}" className="{match.group(2)}">{match.group(3)}</a>',
    footer,
)
footer = footer.replace('<Link\n                  href="vofmun.org/proof-of-payment"', '<a\n                  href="https://vofmun.org/proof-of-payment"')
footer = footer.replace('</Link>', '</a>')
footer = footer.replace('<Link\n                  href="https://www.linkedin.com/company/vofmun"', '<a\n                  href="https://www.linkedin.com/company/vofmun"')
footer = footer.replace('<Link\n                  href="https://www.instagram.com/vofmun"', '<a\n                  href="https://www.instagram.com/vofmun"')
if 'href="vofmun.org/' in footer or '<Link' in footer or '</Link>' in footer:
    raise SystemExit('Footer link conversion incomplete')
footer_path.write_text(footer)

migration_path = Path('supabase/migrations/20260806160000_fix_service_role_message_receipts.sql')
migration_path.write_text("""-- Allow the unified server's verified service-role request to persist receipts
-- while preserving the authenticated-user and room-membership checks.
create or replace function public.mark_message_receipts(
  p_room_id uuid,
  p_message_ids uuid[],
  p_user_id character varying,
  p_mark_read boolean default false
)
returns setof uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id text := auth.uid()::text;
  jwt_role text := coalesce(auth.jwt() ->> 'role', nullif(current_setting('request.jwt.claim.role', true), ''));
  now_json jsonb := to_jsonb(now()::text);
  delivered_path text[];
  read_path text[];
begin
  if jwt_role = 'service_role' then
    caller_id := p_user_id::text;
  elsif caller_id is null or p_user_id::text is distinct from caller_id then
    raise exception 'Cannot update receipts for another user' using errcode = '42501';
  end if;

  if caller_id is null then
    raise exception 'Receipt user is required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id::text = caller_id
  ) then
    raise exception 'User is not a member of this room' using errcode = '42501';
  end if;

  delivered_path := array['receipts', 'delivered', caller_id];
  read_path := array['receipts', 'read', caller_id];

  return query
  update public.messages m
  set meta = case
    when p_mark_read then (
      with base as (
        select coalesce(m.meta, '{}'::jsonb) as meta0
      ), delivered as (
        select case
          when (meta0 #> delivered_path) is null then jsonb_set(meta0, delivered_path, now_json, true)
          else meta0
        end as meta1
        from base
      )
      select case
        when (meta1 #> read_path) is null then jsonb_set(meta1, read_path, now_json, true)
        else meta1
      end
      from delivered
    )
    else (
      with base as (
        select coalesce(m.meta, '{}'::jsonb) as meta0
      )
      select case
        when (meta0 #> delivered_path) is null then jsonb_set(meta0, delivered_path, now_json, true)
        else meta0
      end
      from base
    )
  end
  where m.room_id = p_room_id
    and m.id = any(p_message_ids)
    and m.user_id::text <> caller_id
  returning m.id;
end;
$$;

revoke all on function public.mark_message_receipts(uuid, uuid[], character varying, boolean) from public;
revoke all on function public.mark_message_receipts(uuid, uuid[], character varying, boolean) from anon;
grant execute on function public.mark_message_receipts(uuid, uuid[], character varying, boolean) to authenticated;
grant execute on function public.mark_message_receipts(uuid, uuid[], character varying, boolean) to service_role;
""")
