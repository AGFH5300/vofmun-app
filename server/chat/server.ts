// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
import express, { NextFunction, Request, Response } from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import next from 'next';
import supabaseAdmin from '../../lib/supabaseAdmin.ts';
import { getSessionUserFromCookieHeader } from '../../lib/chat/auth.ts';
import {
  ChatSocketPayload,
  FriendRequest,
  MessageWithUser,
  RoomMember,
  RoomWithDetails,
  RoomType,
  User,
} from '../../lib/chat/types.ts';
import { fetchPersonById, getUserContext, isVisibleToViewer, searchPeople } from './people.ts';
import dotenv from 'dotenv';

dotenv.config();

interface AuthedRequest extends Request {
  userId?: string;
}

interface SocketContext {
  userId: string;
  roomId?: string;
  socket: WebSocket;
}

const app = express();
app.use(express.json());

if (!supabaseAdmin) {
  throw new Error('Supabase admin client is not configured. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

const requireAuth = (req: AuthedRequest, res: Response, nextFn: NextFunction) => {
  const sessionUser = getSessionUserFromCookieHeader(req.headers.cookie || '');
  if (!sessionUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.userId = sessionUser.id;
  return nextFn();
};

const fetchRoomMemberUserIds = async (roomId: string): Promise<string[]> => {
  const { data, error } = await supabaseAdmin.from('room_members').select('user_id').eq('room_id', roomId).limit(200);
  if (error) {
    console.error('[chat] failed to fetch room member user ids', { roomId, error: error.message || error });
    return [];
  }
  return (data || []).map((row: any) => String(row.user_id)).filter(Boolean);
};

const activeSockets = new Set<SocketContext>();
const CHAT_SERVER_DEBUG_PREFIX = '[ChatServerDebug]';
const isServerDebugEnabled = process.env.CHAT_SERVER_DEBUG === '1' || process.env.NODE_ENV !== 'production';
const isReceiptsDebugEnabled = process.env.CHAT_RECEIPTS_DEBUG === '1';
const userConnectionCounts = new Map<string, number>();

const logServerDebug = (message: string, details?: Record<string, unknown>) => {
  if (!isServerDebugEnabled) return;
  if (details) {
    console.warn(`${CHAT_SERVER_DEBUG_PREFIX} ${message}`, details);
    return;
  }
  console.warn(`${CHAT_SERVER_DEBUG_PREFIX} ${message}`);
};

const getOnlineUserIds = () =>
  Array.from(userConnectionCounts.entries())
    .filter(([, count]) => count > 0)
    .map(([userId]) => userId);

const sendOnlineUsersSnapshot = (target: WebSocket) => {
  target.send(
    JSON.stringify({ type: 'online_users', onlineUserIds: getOnlineUserIds() } satisfies ChatSocketPayload)
  );
};

const incrementUserConnection = (userId: string) => {
  const nextCount = (userConnectionCounts.get(userId) || 0) + 1;
  userConnectionCounts.set(userId, nextCount);
  if (nextCount === 1) {
    broadcast(() => true, { type: 'user_online', userId });
  }
};

const decrementUserConnection = (userId: string) => {
  const previous = userConnectionCounts.get(userId) || 0;
  if (previous <= 1) {
    userConnectionCounts.delete(userId);
    broadcast(() => true, { type: 'user_offline', userId });
    return;
  }
  userConnectionCounts.set(userId, previous - 1);
};

const broadcast = (predicate: (ctx: SocketContext) => boolean, payload: ChatSocketPayload) => {
  const message = JSON.stringify(payload);
  activeSockets.forEach((ctx) => {
    if (predicate(ctx) && ctx.socket.readyState === WebSocket.OPEN) {
      ctx.socket.send(message);
    }
  });
};

const broadcastToRoom = (roomId: string, payload: ChatSocketPayload) => {
  logServerDebug('broadcastToRoom', { roomId, type: payload.type });
  broadcast((ctx) => ctx.roomId === roomId, payload);
};

const normalizeReceiptsMeta = (meta: unknown) => {
  const source = meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {};
  const receipts = source.receipts && typeof source.receipts === 'object' ? (source.receipts as Record<string, unknown>) : {};
  return {
    ...source,
    receipts: {
      delivered: receipts.delivered && typeof receipts.delivered === 'object' ? (receipts.delivered as Record<string, string>) : {},
      read: receipts.read && typeof receipts.read === 'object' ? (receipts.read as Record<string, string>) : {},
    },
  };
};

const canInteractWithUser = async (viewerId: string, targetUserId: string) => {
  const viewer = await getUserContext(viewerId);
  const target = await fetchPersonById(targetUserId);
  return viewer ? isVisibleToViewer(viewer, target || null) : false;
};

const deriveRoomType = (room: { is_private?: boolean | null; name?: string | null }, members: RoomMember[]): RoomType => {
  if (room.is_private && members.length === 2) return 'dm';
  const normalized = (room.name || '').toLowerCase();
  if (normalized.includes('committee') || normalized.includes('room')) return 'committee';
  return 'group';
};

const fetchProfilesByIds = async (ids: string[]): Promise<Record<string, User>> => {
  if (ids.length === 0) return {};
  const uniqueIds = Array.from(new Set(ids));

  // Primary user source: unified app_users table linked to auth.users IDs.
  const { data: appUsers, error: appUsersError } = await supabaseAdmin
    .from('app_users')
    .select('id, email, first_name, last_name, role, committee_id, country')
    .in('id', uniqueIds);

  if (appUsersError) {
    console.error('[chat] failed to load profiles from app_users', appUsersError);
  }

  const appUserCommitteeIds = new Set<string>();
  (appUsers || []).forEach((row: any) => {
    if (row.committee_id) appUserCommitteeIds.add(row.committee_id);
  });

  const appUserCommitteeMap = new Map<string, string | null>();
  if (appUserCommitteeIds.size > 0) {
    const { data: committees, error } = await supabaseAdmin
      .from('Committee')
      .select('committeeID, committeeCode, name')
      .in('committeeID', Array.from(appUserCommitteeIds));

    if (error) {
      console.error('[chat] failed to load app_users committees', error);
    }

    (committees || []).forEach((committee: any) => {
      appUserCommitteeMap.set(committee.committeeID, committee.committeeCode || committee.name || null);
    });
  }

  const map: Record<string, User> = {};
  (appUsers || []).forEach((row: any) => {
    const role = String(row.role || 'delegate') as User['role'];
    map[row.id] = {
      id: row.id,
      email: row.email || '',
      full_name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Unknown',
      role,
      role_title: role.charAt(0).toUpperCase() + role.slice(1),
      committee: row.committee_id ? appUserCommitteeMap.get(row.committee_id) || null : null,
      country: row.country || null,
    };
  });

  return map;
};

const fetchRoomMembers = async (roomId: string): Promise<RoomMember[]> => {
  const { data } = await supabaseAdmin.from('room_members').select('id, room_id, user_id, role, joined_at').eq('room_id', roomId);
  const members = data || [];
  const profiles = await fetchProfilesByIds(members.map((m: any) => m.user_id).filter(Boolean));
  return members.map((member: any) => ({
    id: member.id,
    room_id: member.room_id,
    user_id: member.user_id,
    role: member.role,
    joined_at: member.joined_at,
    user: profiles[member.user_id],
  }));
};

const fetchLastMessage = async (roomId: string): Promise<MessageWithUser | null> => {
  const { data } = await supabaseAdmin
    .from('messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (!data || data.length === 0) return null;
  const msg = data[0] as any;
  const profiles = await fetchProfilesByIds([msg.user_id]);
  return { ...msg, user: profiles[msg.user_id] } as MessageWithUser;
};

// -------------------- ROOMS --------------------

app.get('/api/rooms', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { data: memberships } = await supabaseAdmin.from('room_members').select('room_id, role').eq('user_id', req.userId!);
    const roomIds = (memberships || []).map((m: any) => m.room_id);
    if (roomIds.length === 0) {
      return res.json([] as RoomWithDetails[]);
    }

    const { data: rooms } = await supabaseAdmin.from('chat_rooms').select('*').in('id', roomIds);

    const results: RoomWithDetails[] = [];
    for (const room of rooms || []) {
      const members = await fetchRoomMembers(room.id);
      const lastMessage = await fetchLastMessage(room.id);
      const room_type = deriveRoomType(room, members);
      results.push({ ...(room as any), members, lastMessage, room_type });
    }

    return res.json(results);
  } catch (error) {
    console.error('Error listing rooms', error);
    return res.status(500).json({ error: 'Failed to load rooms' });
  }
});

// People search
const handlePeopleSearch = async (req: AuthedRequest, res: Response) => {
  try {
    const query = (req.query.query as string) || '';
    const results = await searchPeople(query, req.userId);
    return res.json(results);
  } catch (error) {
    console.error('Error searching users', error);
    return res.status(500).json({ error: 'Failed to search users' });
  }
};

app.get('/api/chat/people', requireAuth, handlePeopleSearch);
app.get('/api/users/search', requireAuth, handlePeopleSearch);

// Friend requests
app.post('/api/friend-requests', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { targetUserId } = req.body as { targetUserId?: string };
    if (!targetUserId) return res.status(400).json({ error: 'Missing targetUserId' });

    if (targetUserId === req.userId) {
      return res.status(400).json({ error: 'Cannot send a request to yourself' });
    }

    const isAllowed = await canInteractWithUser(req.userId!, targetUserId);
    if (!isAllowed) {
      return res.status(403).json({ error: 'Not allowed to connect with this user' });
    }

    const { data: existing } = await supabaseAdmin
      .from('friend_requests')
      .select('*')
      .or(`and(sender_id.eq.${req.userId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${req.userId})`);

    const blocker = (existing || []).find((item: any) => item.status === 'pending' || item.status === 'accepted');
    if (blocker) {
      const profiles = await fetchProfilesByIds([req.userId!, targetUserId]);
      return res.json({
        ...(blocker as FriendRequest),
        sender: profiles[(blocker as any).sender_id],
        receiver: profiles[(blocker as any).receiver_id],
      });
    }

    const insertPayload = {
      id: randomUUID(),
      sender_id: req.userId!,
      receiver_id: targetUserId,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin.from('friend_requests').insert(insertPayload).select('*').single();

    if (error || !data) {
      console.error('Error sending friend request', error);
      return res.status(500).json({ error: 'Failed to send request' });
    }

    const profiles = await fetchProfilesByIds([req.userId!, targetUserId]);
    return res.json({
      ...(data as FriendRequest),
      sender: profiles[req.userId!],
      receiver: profiles[targetUserId],
    });
  } catch (error) {
    console.error('Error sending friend request', error);
    return res.status(500).json({ error: 'Failed to send request' });
  }
});

app.get('/api/friend-requests', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { data } = await supabaseAdmin
      .from('friend_requests')
      .select('*')
      .or(`sender_id.eq.${req.userId},receiver_id.eq.${req.userId}`)
      .order('created_at', { ascending: false });

    const ids = new Set<string>();
    (data || []).forEach((reqItem: any) => {
      ids.add(reqItem.sender_id);
      ids.add(reqItem.receiver_id);
    });
    const profiles = await fetchProfilesByIds(Array.from(ids));

    const enriched = (data || []).map((item: any) => ({
      ...(item as FriendRequest),
      sender: profiles[item.sender_id],
      receiver: profiles[item.receiver_id],
    }));

    return res.json(enriched as FriendRequest[]);
  } catch (error) {
    console.error('Error listing friend requests', error);
    return res.status(500).json({ error: 'Failed to load friend requests' });
  }
});

app.get('/api/chat/friend-requests/pending', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { data } = await supabaseAdmin
      .from('friend_requests')
      .select('*')
      .eq('receiver_id', req.userId!)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    const ids = new Set<string>();
    (data || []).forEach((reqItem: any) => {
      ids.add(reqItem.sender_id);
      ids.add(reqItem.receiver_id);
    });
    const profiles = await fetchProfilesByIds(Array.from(ids));

    const enriched = (data || []).map((item: any) => ({
      ...(item as FriendRequest),
      sender: profiles[item.sender_id],
      receiver: profiles[item.receiver_id],
    }));

    return res.json(enriched as FriendRequest[]);
  } catch (error) {
    console.error('Error listing pending friend requests', error);
    return res.status(500).json({ error: 'Failed to load friend requests' });
  }
});

app.post('/api/friend-requests/:id/respond', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { action } = req.body as { action?: 'accept' | 'reject' | 'decline' };
    if (!action) return res.status(400).json({ error: 'Missing action' });

    const normalizedAction = action === 'decline' ? 'reject' : action;
    const status = normalizedAction === 'accept' ? 'accepted' : 'rejected';
    const { data: updated } = await supabaseAdmin.from('friend_requests').update({ status }).eq('id', id).select().single();

    if (status === 'accepted' && updated) {
      await supabaseAdmin.from('friendships').upsert({ user1_id: (updated as any).sender_id, user2_id: (updated as any).receiver_id }, { onConflict: 'user1_id,user2_id' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error responding to friend request', error);
    return res.status(500).json({ error: 'Failed to update request' });
  }
});

// Direct + group room creation
app.post('/api/rooms/direct', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { targetUserId } = req.body as { targetUserId?: string };
    if (!targetUserId) {
      return res.status(400).json({ error: 'Missing targetUserId' });
    }

    const isAllowed = await canInteractWithUser(req.userId!, targetUserId);
    if (!isAllowed) {
      return res.status(403).json({ error: 'Not allowed to message this user' });
    }

    const { data: myMemberships } = await supabaseAdmin.from('room_members').select('room_id').eq('user_id', req.userId!);
    const roomIds = (myMemberships || []).map((m: any) => m.room_id);

    let existingRoomId: string | null = null;
    if (roomIds.length > 0) {
      const { data: mutualRooms } = await supabaseAdmin
        .from('room_members')
        .select('room_id')
        .eq('user_id', targetUserId)
        .in('room_id', roomIds);

      existingRoomId = (mutualRooms as any)?.[0]?.room_id ?? null;
    }

    let roomId = existingRoomId;
    if (!roomId) {
      const { data: createdRoom, error } = await supabaseAdmin
        .from('chat_rooms')
        .insert({ name: 'Direct message', description: null, is_private: true, created_by: req.userId! })
        .select('id')
        .single();

      if (error || !createdRoom) {
        return res.status(500).json({ error: 'Failed to create room' });
      }

      roomId = (createdRoom as any).id;
      await supabaseAdmin.from('room_members').insert([
        { room_id: roomId, user_id: req.userId!, role: 'member' },
        { room_id: roomId, user_id: targetUserId, role: 'member' },
      ]);
    }

    const { data: room } = await supabaseAdmin.from('chat_rooms').select('*').eq('id', roomId).single();

    const members = await fetchRoomMembers(roomId);
    const lastMessage = await fetchLastMessage(roomId);

    return res.json({ ...(room as any), members, lastMessage, room_type: deriveRoomType(room as any, members) } as RoomWithDetails);
  } catch (error) {
    console.error('Error creating direct room', error);
    return res.status(500).json({ error: 'Failed to create direct room' });
  }
});

app.post('/api/rooms/group', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { name, description, memberIds } = req.body as { name?: string; description?: string; memberIds?: string[] };
    if (!name || !memberIds || memberIds.length === 0) {
      return res.status(400).json({ error: 'Missing group details' });
    }

    const allMembers = Array.from(new Set([req.userId!, ...memberIds]));

    const visibilityChecks = await Promise.all(memberIds.map(async (memberId) => ({ memberId, allowed: await canInteractWithUser(req.userId!, memberId) })));
    const denied = visibilityChecks.find((check) => !check.allowed);
    if (denied) {
      return res.status(403).json({ error: `Not allowed to add member ${denied.memberId}` });
    }

    const { data: createdRoom, error } = await supabaseAdmin
      .from('chat_rooms')
      .insert({ name, description: description || null, is_private: false, created_by: req.userId! })
      .select('*')
      .single();

    if (error || !createdRoom) {
      return res.status(500).json({ error: 'Failed to create room' });
    }

    await supabaseAdmin
      .from('room_members')
      .insert(allMembers.map((id) => ({ room_id: (createdRoom as any).id, user_id: id, role: id === req.userId ? 'admin' : 'member' })));

    const members = await fetchRoomMembers((createdRoom as any).id);
    const lastMessage = await fetchLastMessage((createdRoom as any).id);

    return res.json({ ...(createdRoom as any), members, lastMessage, room_type: deriveRoomType(createdRoom as any, members) } as RoomWithDetails);
  } catch (error) {
    console.error('Error creating group room', error);
    return res.status(500).json({ error: 'Failed to create group room' });
  }
});

// -------------------- MESSAGES --------------------

app.get('/api/rooms/:roomId/messages', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { roomId } = req.params;

    const { data: membershipRows, error: membershipError } = await supabaseAdmin
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', req.userId!)
      .limit(1);

    if (membershipError) {
      console.error('Error validating room membership', membershipError);
      return res.status(500).json({ error: 'Failed to validate room membership' });
    }

    if (!membershipRows || membershipRows.length === 0) {
      return res.status(403).json({ error: 'Not a room member' });
    }

    const { data: messages } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    const profiles = await fetchProfilesByIds((messages || []).map((msg: any) => msg.user_id));
    const formatted = (messages || []).map((msg: any) => ({ ...msg, user: profiles[msg.user_id] } as MessageWithUser));
    return res.json(formatted);
  } catch (error) {
    console.error('Error loading messages', error);
    return res.status(500).json({ error: 'Failed to load messages' });
  }
});

app.post('/api/rooms/:roomId/messages', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { roomId } = req.params;
    const { content, reply_to } = req.body as { content?: string; reply_to?: string | null };

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const { data: membershipRows, error: membershipError } = await supabaseAdmin
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', req.userId!)
      .limit(1);

    if (membershipError) {
      console.error('Error validating room membership', membershipError);
      return res.status(500).json({ error: 'Failed to validate room membership' });
    }

    if (!membershipRows || membershipRows.length === 0) {
      return res.status(403).json({ error: 'Not a room member' });
    }

    const { data: inserted, error } = await supabaseAdmin
      .from('messages')
      .insert({ room_id: roomId, user_id: req.userId!, content: content.trim(), reply_to: reply_to || null })
      .select('*')
      .single();

    if (error || !inserted) {
      return res.status(500).json({ error: 'Failed to send message' });
    }

    const profiles = await fetchProfilesByIds([(inserted as any).user_id]);
    const payload: MessageWithUser = { ...(inserted as any), user: profiles[(inserted as any).user_id] };

    broadcastToRoom(roomId, { type: 'new_message', message: payload });

    return res.json(payload);
  } catch (error) {
    console.error('Error sending message', error);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

// -------------------- RECEIPTS (FIXED) --------------------
// This endpoint is served by EXPRESS, not Next's app/api, because /api/* is intercepted here.
app.post('/api/rooms/:roomId/receipts', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { roomId } = req.params;
    const { messageIds, markRead } = req.body as { messageIds?: string[]; markRead?: boolean };

    // Only accept UUIDs (prevents temp-* ids and other garbage from causing RPC weirdness)
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const ids = Array.isArray(messageIds)
      ? messageIds.filter((id): id is string => typeof id === 'string' && UUID_RE.test(id))
      : [];

    if (ids.length === 0) return res.json({ updated: [] });

    // Ensure user is in room (same pattern as messages)
    const { data: membershipRows, error: membershipError } = await supabaseAdmin
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', req.userId!)
      .limit(1);

    if (membershipError) {
      console.error('[api rooms receipts] membership check failed', { roomId, userId: req.userId, error: membershipError });
      return res.status(500).json({ error: 'Failed to validate room membership' });
    }

    if (!membershipRows || membershipRows.length === 0) {
      return res.status(403).json({ error: 'Not a room member' });
    }

    const actorId = String(req.userId!);
    const roomMemberUserIds = await fetchRoomMemberUserIds(roomId);

    if (isReceiptsDebugEnabled) {
      console.warn('[api rooms receipts] identity resolved', {
        roomId,
        resolvedActorId: actorId,
        markRead: Boolean(markRead),
        sampleRoomMemberUserIds: roomMemberUserIds.slice(0, 5),
      });
    }

    // RPC call
    const { data, error } = await supabaseAdmin.rpc('mark_message_receipts', {
      p_room_id: roomId,
      p_message_ids: ids,
      p_user_id: actorId,
      p_mark_read: Boolean(markRead),
    });

    if (error) {
      console.error('[api rooms receipts] rpc failed', { roomId, userId: actorId, error: error.message || error });
      return res.status(500).json({ error: 'Failed to mark receipts', details: error.message || String(error) });
    }

    const updatedIds = (data || []) as string[];
    if (isReceiptsDebugEnabled) {
      console.warn('[api rooms receipts] write success', {
        roomId,
        actorId,
        markRead: Boolean(markRead),
        updatedCount: updatedIds.length,
      });
    }
    const nowIso = new Date().toISOString();

    const rows = await supabaseAdmin
      .from('messages')
      .select('id, room_id, user_id, meta')
      .in('id', updatedIds)
      .eq('room_id', roomId);

    if (rows.error) {
      console.error('[api rooms receipts] failed to load updated messages', { roomId, userId: actorId, error: rows.error.message || rows.error });
      return res.status(500).json({ error: 'Failed to verify receipts update' });
    }

    let firstDeliveredKeys: string[] = [];
    let firstReadKeys: string[] = [];
    const receiptsPatch: Record<string, MessageWithUser['meta']> = {};

    for (const row of rows.data || []) {
      const rowId = String((row as any).id);
      if (String((row as any).user_id) === actorId) {
        receiptsPatch[rowId] = normalizeReceiptsMeta((row as any).meta);
        continue;
      }

      const meta = (((row as any).meta ?? {}) as any);
      meta.receipts ??= {};
      meta.receipts.delivered ??= {};
      meta.receipts.read ??= {};

      if (!meta.receipts.delivered[actorId]) {
        meta.receipts.delivered[actorId] = nowIso;
      }
      if (Boolean(markRead) && !meta.receipts.read[actorId]) {
        meta.receipts.read[actorId] = nowIso;
      }

      const updateResult = await supabaseAdmin.from('messages').update({ meta }).eq('id', (row as any).id).eq('room_id', roomId);
      if (updateResult.error) {
        console.error('[api rooms receipts] fallback merge failed', {
          roomId,
          messageId: (row as any).id,
          userId: actorId,
          error: updateResult.error.message || updateResult.error,
        });
      }

      receiptsPatch[rowId] = normalizeReceiptsMeta(meta);

      if (firstDeliveredKeys.length === 0) {
        firstDeliveredKeys = Object.keys(meta.receipts.delivered || {}).slice(0, 5);
        firstReadKeys = Object.keys(meta.receipts.read || {}).slice(0, 5);
      }
    }

    if (isReceiptsDebugEnabled) {
      console.warn('[api rooms receipts] receipts merge result sample', {
        roomId,
        resolvedActorId: actorId,
        deliveredKeys: firstDeliveredKeys,
        readKeys: firstReadKeys,
      });
    }

    broadcastToRoom(roomId, {
      type: 'receipts_updated',
      roomId,
      actorId,
      markRead: Boolean(markRead),
      messageIds: updatedIds,
      receiptsPatch,
    });

    if (isReceiptsDebugEnabled) {
      console.warn('[api rooms receipts] receipts_updated broadcast', {
        roomId,
        actorId,
        markRead: Boolean(markRead),
        messageCount: updatedIds.length,
        patchCount: Object.keys(receiptsPatch).length,
      });
    }

    return res.json({ updated: updatedIds });
  } catch (error) {
    console.error('[api rooms receipts] failed', error);
    return res.status(500).json({ error: 'Failed to mark receipts' });
  }
});

// Members list
app.get('/api/rooms/:roomId/members', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { roomId } = req.params;
    const members = await fetchRoomMembers(roomId);
    return res.json(members);
  } catch (error) {
    console.error('Error loading members', error);
    return res.status(500).json({ error: 'Failed to load members' });
  }
});

app.post('/api/rooms/:roomId/leave', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { roomId } = req.params;
    await supabaseAdmin.from('room_members').delete().eq('room_id', roomId).eq('user_id', req.userId!);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error leaving room', error);
    return res.status(500).json({ error: 'Failed to leave room' });
  }
});

app.delete('/api/rooms/:roomId', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { roomId } = req.params;
    const { data: room } = await supabaseAdmin.from('chat_rooms').select('created_by').eq('id', roomId).single();

    if (!room || (room as any).created_by !== req.userId) {
      return res.status(403).json({ error: 'Only the creator can delete the room' });
    }

    await supabaseAdmin.from('chat_rooms').delete().eq('id', roomId);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting room', error);
    return res.status(500).json({ error: 'Failed to delete room' });
  }
});

// -------------------- NEXT + WS SERVER --------------------

const PORT = Number(process.env.PORT || process.env.CHAT_PORT || 5000);
const isDev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev: isDev, hostname: '0.0.0.0', port: PORT });
const nextHandler = nextApp.getRequestHandler();

const CHAT_WS_PATH = '/chat-ws'; // Keep in sync with app/messages/context/ChatContext.tsx

const server = http.createServer((req, res) => {
  const url = req.url || '';
  if (url.startsWith('/api/')) {
    app(req, res);
    return;
  }
  nextHandler(req, res);
});

const wss = new WebSocketServer({ server, path: CHAT_WS_PATH });

wss.on('connection', (socket, req) => {
  logServerDebug('socket:connection_opened', { hasCookie: Boolean(req.headers.cookie), url: req.url || null });
  const context: Partial<SocketContext> = { socket };
  let authenticated = false;
  let disconnected = false;

  const authTimeout = setTimeout(() => {
    if (!authenticated) {
      socket.send(JSON.stringify({ type: 'auth_error' } satisfies ChatSocketPayload));
      socket.close();
    }
  }, 5000);

  const finishSocketAuthentication = (authenticatedUserId: string) => {
    logServerDebug('socket:authenticated', { authenticatedUserId, activeSocketCountBefore: activeSockets.size });
    context.userId = authenticatedUserId;
    authenticated = true;
    activeSockets.add(context as SocketContext);
    incrementUserConnection(authenticatedUserId);
    socket.send(JSON.stringify({ type: 'authenticated' } satisfies ChatSocketPayload));
    sendOnlineUsersSnapshot(socket);
  };

  const authenticateFromCookie = () => {
    const sessionUser = getSessionUserFromCookieHeader(req.headers.cookie || '');
    if (!sessionUser) {
      logServerDebug('socket:authenticateFromCookie:missing_session');
      return false;
    }
    logServerDebug('socket:auth_identity_resolved', { resolvedActorId: sessionUser.id, role: sessionUser.role });
    finishSocketAuthentication(sessionUser.id);
    return true;
  };

  authenticateFromCookie();
  if (authenticated) clearTimeout(authTimeout);

  const disconnect = () => {
    if (disconnected) return;
    disconnected = true;
    clearTimeout(authTimeout);
    logServerDebug('socket:disconnect', {
      userId: context.userId || null,
      roomId: context.roomId || null,
      activeSocketCountBefore: activeSockets.size,
    });
    if (authenticated && context.userId) decrementUserConnection(context.userId);
    activeSockets.delete(context as SocketContext);
  };

  socket.on('message', async (raw) => {
    try {
      const data = JSON.parse(raw.toString()) as ChatSocketPayload;
      logServerDebug('socket:message_received', {
        type: data.type,
        userId: context.userId || null,
        roomId: context.roomId || null,
        payload: data,
      });

      switch (data.type) {
        case 'auth': {
          if (authenticated) {
            socket.send(JSON.stringify({ type: 'authenticated' } satisfies ChatSocketPayload));
            sendOnlineUsersSnapshot(socket);
            return;
          }
          if (!authenticateFromCookie()) {
            socket.send(JSON.stringify({ type: 'auth_error' } satisfies ChatSocketPayload));
            socket.close();
            return;
          }
          clearTimeout(authTimeout);
          return;
        }
        case 'join_room': {
          if (!authenticated || !context.userId || !data.roomId) return;

          const { data: membership } = await supabaseAdmin
            .from('room_members')
            .select('id')
            .eq('room_id', data.roomId)
            .eq('user_id', context.userId)
            .single();

          if (!membership) return;

          if (isReceiptsDebugEnabled) {
            const roomMemberIds = await fetchRoomMemberUserIds(data.roomId);
            console.warn('[socket auth] join_room identity sample', {
              roomId: data.roomId,
              resolvedActorId: context.userId,
              sampleRoomMemberUserIds: roomMemberIds.slice(0, 5),
            });
          }

          context.roomId = data.roomId;
          socket.send(JSON.stringify({ type: 'room_joined', roomId: data.roomId } satisfies ChatSocketPayload));
          return;
        }
        case 'typing': {
          if (!authenticated || !context.userId || !context.roomId || !data.roomId || data.roomId !== context.roomId) return;
          broadcastToRoom(context.roomId, {
            type: 'user_typing',
            roomId: context.roomId,
            userId: context.userId,
            isTyping: data.isTyping ?? true,
          });
          return;
        }
        default:
          return;
      }
    } catch (error) {
      console.error('WebSocket error', error);
      logServerDebug('socket:message_parse_or_handle_error', {
        error: error instanceof Error ? error.message : 'unknown-error',
      });
    }
  });

  socket.on('close', disconnect);
  socket.on('error', disconnect);
});

const start = async () => {
  await nextApp.prepare();
  server.listen(PORT, () => {
    console.warn(`Unified Next + chat server listening on http://localhost:${PORT}`);
  });
};

start().catch((error) => {
  console.error('Failed to start unified server', error);
  process.exit(1);
});

export default app;
