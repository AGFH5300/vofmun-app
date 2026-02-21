// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
import express, { NextFunction, Request, Response } from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import next from 'next';
import supabaseAdmin from '../../lib/supabaseAdmin.ts';
import { getSessionUserFromCookieHeader } from '../../lib/chat/auth.ts';
import { ChatSocketPayload, FriendRequest, MessageWithUser, RoomMember, RoomWithDetails, RoomType, User } from '../../lib/chat/types.ts';
import { fetchPersonById, isVisibleToViewer, mapProfileForChat, searchPeople } from './people.ts';
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

const requireAuth = (req: AuthedRequest, res: Response, next: NextFunction) => {
  const sessionUser = getSessionUserFromCookieHeader(req.headers.cookie || '');
  if (!sessionUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.userId = sessionUser.id;
  return next();
};

const activeSockets = new Set<SocketContext>();
const CHAT_SERVER_DEBUG_PREFIX = '[ChatServerDebug]';
const isServerDebugEnabled = process.env.CHAT_SERVER_DEBUG === '1' || process.env.NODE_ENV !== 'production';
const userConnectionCounts = new Map<string, number>();

const logServerDebug = (message: string, details?: Record<string, unknown>) => {
  if (!isServerDebugEnabled) return;
  if (details) {
    console.warn(`${CHAT_SERVER_DEBUG_PREFIX} ${message}`, details);
    return;
  }
  console.warn(`${CHAT_SERVER_DEBUG_PREFIX} ${message}`);
};

const getOnlineUserIds = () => Array.from(userConnectionCounts.entries())
  .filter(([, count]) => count > 0)
  .map(([userId]) => userId);

const sendOnlineUsersSnapshot = (target: WebSocket) => {
  target.send(JSON.stringify({ type: 'online_users', onlineUserIds: getOnlineUserIds() } satisfies ChatSocketPayload));
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
  const [admins, chairs, delegates, secs] = await Promise.all([
    supabaseAdmin.from('Admin').select('adminID, firstname, lastname, email').in('adminID', uniqueIds),
    supabaseAdmin.from('Chair').select('chairID, firstname, lastname, email').in('chairID', uniqueIds),
    supabaseAdmin.from('Delegate').select('delegateID, firstname, lastname, email, country, committeeID').in('delegateID', uniqueIds),
    supabaseAdmin.from('Secretariat').select('secretariatID, firstname, lastname, email').in('secretariatID', uniqueIds),
  ]);

  const delegateCommitteeIds = new Set<string>();
  (delegates.data || []).forEach((row) => {
    if (row.committeeID) delegateCommitteeIds.add(row.committeeID);
  });

  const chairCommitteeIds = new Set<string>();
  if (chairs.data && chairs.data.length > 0) {
    const { data: chairLinks, error } = await supabaseAdmin
      .from('Committee-Chair')
      .select('chairID, committeeID')
      .in('chairID', chairs.data.map((row) => row.chairID));

    if (error) {
      console.error('[chat] failed to load chair committees', error);
    }

    (chairLinks || []).forEach((link) => {
      if (link.committeeID) chairCommitteeIds.add(link.committeeID);
    });
  }

  const committeeIds = new Set([...delegateCommitteeIds, ...chairCommitteeIds]);
  const committeeMap = new Map<string, string | null>();
  if (committeeIds.size > 0) {
    const { data: committees } = await supabaseAdmin
      .from('Committee')
      .select('committeeID, committeeCode, name')
      .in('committeeID', Array.from(committeeIds));

    (committees || []).forEach((committee) => {
      committeeMap.set(committee.committeeID, committee.committeeCode || committee.name || null);
    });
  }

  const chairCommitteeMap = new Map<string, string | null>();
  if (chairCommitteeIds.size > 0) {
    const { data: chairLinks } = await supabaseAdmin
      .from('Committee-Chair')
      .select('chairID, committeeID')
      .in('committeeID', Array.from(chairCommitteeIds));

    (chairLinks || []).forEach((link) => {
      chairCommitteeMap.set(link.chairID, link.committeeID ? committeeMap.get(link.committeeID) || null : null);
    });
  }

  const map: Record<string, User> = {};
  (admins.data || []).forEach((row) => {
    const profile = mapProfileForChat(row, 'admin');
    map[profile.id] = profile;
  });
  (chairs.data || []).forEach((row) => {
    const profile = mapProfileForChat(row, 'chair', {
      committee: chairCommitteeMap.get(row.chairID) || null,
    });
    map[profile.id] = profile;
  });
  (delegates.data || []).forEach((row) => {
    const profile = mapProfileForChat(row, 'delegate', {
      committee: row.committeeID ? committeeMap.get(row.committeeID) || null : null,
      country: row.country || null,
    });
    map[profile.id] = profile;
  });
  (secs.data || []).forEach((row) => {
    const profile = mapProfileForChat(row, 'secretariat');
    map[profile.id] = profile;
  });
  return map;
};

const fetchRoomMembers = async (roomId: string): Promise<RoomMember[]> => {
  const { data } = await supabaseAdmin
    .from('room_members')
    .select('id, room_id, user_id, role, joined_at')
    .eq('room_id', roomId);
  const members = data || [];
  const profiles = await fetchProfilesByIds(members.map((m) => m.user_id).filter(Boolean));
  return members.map((member) => ({
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
  const msg = data[0];
  const profiles = await fetchProfilesByIds([msg.user_id]);
  return { ...msg, user: profiles[msg.user_id] } as MessageWithUser;
};

app.get('/api/rooms', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { data: memberships } = await supabaseAdmin
      .from('room_members')
      .select('room_id, role')
      .eq('user_id', req.userId!);

    const roomIds = (memberships || []).map((m) => m.room_id);
    if (roomIds.length === 0) {
      return res.json([] as RoomWithDetails[]);
    }

    const { data: rooms } = await supabaseAdmin
      .from('chat_rooms')
      .select('*')
      .in('id', roomIds);

    const results: RoomWithDetails[] = [];
    for (const room of rooms || []) {
      const members = await fetchRoomMembers(room.id);
      const lastMessage = await fetchLastMessage(room.id);
      const room_type = deriveRoomType(room, members);
      results.push({ ...room, members, lastMessage, room_type });
    }

    return res.json(results);
  } catch (error) {
    console.error('Error listing rooms', error);
    return res.status(500).json({ error: 'Failed to load rooms' });
  }
});

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
      .or(
        `and(sender_id.eq.${req.userId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${req.userId})`
      );

    const blocker = (existing || []).find((item) => item.status === 'pending' || item.status === 'accepted');
    if (blocker) {
      const profiles = await fetchProfilesByIds([req.userId!, targetUserId]);
      return res.json({
        ...(blocker as FriendRequest),
        sender: profiles[blocker.sender_id],
        receiver: profiles[blocker.receiver_id],
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
    (data || []).forEach((reqItem) => {
      ids.add(reqItem.sender_id);
      ids.add(reqItem.receiver_id);
    });
    const profiles = await fetchProfilesByIds(Array.from(ids));

    const enriched = (data || []).map((item) => ({
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
    (data || []).forEach((reqItem) => {
      ids.add(reqItem.sender_id);
      ids.add(reqItem.receiver_id);
    });
    const profiles = await fetchProfilesByIds(Array.from(ids));

    const enriched = (data || []).map((item) => ({
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
    const { data: updated } = await supabaseAdmin
      .from('friend_requests')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (status === 'accepted' && updated) {
      await supabaseAdmin.from('friendships').upsert(
        { user1_id: updated.sender_id, user2_id: updated.receiver_id },
        { onConflict: 'user1_id,user2_id' }
      );
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error responding to friend request', error);
    return res.status(500).json({ error: 'Failed to update request' });
  }
});

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

    const { data: myMemberships } = await supabaseAdmin
      .from('room_members')
      .select('room_id')
      .eq('user_id', req.userId!);
    const roomIds = (myMemberships || []).map((m) => m.room_id);

    let existingRoomId: string | null = null;
    if (roomIds.length > 0) {
      const { data: mutualRooms } = await supabaseAdmin
        .from('room_members')
        .select('room_id')
        .eq('user_id', targetUserId)
        .in('room_id', roomIds);

      existingRoomId = mutualRooms?.[0]?.room_id ?? null;
    }

    let roomId = existingRoomId;
    if (!roomId) {
      const { data: createdRoom, error } = await supabaseAdmin
        .from('chat_rooms')
        .insert({
          name: 'Direct message',
          description: null,
          is_private: true,
          created_by: req.userId!,
        })
        .select('id')
        .single();

      if (error || !createdRoom) {
        return res.status(500).json({ error: 'Failed to create room' });
      }

      roomId = createdRoom.id;
      await supabaseAdmin.from('room_members').insert([
        { room_id: roomId, user_id: req.userId!, role: 'member' },
        { room_id: roomId, user_id: targetUserId, role: 'member' },
      ]);
    }

    const { data: room } = await supabaseAdmin
      .from('chat_rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    const members = await fetchRoomMembers(roomId);
    const lastMessage = await fetchLastMessage(roomId);

    return res.json({ ...room, members, lastMessage, room_type: deriveRoomType(room, members) } as RoomWithDetails);
  } catch (error) {
    console.error('Error creating direct room', error);
    return res.status(500).json({ error: 'Failed to create direct room' });
  }
});

app.post('/api/rooms/group', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { name, description, memberIds } = req.body as {
      name?: string;
      description?: string;
      memberIds?: string[];
    };
    if (!name || !memberIds || memberIds.length === 0) {
      return res.status(400).json({ error: 'Missing group details' });
    }

    const allMembers = Array.from(new Set([req.userId!, ...memberIds]));

    const visibilityChecks = await Promise.all(
      memberIds.map(async (memberId) => ({ memberId, allowed: await canInteractWithUser(req.userId!, memberId) }))
    );

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
      .insert(allMembers.map((id) => ({ room_id: createdRoom.id, user_id: id, role: id === req.userId ? 'admin' : 'member' })));

    const members = await fetchRoomMembers(createdRoom.id);
    const lastMessage = await fetchLastMessage(createdRoom.id);
    return res.json({ ...createdRoom, members, lastMessage, room_type: deriveRoomType(createdRoom, members) } as RoomWithDetails);
  } catch (error) {
    console.error('Error creating group room', error);
    return res.status(500).json({ error: 'Failed to create group room' });
  }
});

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

    const profiles = await fetchProfilesByIds((messages || []).map((msg) => msg.user_id));
    const formatted = (messages || []).map((msg) => ({ ...msg, user: profiles[msg.user_id] } as MessageWithUser));
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

    const profiles = await fetchProfilesByIds([inserted.user_id]);
    const payload: MessageWithUser = { ...inserted, user: profiles[inserted.user_id] };
    broadcastToRoom(roomId, { type: 'new_message', message: payload });

    return res.json(payload);
  } catch (error) {
    console.error('Error sending message', error);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

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
    await supabaseAdmin
      .from('room_members')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', req.userId!);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error leaving room', error);
    return res.status(500).json({ error: 'Failed to leave room' });
  }
});

app.delete('/api/rooms/:roomId', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { roomId } = req.params;
    const { data: room } = await supabaseAdmin
      .from('chat_rooms')
      .select('created_by')
      .eq('id', roomId)
      .single();

    if (!room || room.created_by !== req.userId) {
      return res.status(403).json({ error: 'Only the creator can delete the room' });
    }

    await supabaseAdmin.from('chat_rooms').delete().eq('id', roomId);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting room', error);
    return res.status(500).json({ error: 'Failed to delete room' });
  }
});

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
    finishSocketAuthentication(sessionUser.id);
    return true;
  };

  authenticateFromCookie();
  if (authenticated) {
    clearTimeout(authTimeout);
  }

  const disconnect = () => {
    if (disconnected) return;
    disconnected = true;
    clearTimeout(authTimeout);
    logServerDebug('socket:disconnect', { userId: context.userId || null, roomId: context.roomId || null, activeSocketCountBefore: activeSockets.size });
    if (authenticated && context.userId) {
      decrementUserConnection(context.userId);
    }
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
            logServerDebug('socket:auth:already_authenticated_resync_state', {
              userId: context.userId || null,
              onlineUserIds: getOnlineUserIds(),
            });
            socket.send(JSON.stringify({ type: 'authenticated' } satisfies ChatSocketPayload));
            sendOnlineUsersSnapshot(socket);
            return;
          }
          if (!authenticateFromCookie()) {
            logServerDebug('socket:auth:failed_closing_socket', { reason: 'missing_or_invalid_session_cookie' });
            socket.send(JSON.stringify({ type: 'auth_error' } satisfies ChatSocketPayload));
            socket.close();
            return;
          }
          clearTimeout(authTimeout);
          return;
        }
        case 'join_room': {
          if (!authenticated || !context.userId || !data.roomId) {
            logServerDebug('socket:join_room:rejected_precondition', { authenticated, userId: context.userId || null, roomId: data.roomId || null });
            return;
          }
          const { data: membership } = await supabaseAdmin
            .from('room_members')
            .select('id')
            .eq('room_id', data.roomId)
            .eq('user_id', context.userId)
            .single();
          if (!membership) {
            logServerDebug('socket:join_room:not_member', { userId: context.userId, roomId: data.roomId });
            return;
          }
          context.roomId = data.roomId;
          logServerDebug('socket:join_room:success', { userId: context.userId, roomId: data.roomId });
          socket.send(JSON.stringify({ type: 'room_joined', roomId: data.roomId } satisfies ChatSocketPayload));
          return;
        }
        case 'typing': {
          if (!authenticated || !context.userId || !context.roomId || !data.roomId || data.roomId !== context.roomId) {
            logServerDebug('socket:typing:rejected_precondition', {
              authenticated,
              userId: context.userId || null,
              joinedRoomId: context.roomId || null,
              incomingRoomId: data.roomId || null,
              isTyping: data.isTyping ?? true,
            });
            return;
          }
          logServerDebug('socket:typing:broadcast', {
            userId: context.userId,
            joinedRoomId: context.roomId,
            incomingRoomId: data.roomId || null,
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
          logServerDebug('socket:unhandled_message_type', { type: data.type });
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
