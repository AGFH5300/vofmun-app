// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
import express, { NextFunction, Request, Response } from 'express';
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
  roomId?: string;
  socket: WebSocket;
}

const app = express();
app.use(express.json());

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

if (!supabaseAdmin) {
  throw new Error('Supabase admin client is not configured. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

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

const fetchLastMessage = async (roomId: string): Promise<MessageWithUser | null> => {
  const { data } = await supabaseAdmin
    .from('messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (!data || data.length === 0) return null;
  const msg = data[0] as any;
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
    const lastMessage = await fetchLastMessage(roomId);

    return res.json({ ...(room as any), members, lastMessage, room_type: deriveRoomType(room as any, members) } as RoomWithDetails);
  } catch (error) {
    console.error('Error creating direct room', error);
    return res.status(500).json({ error: 'Failed to create direct room' });
  }
});

app.post('/api/rooms/group', requireAuth, async (req: AuthedRequest, res: Response) => {
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

    const normalizedMemberIds = Array.from(
      new Set(memberIds.map((id) => String(id).trim()).filter((id) => Boolean(id) && id !== req.userId))
    );

    if (normalizedMemberIds.some((id) => !isUuid(id))) {
      return res.status(400).json({ error: 'One or more participants are invalid' });
    }

    if (normalizedMemberIds.length === 0) {
      return res.status(400).json({ error: 'Select at least one participant' });
    }

    if (normalizedMemberIds.length < 2) {
      return res.status(400).json({ error: 'Select at least two participants for a group chat' });
    }

    console.debug('[GroupCreateDebug] request_received', {
      creatorUserId: req.userId,
      name: trimmedName,
      memberCount: normalizedMemberIds.length,
      memberIds: normalizedMemberIds,
    });

    const existingIds = await fetchExistingAppUserIds(normalizedMemberIds);
    if (existingIds.size !== normalizedMemberIds.length) {
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
        created_by: req.userId!,
      })
      .select('*')
      .single();

    if (error || !createdRoom) {
      return res.status(500).json({ error: 'Failed to create room' });
    }

    const memberRows = [
      { room_id: (createdRoom as any).id, user_id: req.userId!, role: 'admin' as const },
      ...normalizedMemberIds.map((id) => ({ room_id: (createdRoom as any).id, user_id: id, role: 'member' as const })),
    ];

    const { error: memberInsertError } = await supabaseAdmin
      .from('room_members')
      .insert(memberRows);

    if (memberInsertError) {
      console.error('Error adding group room members', memberInsertError);
      return res.status(500).json({ error: 'Failed to create room members' });
    }

    const members = await fetchRoomMembers((createdRoom as any).id);
    const lastMessage = await fetchLastMessage((createdRoom as any).id);

    console.debug('[GroupCreateDebug] room_created', {
      roomId: (createdRoom as any).id,
      creatorIncluded: members.some((member) => String(member.user_id) === String(req.userId)),
      memberCount: members.length,
    });

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

    const profileIds = Array.from(new Set((messages || []).map((msg: any) => String(msg.user_id)).filter(Boolean)));
    const messageIds = (messages || []).map((msg: any) => String(msg.id)).filter(Boolean);
    const profiles = await fetchProfilesByIds(profileIds);
    const attachmentsByMessageId = await fetchAttachmentsByMessageIds(messageIds);
    const formatted = (messages || []).map((msg: any) => {
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

app.post('/api/rooms/:roomId/messages', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { roomId } = req.params;
    const { content, reply_to, attachments = [] } = req.body as {
      content?: string;
      reply_to?: string | null;
      attachments?: MessageAttachmentInput[];
    };
    const trimmedContent = content?.trim() || '';
    const normalizedAttachments = Array.isArray(attachments) ? attachments : [];

    if (!trimmedContent && normalizedAttachments.length === 0) {
      return res.status(400).json({ error: 'Message content or attachments are required' });
    }

    const hasInvalidAttachment = normalizedAttachments.some((attachment) => {
      if (!attachment || typeof attachment !== 'object') return true;
      if (String(attachment.room_id || '') !== roomId) return true;
      if (!attachment.bucket || !attachment.path || !attachment.original_name || !attachment.mime_type) return true;
      if (!Number.isFinite(Number(attachment.size_bytes)) || Number(attachment.size_bytes) <= 0) return true;
      return !isAllowedAttachmentPath(roomId, String(attachment.path || ''));
    });

    if (hasInvalidAttachment) {
      return res.status(400).json({ error: 'Invalid attachment payload' });
    }

    logServerDebug('http:messages:insert_attempt', {
      roomId,
      resolvedUserId: req.userId || null,
      hasContent: Boolean(trimmedContent),
      attachmentCount: normalizedAttachments.length,
    });

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
      .insert({ room_id: roomId, user_id: req.userId!, content: trimmedContent, reply_to: reply_to || null })
      .select('*')
      .single();

    if (error || !inserted) {
      return res.status(500).json({ error: 'Failed to send message' });
    }

    if (normalizedAttachments.length > 0) {
      const attachmentRows = normalizedAttachments.map((attachment) => ({
        message_id: (inserted as any).id,
        room_id: roomId,
        bucket: String(attachment.bucket || 'chat-attachments'),
        path: String(attachment.path || ''),
        original_name: sanitizeAttachmentName(String(attachment.original_name || 'file')),
        mime_type: attachment.mime_type || null,
        size_bytes: Number(attachment.size_bytes || 0),
        created_by: req.userId!,
      }));

      const { error: attachmentError } = await supabaseAdmin.from('message_attachments').insert(attachmentRows);
      if (attachmentError) {
        await supabaseAdmin.from('message_attachments').delete().eq('message_id', (inserted as any).id);
        await supabaseAdmin.from('messages').delete().eq('id', (inserted as any).id);
        return res.status(500).json({ error: 'Failed to save attachments' });
      }
    }

    const profiles = await fetchProfilesByIds([String((inserted as any).user_id)]);
    const attachmentsByMessageId = await fetchAttachmentsByMessageIds([String((inserted as any).id)]);

    const payload: MessageWithUser = {
      ...(inserted as any),
      user: profiles[(inserted as any).user_id],
      attachments: attachmentsByMessageId[String((inserted as any).id)] || [],
    };

    console.debug('message profile enrichment', {
      roomId,
      currentUserId: req.userId,
      messageId: payload.id,
      messageUserId: payload.user_id,
      attachedProfileId: payload.user?.id ?? null,
    });

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

if (isDev) {
  const nextWebpackCacheDir = path.join(process.cwd(), '.next', 'cache', 'webpack');
  try {
    fs.rmSync(nextWebpackCacheDir, { recursive: true, force: true });
    console.warn('[dev-cache] Cleared Next webpack cache to avoid stale client chunk parse errors.');
  } catch (error) {
    console.warn('[dev-cache] Failed to clear Next webpack cache directory.', error);
  }
}

const nextApp = next({ dev: isDev, hostname: '0.0.0.0', port: PORT, turbopack: isDev });
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
  logServerDebug('socket:connection_opened', {
    hasCookie: Boolean(req.headers.cookie),
    hasAuthorizationHeader: Boolean(req.headers['authorization']),
    url: req.url || null,
  });
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

          context.roomId = data.roomId;
          socket.send(JSON.stringify({ type: 'room_joined', roomId: data.roomId } satisfies ChatSocketPayload));
          return;
        }
        case 'typing': {
          if (!authenticated || !context.userId || !context.roomId || !data.roomId || data.roomId !== context.roomId) return;
          logServerDebug('socket:typing:event', {
            roomId: context.roomId,
            resolvedUserId: context.userId,
            isTyping: data.isTyping ?? true,
          });
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
