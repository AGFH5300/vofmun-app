// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
import express, { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import next from 'next';
import supabaseAdmin from '../../lib/supabaseAdmin.ts';
import { getBearerTokenFromHeaders, verifySupabaseAccessToken } from '../../lib/chat/auth.ts';
import {
  ChatSocketPayload,
  FriendRequest,
  MessageAttachment,
  MessageAttachmentInput,
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
  roomIds: Set<string>;
  activeRoomId?: string;
  socket: WebSocket;
}

const app = express();
app.use(express.json());

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const isDevelopment = process.env.NODE_ENV !== 'production';
const MAX_MESSAGE_LENGTH = 5000;
const MAX_ATTACHMENTS_PER_MESSAGE = 10;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

if (!supabaseAdmin) {
  throw new Error('Supabase admin client is not configured. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}


const createUserRateLimit = (windowMs: number, maxRequests: number) =>
  rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const authedReq = req as AuthedRequest;
      const userId = String(authedReq.userId || '').trim();
      const routePath = req.route?.path || req.path;
      return `${req.method}:${routePath}:${userId || req.ip}`;
    },
    handler: (_req, res) => res.status(429).json({ error: 'Too many requests' }),
  });

const chatReadRateLimit = createUserRateLimit(60_000, 120);
const chatWriteRateLimit = createUserRateLimit(60_000, 40);
const chatReceiptRateLimit = createUserRateLimit(60_000, 240);
const requireAuth = async (req: AuthedRequest, res: Response, nextFn: NextFunction) => {
  const hasAuthorizationHeader = Boolean(req.headers['authorization']);
  const bearerToken = getBearerTokenFromHeaders(req.headers);

  logServerDebug('http:requireAuth:start', {
    method: req.method,
    path: req.path,
    hasAuthorizationHeader,
    hasBearerToken: Boolean(bearerToken),
  });

  if (!bearerToken) {
    logServerDebug('http:requireAuth:missing_bearer_token', { path: req.path });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sessionUser = await verifySupabaseAccessToken(bearerToken);
  if (!sessionUser) {
    logServerDebug('http:requireAuth:token_verification_failed', { path: req.path });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.userId = sessionUser.id;
  logServerDebug('http:requireAuth:resolved', {
    method: req.method,
    path: req.path,
    resolvedUserId: req.userId,
  });
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

const saveMessageHistorySnapshotOnMessage = async (
  messageRow: Record<string, any>,
  action: 'edit' | 'delete',
  actedBy: string,
  previousAttachments: any[] = []
) => {
  const snapshotSavedAt = new Date().toISOString();
  const historyPayload = {
    history_action: action,
    history_acted_by: actedBy,
    history_saved_at: snapshotSavedAt,
    previous_content: messageRow.content ?? null,
    previous_attachments: previousAttachments,
    previous_reply_to: messageRow.reply_to ?? null,
    previous_user_id: messageRow.user_id ?? null,
    previous_created_at: messageRow.created_at ?? null,
    previous_edited_at: messageRow.edited_at ?? null,
    previous_deleted_at: messageRow.deleted_at ?? null,
    previous_message_row: messageRow,
  };

  const { error } = await supabaseAdmin
    .from('messages')
    .update(historyPayload)
    .eq('id', String(messageRow.id))
    .eq('room_id', String(messageRow.room_id));

  if (error) {
    throw new Error(`Failed to persist message history snapshot: ${error.message || String(error)}`);
  }
};

const fetchExistingAppUserIds = async (userIds: string[]): Promise<Set<string>> => {
  const uniqueIds = Array.from(new Set(userIds.map((id) => String(id).trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return new Set<string>();

  const { data, error } = await supabaseAdmin
    .from('app_users')
    .select('id')
    .in('id', uniqueIds);

  if (error) {
    console.error('[chat] failed to validate app_user ids', { userIds: uniqueIds, error: error.message || error });
    return new Set<string>();
  }

  return new Set((data || []).map((row: { id: string }) => String(row.id)));
};

const normalizeUniqueUserIds = (rawIds: unknown[]): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  rawIds.forEach((id) => {
    const value = String(id || '').trim();
    if (!value) return;
    if (seen.has(value)) return;
    seen.add(value);
    normalized.push(value);
  });

  return normalized;
};

const toDbErrorPayload = (error: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null }) => ({
  code: error.code || null,
  message: error.message || null,
  details: error.details || null,
  hint: error.hint || null,
});

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
  broadcast((ctx) => ctx.roomIds.has(roomId), payload);
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


const fetchAttachmentsByMessageIds = async (messageIds: string[]) => {
  const uniqueMessageIds = Array.from(new Set(messageIds.map((id) => String(id)).filter(Boolean)));
  if (uniqueMessageIds.length === 0) return {} as Record<string, MessageAttachment[]>;

  const { data, error } = await supabaseAdmin
    .from('message_attachments')
    .select('*')
    .in('message_id', uniqueMessageIds)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[chat] failed to load message attachments', { messageIds: uniqueMessageIds, error: error.message || error });
    return {} as Record<string, MessageAttachment[]>;
  }

  return (data || []).reduce((acc: Record<string, MessageAttachment[]>, attachment: MessageAttachment) => {
    const messageId = String(attachment.message_id || '');
    if (!messageId) return acc;
    if (!acc[messageId]) acc[messageId] = [];
    acc[messageId].push(attachment);
    return acc;
  }, {} as Record<string, MessageAttachment[]>);
};

const sanitizeAttachmentName = (name: string) => {
  const normalized = name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized.slice(0, 120) || 'file';
};

const isAllowedAttachmentPath = (roomId: string, path: string) => {
  const segments = String(path || '').split('/').filter(Boolean);
  if (segments.length < 3) return false;
  return segments[0] === roomId;
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

const fetchLastMessage = async (roomId: string, userId?: string | null): Promise<MessageWithUser | null> => {
  const { data } = await supabaseAdmin
    .from('messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (!data || data.length === 0) return null;

  let hiddenMessageIds = new Set<string>();
  if (userId) {
    const candidateIds = data.map((row: any) => String(row.id || '')).filter(Boolean);
    if (candidateIds.length > 0) {
      const { data: hiddenRows } = await supabaseAdmin
        .from('message_hidden_for_users')
        .select('message_id')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .in('message_id', candidateIds);
      hiddenMessageIds = new Set((hiddenRows || []).map((row: any) => String(row.message_id || '')).filter(Boolean));
    }
  }

  const msg = data.find((row: any) => !hiddenMessageIds.has(String(row.id || '')));
  if (!msg) return null;
  const messageId = String(msg.id || '');
  const [profiles, attachmentsByMessageId] = await Promise.all([
    fetchProfilesByIds([msg.user_id]),
    fetchAttachmentsByMessageIds(messageId ? [messageId] : []),
  ]);
  return {
    ...msg,
    user: profiles[msg.user_id],
    attachments: messageId ? attachmentsByMessageId[messageId] || [] : [],
  } as MessageWithUser;
};

// -------------------- ROOMS --------------------

app.get('/api/rooms', chatReadRateLimit, requireAuth, async (req: AuthedRequest, res: Response) => {
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
      const lastMessage = await fetchLastMessage(room.id, req.userId);
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

app.get('/api/chat/people', chatReadRateLimit, requireAuth, handlePeopleSearch);
app.get('/api/users/search', chatReadRateLimit, requireAuth, handlePeopleSearch);

// Friend requests
app.post('/api/friend-requests', chatWriteRateLimit, requireAuth, async (req: AuthedRequest, res: Response) => {
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

app.get('/api/friend-requests', chatReadRateLimit, requireAuth, async (req: AuthedRequest, res: Response) => {
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

app.get('/api/chat/friend-requests/pending', chatReadRateLimit, requireAuth, async (req: AuthedRequest, res: Response) => {
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

app.post('/api/friend-requests/:id/respond', chatWriteRateLimit, requireAuth, async (req: AuthedRequest, res: Response) => {
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
app.post('/api/rooms/direct', chatWriteRateLimit, requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { targetUserId } = req.body as { targetUserId?: string };
    const normalizedTargetUserId = String(targetUserId || '').trim();
    if (!normalizedTargetUserId) {
      return res.status(400).json({ error: 'Missing targetUserId' });
    }

    if (normalizedTargetUserId === req.userId) {
      return res.status(400).json({ error: 'Cannot create direct room with yourself' });
    }

    const existingIds = await fetchExistingAppUserIds([normalizedTargetUserId]);
    if (!existingIds.has(normalizedTargetUserId)) {
      return res.status(400).json({ error: 'Invalid target user' });
    }

    const isAllowed = await canInteractWithUser(req.userId!, normalizedTargetUserId);
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
        .eq('user_id', normalizedTargetUserId)
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
      const { error: memberInsertError } = await supabaseAdmin.from('room_members').insert([
        { room_id: roomId, user_id: normalizedTargetUserId, role: 'member' },
      ]);

      if (memberInsertError) {
        console.error('Error adding direct room member', memberInsertError);
        return res.status(500).json({ error: 'Failed to create room members' });
      }
    }

    const { data: room } = await supabaseAdmin.from('chat_rooms').select('*').eq('id', roomId).single();

    const members = await fetchRoomMembers(roomId);
    const lastMessage = await fetchLastMessage(roomId, req.userId);

    return res.json({ ...(room as any), members, lastMessage, room_type: deriveRoomType(room as any, members) } as RoomWithDetails);
  } catch (error) {
    console.error('Error creating direct room', error);
    return res.status(500).json({ error: 'Failed to create direct room' });
  }
});

app.post('/api/rooms/group', chatWriteRateLimit, requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { name, description, memberIds } = req.body as {
      name?: string;
      description?: string | null;
      memberIds?: unknown;
    };
    const trimmedName = String(name || '').trim();
    const normalizedDescription = typeof description === 'string' ? description.trim() : '';

    if (!trimmedName) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ error: 'Missing group details' });
    }

    const creatorUserId = String(req.userId || '').trim();
    if (!creatorUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const normalizedMemberIds = normalizeUniqueUserIds(memberIds)
      .map((id) => id.trim())
      .filter((id) => id !== creatorUserId);

    if (normalizedMemberIds.some((id) => !isUuid(id))) {
      return res.status(400).json({ error: 'One or more participants are invalid' });
    }

    if (normalizedMemberIds.length === 0) {
      return res.status(400).json({ error: 'Select at least one participant' });
    }

    if (normalizedMemberIds.length < 1) {
      return res.status(400).json({ error: 'Select at least one participant for a group chat' });
    }

    const finalMemberUserIds = normalizeUniqueUserIds([creatorUserId, ...normalizedMemberIds]);

    console.debug('[GroupCreateDebug] request_received', {
      creatorUserId,
      name: trimmedName,
      memberCount: finalMemberUserIds.length,
      memberIds: normalizedMemberIds,
    });

    const existingIds = await fetchExistingAppUserIds(finalMemberUserIds);
    if (!existingIds.has(creatorUserId)) {
      return res.status(400).json({ error: 'Your chat profile is not available. Please sign in again.' });
    }

    if (existingIds.size !== finalMemberUserIds.length) {
      return res.status(400).json({ error: 'One or more participants are invalid' });
    }

    const visibilityChecks = await Promise.all(
      normalizedMemberIds.map(async (memberId) => ({ memberId, allowed: await canInteractWithUser(req.userId!, memberId) }))
    );
    const denied = visibilityChecks.find((check) => !check.allowed);
    if (denied) {
      return res.status(403).json({ error: `Not allowed to add member ${denied.memberId}` });
    }

    const { data: createdRoom, error } = await supabaseAdmin
      .from('chat_rooms')
      .insert({
        name: trimmedName,
        description: normalizedDescription.length > 0 ? normalizedDescription : null,
        is_private: false,
        created_by: creatorUserId,
      })
      .select('*')
      .single();

    if (error || !createdRoom) {
      return res.status(500).json({ error: 'Failed to create room' });
    }

    const roomId = String((createdRoom as any).id || '');
    const existingRoomMemberIds = new Set(await fetchRoomMemberUserIds(roomId));
    const memberRows = finalMemberUserIds
      .filter((userId) => !existingRoomMemberIds.has(userId))
      .map((userId) => ({
        room_id: roomId,
        user_id: userId,
        role: 'member' as const,
      }));

    console.debug('[GroupCreateDebug] inserting_room_members', {
      roomId,
      creatorUserId,
      memberRows,
    });

    let memberInsertError: {
      code?: string | null;
      message?: string | null;
      details?: string | null;
      hint?: string | null;
    } | null = null;

    if (memberRows.length > 0) {
      const insertResult = await supabaseAdmin
        .from('room_members')
        .insert(memberRows);
      memberInsertError = insertResult.error;
    }

    if (memberInsertError) {
      const dbError = toDbErrorPayload(memberInsertError);
      console.error('[GroupCreateDebug] room_members_insert_failed', {
        roomId,
        memberRows,
        dbError,
      });

      await supabaseAdmin.from('chat_rooms').delete().eq('id', roomId);

      if (memberInsertError.code === '23505') {
        return res.status(409).json({ error: 'Some participants were added more than once. Please retry.' });
      }
      if (memberInsertError.code === '23503') {
        return res.status(400).json({ error: 'A participant could not be added due to an invalid user reference.' });
      }
      if (memberInsertError.code === '22P02') {
        return res.status(400).json({ error: 'A participant ID was not in the expected format.' });
      }

      return res.status(500).json({
        error: 'Failed to create room members',
        ...(isDevelopment ? { devError: dbError } : {}),
      });
    }

    const finalMemberIdsAfterInsert = new Set(await fetchRoomMemberUserIds(roomId));
    logServerDebug('group:create:room_members_resolved', {
      roomId,
      requestedMemberIds: finalMemberUserIds,
      insertedMemberRows: memberRows,
      finalMemberIds: Array.from(finalMemberIdsAfterInsert),
      creatorIncluded: finalMemberIdsAfterInsert.has(creatorUserId),
      missingRequestedIds: finalMemberUserIds.filter((memberId) => !finalMemberIdsAfterInsert.has(memberId)),
    });

    const members = await fetchRoomMembers(roomId);
    const lastMessage = await fetchLastMessage(roomId, req.userId);

    console.debug('[GroupCreateDebug] room_created', {
      roomId,
      creatorIncluded: members.some((member) => String(member.user_id) === creatorUserId),
      memberCount: members.length,
    });

    broadcast(
      (ctx) => Boolean(ctx.userId && finalMemberUserIds.includes(String(ctx.userId))),
      { type: 'room_created', roomId } satisfies ChatSocketPayload
    );

    return res.json({ ...(createdRoom as any), members, lastMessage, room_type: deriveRoomType(createdRoom as any, members) } as RoomWithDetails);
  } catch (error) {
    console.error('Error creating group room', error);
    return res.status(500).json({ error: 'Failed to create group room' });
  }
});

// -------------------- MESSAGES --------------------

app.get('/api/rooms/:roomId/messages', chatReadRateLimit, requireAuth, async (req: AuthedRequest, res: Response) => {
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

    const { data: hiddenRows } = await supabaseAdmin
      .from('message_hidden_for_users')
      .select('message_id')
      .eq('room_id', roomId)
      .eq('user_id', req.userId!);
    const hiddenMessageIds = new Set((hiddenRows || []).map((row: any) => String(row.message_id || '')).filter(Boolean));

    const { data: messages } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });
    const visibleMessages = (messages || []).filter((msg: any) => !hiddenMessageIds.has(String(msg.id || '')));

    const profileIds = Array.from(new Set(visibleMessages.map((msg: any) => String(msg.user_id)).filter(Boolean)));
    const messageIds = visibleMessages.map((msg: any) => String(msg.id)).filter(Boolean);
    const profiles = await fetchProfilesByIds(profileIds);
    const attachmentsByMessageId = await fetchAttachmentsByMessageIds(messageIds);
    const formatted = visibleMessages.map((msg: any) => {
      const message = {
        ...msg,
        user: profiles[msg.user_id],
        attachments: attachmentsByMessageId[String(msg.id)] || [],
      } as MessageWithUser;

      console.debug('message profile enrichment', {
        roomId,
        currentUserId: req.userId,
        messageId: message.id,
        messageUserId: message.user_id,
        attachedProfileId: message.user?.id ?? null,
      });

      return message;
    });
    return res.json(formatted);
  } catch (error) {
    console.error('Error loading messages', error);
    return res.status(500).json({ error: 'Failed to load messages' });
  }
});

app.post('/api/rooms/:roomId/messages', chatWriteRateLimit, requireAuth, async (req: AuthedRequest, res: Response) => {
  let claimedUploadIds: string[] = [];
  try {
    const { roomId } = req.params;
    const userId = String(req.userId || '');
    const { content, reply_to, attachments = [] } = req.body as {
      content?: string;
      reply_to?: string | null;
      attachments?: MessageAttachmentInput[];
    };
    const trimmedContent = content?.trim() || '';
    const normalizedAttachments = Array.isArray(attachments) ? attachments : [];
    const replyTo = reply_to ? String(reply_to) : null;

    if (!trimmedContent && normalizedAttachments.length === 0) {
      return res.status(400).json({ error: 'Message content or attachments are required' });
    }
    if (trimmedContent.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters` });
    }
    if (normalizedAttachments.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      return res.status(400).json({ error: `A message can include at most ${MAX_ATTACHMENTS_PER_MESSAGE} attachments` });
    }

    logServerDebug('http:messages:insert_attempt', {
      roomId,
      resolvedUserId: userId,
      hasContent: Boolean(trimmedContent),
      attachmentCount: normalizedAttachments.length,
    });

    const { data: membershipRows, error: membershipError } = await supabaseAdmin
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .limit(1);
    if (membershipError) {
      console.error('Error validating room membership', membershipError);
      return res.status(500).json({ error: 'Failed to validate room membership' });
    }
    if (!membershipRows || membershipRows.length === 0) {
      return res.status(403).json({ error: 'Not a room member' });
    }

    if (replyTo) {
      const { data: replyMessage, error: replyError } = await supabaseAdmin
        .from('messages')
        .select('id')
        .eq('id', replyTo)
        .eq('room_id', roomId)
        .maybeSingle();
      if (replyError) throw replyError;
      if (!replyMessage) {
        return res.status(400).json({ error: 'Reply target is not in this room' });
      }
    }

    let trustedPending: Array<{
      id: string;
      room_id: string;
      bucket: string;
      path: string;
      original_name: string;
      mime_type: string;
      size_bytes: number;
    }> = [];

    if (normalizedAttachments.length > 0) {
      const uploadIds = normalizedAttachments.map((attachment) => String(attachment.upload_id || '').trim());
      if (uploadIds.some((uploadId) => !isUuid(uploadId)) || new Set(uploadIds).size !== uploadIds.length) {
        return res.status(400).json({ error: 'Attachments must reference unique verified uploads' });
      }

      const { data: pendingRows, error: pendingError } = await supabaseAdmin
        .from('pending_chat_attachments')
        .select('id, room_id, bucket, path, original_name, mime_type, size_bytes')
        .in('id', uploadIds)
        .eq('created_by', userId)
        .eq('room_id', roomId)
        .is('consumed_at', null);
      if (pendingError) throw pendingError;
      if (!pendingRows || pendingRows.length !== uploadIds.length) {
        return res.status(409).json({ error: 'One or more attachments are invalid or already used' });
      }

      trustedPending = pendingRows.map((row: any) => ({
        id: String(row.id),
        room_id: String(row.room_id),
        bucket: String(row.bucket),
        path: String(row.path),
        original_name: String(row.original_name),
        mime_type: String(row.mime_type || 'application/octet-stream'),
        size_bytes: Number(row.size_bytes),
      }));
      if (trustedPending.some((row) =>
        row.bucket !== 'chat-attachments' ||
        row.size_bytes <= 0 ||
        row.size_bytes > MAX_ATTACHMENT_BYTES ||
        !row.path.startsWith(`${roomId}/${userId}/`)
      )) {
        return res.status(400).json({ error: 'Attachment metadata is invalid' });
      }

      const { data: claimedRows, error: claimError } = await supabaseAdmin
        .from('pending_chat_attachments')
        .update({ consumed_at: new Date().toISOString() })
        .in('id', uploadIds)
        .eq('created_by', userId)
        .eq('room_id', roomId)
        .is('consumed_at', null)
        .select('id');
      if (claimError) throw claimError;
      if (!claimedRows || claimedRows.length !== uploadIds.length) {
        await supabaseAdmin.from('pending_chat_attachments').update({ consumed_at: null }).in('id', uploadIds).eq('created_by', userId);
        return res.status(409).json({ error: 'One or more attachments are already being used' });
      }
      claimedUploadIds = uploadIds;
    }

    const { data: inserted, error } = await supabaseAdmin
      .from('messages')
      .insert({ room_id: roomId, user_id: userId, content: trimmedContent, reply_to: replyTo })
      .select('*')
      .single();
    if (error || !inserted) {
      if (claimedUploadIds.length > 0) {
        await supabaseAdmin.from('pending_chat_attachments').update({ consumed_at: null }).in('id', claimedUploadIds).eq('created_by', userId);
      }
      return res.status(500).json({ error: 'Failed to send message' });
    }

    if (trustedPending.length > 0) {
      const attachmentRows = trustedPending.map((attachment) => ({
        message_id: (inserted as any).id,
        room_id: roomId,
        bucket: attachment.bucket,
        path: attachment.path,
        original_name: attachment.original_name,
        mime_type: attachment.mime_type,
        size_bytes: attachment.size_bytes,
        created_by: userId,
      }));
      const { error: attachmentError } = await supabaseAdmin.from('message_attachments').insert(attachmentRows);
      if (attachmentError) {
        await supabaseAdmin.from('messages').delete().eq('id', (inserted as any).id);
        await supabaseAdmin.from('pending_chat_attachments').update({ consumed_at: null }).in('id', claimedUploadIds).eq('created_by', userId);
        return res.status(500).json({ error: 'Failed to save attachments' });
      }
      const { error: pendingDeleteError } = await supabaseAdmin
        .from('pending_chat_attachments')
        .delete()
        .in('id', claimedUploadIds)
        .eq('created_by', userId);
      if (pendingDeleteError) {
        console.error('[chat] failed to remove consumed pending uploads', {
          userId,
          roomId,
          uploadIds: claimedUploadIds,
          error: pendingDeleteError.message || pendingDeleteError,
        });
      }
      claimedUploadIds = [];
    }

    const profiles = await fetchProfilesByIds([String((inserted as any).user_id)]);
    const attachmentsByMessageId = await fetchAttachmentsByMessageIds([String((inserted as any).id)]);
    const payload: MessageWithUser = {
      ...(inserted as any),
      user: profiles[(inserted as any).user_id],
      attachments: attachmentsByMessageId[String((inserted as any).id)] || [],
    };

    broadcastToRoom(roomId, { type: 'new_message', message: payload });
    return res.json(payload);
  } catch (error) {
    if (claimedUploadIds.length > 0 && req.userId) {
      await supabaseAdmin
        .from('pending_chat_attachments')
        .update({ consumed_at: null })
        .in('id', claimedUploadIds)
        .eq('created_by', req.userId);
    }
    console.error('Error sending message', error);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});


app.patch('/api/rooms/:roomId/messages/:messageId', chatWriteRateLimit, requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { roomId, messageId } = req.params;
    const { content } = req.body as { content?: string };
    const trimmedContent = String(content || '').trim();

    if (!trimmedContent) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .eq('room_id', roomId)
      .single();

    if (existingError || !existing) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (String((existing as any).user_id) !== String(req.userId || '')) {
      return res.status(403).json({ error: 'Only the sender can edit this message' });
    }

    if ((existing as any).deleted_at) {
      return res.status(400).json({ error: 'Deleted messages cannot be edited' });
    }

    const { data: previousAttachments, error: previousAttachmentsError } = await supabaseAdmin
      .from('message_attachments')
      .select('*')
      .eq('message_id', messageId)
      .eq('room_id', roomId);

    if (previousAttachmentsError) {
      console.error('Error loading message attachments for history snapshot', previousAttachmentsError);
      return res.status(500).json({ error: 'Failed to edit message' });
    }

    await saveMessageHistorySnapshotOnMessage(existing as Record<string, any>, 'edit', String(req.userId || ''), previousAttachments || []);

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('messages')
      .update({ content: trimmedContent, edited_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', messageId)
      .eq('room_id', roomId)
      .select('*')
      .single();

    if (updateError || !updated) {
      return res.status(500).json({ error: 'Failed to edit message' });
    }

    const profiles = await fetchProfilesByIds([String((updated as any).user_id)]);
    const attachmentsByMessageId = await fetchAttachmentsByMessageIds([String((updated as any).id)]);
    const payload: MessageWithUser = {
      ...(updated as any),
      user: profiles[(updated as any).user_id],
      attachments: attachmentsByMessageId[String((updated as any).id)] || [],
    };

    broadcastToRoom(roomId, { type: 'message_updated', roomId, message: payload } as ChatSocketPayload);
    return res.json(payload);
  } catch (error) {
    console.error('Error editing message', error);
    return res.status(500).json({ error: 'Failed to edit message' });
  }
});

app.delete('/api/rooms/:roomId/messages/:messageId', chatWriteRateLimit, requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { roomId, messageId } = req.params;

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .eq('room_id', roomId)
      .single();

    if (existingError || !existing) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (String((existing as any).user_id) !== String(req.userId || '')) {
      return res.status(403).json({ error: 'Only the sender can delete this message' });
    }

    if ((existing as any).deleted_at) {
      const profiles = await fetchProfilesByIds([String((existing as any).user_id)]);
      const attachmentsByMessageId = await fetchAttachmentsByMessageIds([String((existing as any).id)]);
      const existingPayload: MessageWithUser = {
        ...(existing as any),
        user: profiles[(existing as any).user_id],
        attachments: attachmentsByMessageId[String((existing as any).id)] || [],
      };
      return res.json(existingPayload);
    }

    const { data: previousAttachments, error: previousAttachmentsError } = await supabaseAdmin
      .from('message_attachments')
      .select('*')
      .eq('message_id', messageId)
      .eq('room_id', roomId);

    if (previousAttachmentsError) {
      console.error('Error loading message attachments for history snapshot', previousAttachmentsError);
      return res.status(500).json({ error: 'Failed to delete message' });
    }

    await saveMessageHistorySnapshotOnMessage(existing as Record<string, any>, 'delete', String(req.userId || ''), previousAttachments || []);

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('messages')
      .update({
        content: 'This message was deleted.',
        deleted_at: now,
        deleted_by: req.userId!,
        updated_at: now,
      })
      .eq('id', messageId)
      .eq('room_id', roomId)
      .select('*')
      .single();

    if (updateError || !updated) {
      return res.status(500).json({ error: 'Failed to delete message' });
    }

    const attachmentPaths = (previousAttachments || [])
      .filter((attachment: any) => String(attachment.bucket || '') === 'chat-attachments')
      .map((attachment: any) => String(attachment.path || ''))
      .filter(Boolean);
    if (attachmentPaths.length > 0) {
      const { error: storageCleanupError } = await supabaseAdmin.storage.from('chat-attachments').remove(attachmentPaths);
      if (storageCleanupError) {
        console.error('[chat] failed to remove deleted message attachments from storage', {
          roomId,
          messageId,
          paths: attachmentPaths,
          error: storageCleanupError.message || storageCleanupError,
        });
      }
    }
    const { error: attachmentDeleteError } = await supabaseAdmin
      .from('message_attachments')
      .delete()
      .eq('message_id', messageId)
      .eq('room_id', roomId);
    if (attachmentDeleteError) {
      console.error('[chat] failed to remove deleted message attachment rows', {
        roomId,
        messageId,
        error: attachmentDeleteError.message || attachmentDeleteError,
      });
    }

    const profiles = await fetchProfilesByIds([String((updated as any).user_id)]);
    const payload: MessageWithUser = {
      ...(updated as any),
      user: profiles[(updated as any).user_id],
      attachments: [],
    };

    broadcastToRoom(roomId, { type: 'message_updated', roomId, message: payload } as ChatSocketPayload);
    return res.json(payload);
  } catch (error) {
    console.error('Error deleting message', error);
    return res.status(500).json({ error: 'Failed to delete message' });
  }
});

// -------------------- RECEIPTS (FIXED) --------------------
// This endpoint is served by EXPRESS, not Next's app/api, because /api/* is intercepted here.
app.post('/api/rooms/:roomId/receipts', chatReceiptRateLimit, requireAuth, async (req: AuthedRequest, res: Response) => {
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
app.get('/api/rooms/:roomId/members', chatReadRateLimit, requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { roomId } = req.params;
    const members = await fetchRoomMembers(roomId);
    return res.json(members);
  } catch (error) {
    console.error('Error loading members', error);
    return res.status(500).json({ error: 'Failed to load members' });
  }
});

app.post('/api/rooms/:roomId/leave', chatWriteRateLimit, requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { roomId } = req.params;
    await supabaseAdmin.from('room_members').delete().eq('room_id', roomId).eq('user_id', req.userId!);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error leaving room', error);
    return res.status(500).json({ error: 'Failed to leave room' });
  }
});

app.delete('/api/rooms/:roomId', chatWriteRateLimit, requireAuth, async (req: AuthedRequest, res: Response) => {
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

if (isDev) {
  const nextWebpackCacheDir = path.join(process.cwd(), '.next', 'cache', 'webpack');
  try {
    fs.rmSync(nextWebpackCacheDir, { recursive: true, force: true });
    console.warn('[dev-cache] Cleared Next webpack cache to avoid stale client chunk parse errors.');
  } catch (error) {
    console.warn('[dev-cache] Failed to clear Next webpack cache directory.', error);
  }
}

// Next and the chat socket must share the same HTTP server. Passing the
// server into Next lets it register its development WebSocket upgrade
// handler instead of leaving /_next/* HMR connections unhandled.
const server = http.createServer();
const nextApp = next({
  dev: isDev,
  hostname: '0.0.0.0',
  port: PORT,
  httpServer: server,
  ...(isDev ? { webpack: true, turbopack: false } : {}),
});
const nextHandler = nextApp.getRequestHandler();

// These handlers live in Next route files, while every /api/* request enters
// Express first. Forward the complete Next-owned API surface explicitly.
app.all(
  [
    '/api/auth/profile',
    '/api/delegates',
    '/api/upload-image',
    '/api/chat/attachments/upload',
    '/api/chat/attachments/sign',
    '/api/chat/attachments/pending',
  ],
  (req: Request, res: Response) => {
    void nextHandler(req, res);
  },
);

const CHAT_WS_PATH = '/chat-ws'; // Keep in sync with app/messages/context/ChatContext.tsx

server.on('request', (req, res) => {
  const url = req.url || '';
  if (url.startsWith('/api/')) {
    app(req, res);
    return;
  }
  void nextHandler(req, res);
});

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (socket, req) => {
  logServerDebug('socket:connection_opened', {
    hasCookie: Boolean(req.headers.cookie),
    hasAuthorizationHeader: Boolean(req.headers['authorization']),
    url: req.url || null,
  });
  const context: Partial<SocketContext> = { socket, roomIds: new Set<string>() };
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

  const authenticateFromBearer = async (accessToken?: string | null) => {
    const bearerToken = accessToken || getBearerTokenFromHeaders(req.headers);
    logServerDebug('socket:auth:start', {
      hasBearerToken: Boolean(bearerToken),
      hasProvidedToken: Boolean(accessToken),
    });
    if (!bearerToken) {
      logServerDebug('socket:auth:missing_bearer_token');
      return false;
    }

    const sessionUser = await verifySupabaseAccessToken(bearerToken);
    if (!sessionUser) {
      logServerDebug('socket:auth:token_verification_failed');
      return false;
    }

    logServerDebug('socket:auth_identity_resolved', { resolvedActorId: sessionUser.id, role: sessionUser.role });
    finishSocketAuthentication(sessionUser.id);
    return true;
  };

  const disconnect = () => {
    if (disconnected) return;
    disconnected = true;
    clearTimeout(authTimeout);
    logServerDebug('socket:disconnect', {
      userId: context.userId || null,
      roomIds: Array.from(context.roomIds || []),
      activeRoomId: context.activeRoomId || null,
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
        roomIds: Array.from(context.roomIds || []),
        activeRoomId: context.activeRoomId || null,
        payload: data,
      });

      switch (data.type) {
        case 'auth': {
          if (authenticated) {
            socket.send(JSON.stringify({ type: 'authenticated' } satisfies ChatSocketPayload));
            sendOnlineUsersSnapshot(socket);
            return;
          }
          if (!await authenticateFromBearer(data.token)) {
            socket.send(JSON.stringify({ type: 'auth_error' } satisfies ChatSocketPayload));
            socket.close();
            return;
          }
          clearTimeout(authTimeout);
          return;
        }
        case 'join_room': {
          if (!authenticated || !context.userId || !data.roomId) return;
          logServerDebug('socket:join_room:attempt', { roomId: data.roomId, resolvedUserId: context.userId });

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

          context.roomIds?.add(data.roomId);
          context.activeRoomId = data.roomId;
          socket.send(JSON.stringify({ type: 'room_joined', roomId: data.roomId } satisfies ChatSocketPayload));
          return;
        }
        case 'typing': {
          if (!authenticated || !context.userId || !context.activeRoomId || !data.roomId || data.roomId !== context.activeRoomId) return;
          logServerDebug('socket:typing:event', {
            roomId: context.activeRoomId,
            resolvedUserId: context.userId,
            isTyping: data.isTyping ?? true,
          });
          broadcastToRoom(context.activeRoomId, {
            type: 'user_typing',
            roomId: context.activeRoomId,
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
  const nextUpgradeHandler = nextApp.getUpgradeHandler();

  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '/', 'http://localhost').pathname;

    if (pathname === CHAT_WS_PATH) {
      wss.handleUpgrade(request, socket, head, (webSocket) => {
        wss.emit('connection', webSocket, request);
      });
      return;
    }

    void nextUpgradeHandler(request, socket, head);
  });

  server.listen(PORT, () => {
    console.warn(`Unified Next + chat server listening on http://localhost:${PORT}`);
  });
};

start().catch((error) => {
  console.error('Failed to start unified server', error);
  process.exit(1);
});

export default app;
