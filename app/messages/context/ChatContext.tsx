'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChatSocketPayload,
  FriendRequest,
  MessageStatus,
  MessageWithUser,
  RoomWithDetails,
  UserSearchResult,
} from '@/lib/chat/types';
import { useSession } from '@/app/context/sessionContext';

const CHAT_WS_URL = process.env.NEXT_PUBLIC_CHAT_WS_URL;
const CHAT_API_URL = process.env.NEXT_PUBLIC_CHAT_API_URL || '';

type PeopleSearchResult = {
  id: string;
  role: 'admin' | 'delegate' | 'chair' | 'secretariat';
  displayName: string;
  email: string | null;
  committeeCode?: string | null;
  country?: string | null;
};

interface ChatContextValue {
  rooms: RoomWithDetails[];
  activeRoom: RoomWithDetails | null;
  messages: Record<string, MessageWithUser[]>;
  typingUsers: Record<string, Set<string>>;
  onlineUsers: Set<string>;
  isConnecting: boolean;
  friendRequests: FriendRequest[];
  incomingRequests: FriendRequest[];
  currentUserId: string | null;
  pinnedRoomIds: Set<string>;
  selectRoom: (room: RoomWithDetails) => Promise<void>;
  refreshRooms: () => Promise<RoomWithDetails[]>;
  refreshRoomMessages: (roomId: string) => Promise<void>;
  sendMessage: (roomId: string, content: string, replyTo?: string | null) => Promise<void>;
  sendTyping: (roomId: string, isTyping: boolean) => void;
  togglePin: (roomId: string) => void;
  createDirectRoom: (targetUserId: string) => Promise<RoomWithDetails | null>;
  createGroupRoom: (payload: {
    name: string;
    description?: string;
    icon?: string;
    memberIds: string[];
  }) => Promise<RoomWithDetails | null>;
  searchUsers: (query: string) => Promise<UserSearchResult[]>;
  refreshFriendRequests: () => Promise<void>;
  sendFriendRequest: (targetUserId: string) => Promise<FriendRequest | null>;
  respondToFriendRequest: (id: string, action: 'accept' | 'reject') => Promise<void>;
  acceptFriendRequest: (id: string) => Promise<void>;
  declineFriendRequest: (id: string) => Promise<void>;
  openDirectMessageRoomForUser: (userId: string) => Promise<RoomWithDetails | null>;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);
const CHAT_DEBUG_PREFIX = '[ChatDebug]';
const isChatDebugEnabled = process.env.NEXT_PUBLIC_CHAT_DEBUG === '1' || process.env.NODE_ENV !== 'production';
const TYPING_TRUE_THROTTLE_MS = 1000;
const TYPING_IDLE_TIMEOUT_MS = 2500;
const TYPING_REMOTE_EXPIRY_MS = 5000;
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 12000;

const logChatDebug = (message: string, details?: Record<string, unknown>) => {
  if (!isChatDebugEnabled) return;
  if (details) {
    console.warn(`${CHAT_DEBUG_PREFIX} ${message}`, details);
    return;
  }
  console.warn(`${CHAT_DEBUG_PREFIX} ${message}`);
};

const getWebSocketUrl = () => {
  const source = CHAT_WS_URL || CHAT_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  if (!source) return null;

  try {
    const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const url = new URL(source, baseOrigin);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const normalizedPath = url.pathname.replace(/\/$/, '');
    const basePathWithoutApi = normalizedPath.startsWith('/api')
      ? ''
      : normalizedPath.endsWith('/api')
        ? normalizedPath.slice(0, -4)
        : normalizedPath;
    const hasSocketPath = /\/chat-ws\/?$/.test(url.pathname);
    const pathname = hasSocketPath
      ? url.pathname
      : `${basePathWithoutApi || ''}/chat-ws`;
    return `${protocol}//${url.host}${pathname}`;
  } catch (error) {
    console.error('[ChatContext] failed to derive WebSocket URL', {
      source,
      error: error instanceof Error ? error.message : 'unknown-error',
    });
    return null;
  }
};

const normalizeFriendRequestStatus = (status?: string | null) => (status === 'declined' ? 'rejected' : status || 'pending');

export const ChatProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [rooms, setRooms] = useState<RoomWithDetails[]>([]);
  const [activeRoom, setActiveRoom] = useState<RoomWithDetails | null>(null);
  const [messages, setMessages] = useState<Record<string, MessageWithUser[]>>({});
  const [typingUsers, setTypingUsers] = useState<Record<string, Set<string>>>({});
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const { user } = useSession();
  const [userId, setUserId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [pinnedRoomIds, setPinnedRoomIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set<string>();
    const stored = window.localStorage.getItem('pinnedRooms');
    return new Set(stored ? JSON.parse(stored) : []);
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const pendingRoomJoinRef = useRef<string | null>(null);
  const activeRoomIdRef = useRef<string | null>(null);
  const roomsRef = useRef<RoomWithDetails[]>([]);
  const onlineUsersRef = useRef<Set<string>>(new Set());
  const userIdRef = useRef<string | null>(null);
  const shouldReconnectRef = useRef(true);
  const typingThrottleRef = useRef<Map<string, number>>(new Map());
  const typingIdleTimeoutRef = useRef<Map<string, number>>(new Map());
  const typingExpiryRef = useRef<Map<string, Map<string, number>>>(new Map());

  const toComparableId = useCallback((value: string | number | null | undefined) => String(value ?? ''), []);

  const withAuthHeaders = useCallback(
    (extra?: RequestInit): RequestInit => ({
      credentials: 'include',
      ...extra,
      headers: {
        'Content-Type': 'application/json',
        ...(extra?.headers || {}),
      },
    }),
    []
  );

  useEffect(() => {
    if (!user) {
      setUserId(null);
      return;
    }
    const candidate =
      ('delegateID' in user && user.delegateID ? user.delegateID : null) ||
      ('chairID' in user && user.chairID ? user.chairID : null) ||
      ('adminID' in user && user.adminID ? user.adminID : null) ||
      ('secretariatID' in user && user.secretariatID ? user.secretariatID : null) ||
      ('id' in user && user.id ? user.id : null);

    if (candidate) {
      setUserId(String(candidate));
      return;
    }
    setUserId(null);
  }, [user]);


  useEffect(() => {
    activeRoomIdRef.current = activeRoom?.id || null;
  }, [activeRoom?.id]);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  useEffect(() => {
    onlineUsersRef.current = onlineUsers;
  }, [onlineUsers]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const resolveOwnMessageStatus = useCallback((roomId: string, messageUserId?: string | null): MessageStatus | undefined => {
    const currentUserId = userIdRef.current;
    if (!currentUserId || !messageUserId || String(currentUserId) !== String(messageUserId)) {
      return undefined;
    }

    const room = roomsRef.current.find((candidate) => candidate.id === roomId);
    if (!room || room.room_type !== 'dm') {
      return 'sent';
    }

    const hasOnlineRecipient = room.members.some(
      (member) => String(member.user_id) !== String(currentUserId) && onlineUsersRef.current.has(String(member.user_id))
    );

    logChatDebug('resolveOwnMessageStatus', {
      roomId,
      messageUserId,
      currentUserId,
      memberIds: room.members.map((member) => String(member.user_id)),
      onlineUsers: Array.from(onlineUsersRef.current),
      status: hasOnlineRecipient ? 'delivered' : 'sent',
    });

    return hasOnlineRecipient ? 'delivered' : 'sent';
  }, []);

  const reconcileOwnDmMessageStatuses = useCallback(() => {
    setMessages((prev) => {
      let changed = false;
      const next: Record<string, MessageWithUser[]> = {};

      Object.entries(prev).forEach(([roomId, list]) => {
        const updated = list.map((message) => {
          const nextStatus = resolveOwnMessageStatus(roomId, message.user_id) || message.status;
          if (nextStatus !== message.status) {
            changed = true;
            return { ...message, status: nextStatus };
          }
          return message;
        });
        next[roomId] = updated;
      });

      return changed ? next : prev;
    });
  }, [resolveOwnMessageStatus]);

  const refreshRooms = useCallback(async () => {
    if (!userId) return [] as RoomWithDetails[];
    logChatDebug('refreshRooms:start', { userId, endpoint: `${CHAT_API_URL}/api/rooms` });
    const response = await fetch(`${CHAT_API_URL}/api/rooms`, withAuthHeaders());
    if (!response.ok) {
      logChatDebug('refreshRooms:failed', { status: response.status, statusText: response.statusText });
      return [] as RoomWithDetails[];
    }
    const data = (await response.json()) as RoomWithDetails[];
    logChatDebug('refreshRooms:success', { count: data.length, roomIds: data.map((room) => room.id) });
    const enriched = data.map((room) => ({
      ...room,
      isPinned: pinnedRoomIds.has(room.id),
    }));
    setRooms(enriched);
    const activeRoomId = activeRoomIdRef.current;
    if (activeRoomId) {
      const updated = enriched.find((room) => room.id === activeRoomId);
      if (updated) {
        setActiveRoom(updated);
      }
    }
    return enriched;
  }, [pinnedRoomIds, userId, withAuthHeaders]);

  const refreshFriendRequests = useCallback(async () => {
    if (!userId) return;
    const response = await fetch(`${CHAT_API_URL}/api/chat/friend-requests`, withAuthHeaders());
    if (!response.ok) {
      console.error('[ChatContext] failed to load friend requests', response.status, response.statusText);
      return;
    }
    const json = (await response.json().catch(() => null)) as FriendRequest[] | null;
    if (!json || !Array.isArray(json)) {
      console.error('[ChatContext] friend request response unexpected', { json });
      return;
    }
    setFriendRequests(json.map((request) => ({ ...request, status: normalizeFriendRequestStatus(request.status) as FriendRequest['status'] })));
  }, [userId, withAuthHeaders]);

  const refreshRoomMessages = useCallback(
    async (roomId: string) => {
      if (!userId) return;
      const response = await fetch(`${CHAT_API_URL}/api/rooms/${roomId}/messages`, withAuthHeaders());
      if (!response.ok) return;
      const data = (await response.json()) as MessageWithUser[];
      const withResolvedStatus = data.map((message) => ({
        ...message,
        status: resolveOwnMessageStatus(roomId, message.user_id) || message.status,
      }));
      setMessages((prev) => {
        const existing = prev[roomId] || [];
        const pendingOrFailed = existing.filter(
          (message) => (message.status === 'pending' || message.status === 'error') && !withResolvedStatus.some((item) => item.id === message.id)
        );
        const merged = [...withResolvedStatus, ...pendingOrFailed].sort((a, b) => {
          const first = a.created_at ? new Date(a.created_at).getTime() : Number.MAX_SAFE_INTEGER;
          const second = b.created_at ? new Date(b.created_at).getTime() : Number.MAX_SAFE_INTEGER;
          return first - second;
        });
        return { ...prev, [roomId]: merged };
      });
    },
    [resolveOwnMessageStatus, userId, withAuthHeaders]
  );

  const sendTyping = useCallback(
    (roomId: string, isTyping: boolean) => {
      logChatDebug('sendTyping:attempt', {
        roomId,
        isTyping,
        hasSocket: Boolean(wsRef.current),
        readyState: wsRef.current?.readyState ?? 'missing',
      });
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        logChatDebug('sendTyping:skipped_socket_not_open', {
          roomId,
          isTyping,
          readyState: wsRef.current?.readyState ?? 'missing',
        });
        return;
      }

      if (isTyping) {
        const now = Date.now();
        const lastSentAt = typingThrottleRef.current.get(roomId) || 0;
        if (now - lastSentAt < TYPING_TRUE_THROTTLE_MS) {
          const existingIdle = typingIdleTimeoutRef.current.get(roomId);
          if (existingIdle) window.clearTimeout(existingIdle);
          const idleTimeout = window.setTimeout(() => {
            sendTyping(roomId, false);
            typingIdleTimeoutRef.current.delete(roomId);
          }, TYPING_IDLE_TIMEOUT_MS);
          typingIdleTimeoutRef.current.set(roomId, idleTimeout);
          return;
        }
        typingThrottleRef.current.set(roomId, now);
      }

      const payload: ChatSocketPayload = { type: 'typing', roomId, isTyping } as ChatSocketPayload;
      wsRef.current.send(JSON.stringify(payload));
      logChatDebug('sendTyping:sent', payload as unknown as Record<string, unknown>);

      const existingIdle = typingIdleTimeoutRef.current.get(roomId);
      if (existingIdle) window.clearTimeout(existingIdle);

      if (isTyping) {
        const idleTimeout = window.setTimeout(() => {
          sendTyping(roomId, false);
          typingIdleTimeoutRef.current.delete(roomId);
        }, TYPING_IDLE_TIMEOUT_MS);
        typingIdleTimeoutRef.current.set(roomId, idleTimeout);
      } else {
        typingIdleTimeoutRef.current.delete(roomId);
      }
    },
    []
  );

  const selectRoom = useCallback(
    async (room: RoomWithDetails) => {
      const previousRoomId = activeRoomIdRef.current;
      if (previousRoomId && previousRoomId !== room.id) {
        sendTyping(previousRoomId, false);
      }
      activeRoomIdRef.current = room.id;
      pendingRoomJoinRef.current = room.id;
      setActiveRoom(rooms.find((candidate) => candidate.id === room.id) || room);
      await refreshRoomMessages(room.id);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const payload: ChatSocketPayload = { type: 'join_room', roomId: room.id } as ChatSocketPayload;
        logChatDebug('selectRoom:join_room', payload as unknown as Record<string, unknown>);
        wsRef.current.send(JSON.stringify(payload));
      } else {
        logChatDebug('selectRoom:join_room_skipped_socket_not_open', {
          roomId: room.id,
          readyState: wsRef.current?.readyState ?? 'missing',
        });
      }
    },
    [refreshRoomMessages, rooms, sendTyping]
  );

  const handleSocketMessage = useCallback(
    (event: MessageEvent) => {
      logChatDebug('socket:onmessage:raw', { data: event.data });
      const payload = JSON.parse(event.data) as ChatSocketPayload;
      const payloadWithLegacy = payload as ChatSocketPayload & {
        event?: string;
        action?: string;
        room_id?: string | number;
        user_id?: string | number;
        is_typing?: boolean;
        online_user_ids?: Array<string | number>;
        online_users?: Array<string | number>;
        onlineUsers?: Array<string | number>;
      };
      const payloadType = payload.type || payloadWithLegacy.event || payloadWithLegacy.action;
      const roomId = payload.roomId ? String(payload.roomId) : payloadWithLegacy.room_id ? String(payloadWithLegacy.room_id) : undefined;
      const userId = payload.userId ? String(payload.userId) : payloadWithLegacy.user_id ? String(payloadWithLegacy.user_id) : undefined;
      const isTyping = payload.isTyping ?? payloadWithLegacy.is_typing;

      switch (payloadType) {
        case 'authenticated': {
          reconnectAttemptRef.current = 0;
          logChatDebug('socket:authenticated', { activeRoomId: activeRoomIdRef.current });
          const roomId = pendingRoomJoinRef.current || activeRoomIdRef.current;
          if (roomId && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'join_room', roomId } satisfies ChatSocketPayload));
            logChatDebug('socket:authenticated:join_room_sent', { roomId });
            pendingRoomJoinRef.current = null;
          }
          break;
        }
        case 'auth_error': {
          logChatDebug('socket:auth_error');
          shouldReconnectRef.current = false;
          wsRef.current?.close();
          break;
        }
        case 'new_message': {
          const rawMessage = payload.message;
          const roomId = rawMessage?.room_id || payload.roomId;
          if (!rawMessage || !roomId) break;
          const normalizedRoomId = toComparableId(roomId);
          const message = { ...rawMessage, room_id: normalizedRoomId };
          logChatDebug('socket:new_message', {
            roomId: normalizedRoomId,
            messageId: message.id,
            fromUserId: message.user_id,
            contentPreview: String(message.content || '').slice(0, 80),
          });
          setMessages((prev) => {
            const list = prev[normalizedRoomId] || [];
            const withoutTemp = list.filter((item) => item.id !== message.id && item.tempId !== message.id);
            if (withoutTemp.some((item) => item.id === message.id)) {
              return prev;
            }
            const status = resolveOwnMessageStatus(normalizedRoomId, message.user_id);
            return { ...prev, [normalizedRoomId]: [...withoutTemp, { ...message, status }] };
          });
          setRooms((prev) =>
            prev.map((room) =>
              room.id === normalizedRoomId
                ? {
                    ...room,
                    lastMessage: message,
                  }
                : room
            )
          );
          break;
        }
        case 'typing':
        case 'user_typing': {
          if (!roomId || !userId) break;
          logChatDebug('socket:user_typing', { roomId, userId, isTyping });

          const roomTypingExpiry = typingExpiryRef.current.get(roomId) || new Map<string, number>();
          if (isTyping) {
            const existingTimeout = roomTypingExpiry.get(userId);
            if (existingTimeout) {
              window.clearTimeout(existingTimeout);
            }
            const timeoutHandle = window.setTimeout(() => {
              setTypingUsers((prev) => {
                const set = new Set(prev[roomId] || []);
                if (!set.has(userId)) return prev;
                set.delete(userId);
                return { ...prev, [roomId]: set };
              });
              const roomMap = typingExpiryRef.current.get(roomId);
              roomMap?.delete(userId);
            }, TYPING_REMOTE_EXPIRY_MS);
            roomTypingExpiry.set(userId, timeoutHandle);
            typingExpiryRef.current.set(roomId, roomTypingExpiry);
          } else {
            const existingTimeout = roomTypingExpiry.get(userId);
            if (existingTimeout) {
              window.clearTimeout(existingTimeout);
              roomTypingExpiry.delete(userId);
            }
          }

          setTypingUsers((prev) => {
            const set = new Set(prev[roomId] || []);
            if (isTyping) {
              set.add(userId);
            } else {
              set.delete(userId);
            }
            return { ...prev, [roomId]: set };
          });
          break;
        }
        case 'online_users': {
          const users = payload.onlineUserIds || payloadWithLegacy.online_user_ids || payloadWithLegacy.online_users || payloadWithLegacy.onlineUsers;
          if (users) {
            logChatDebug('socket:online_users', { users: users.map((id) => toComparableId(id)) });
            setOnlineUsers(new Set(users.map((id) => toComparableId(id))));
            window.setTimeout(reconcileOwnDmMessageStatuses, 0);
          }
          break;
        }
        case 'user_online': {
          if (userId) {
            const normalizedUserId = toComparableId(userId);
            logChatDebug('socket:user_online', { userId: normalizedUserId });
            setOnlineUsers((prev) => new Set(prev).add(normalizedUserId));
            window.setTimeout(reconcileOwnDmMessageStatuses, 0);
          }
          break;
        }
        case 'user_offline': {
          if (userId) {
            const normalizedUserId = toComparableId(userId);
            logChatDebug('socket:user_offline', { userId: normalizedUserId });
            setOnlineUsers((prev) => {
              const next = new Set(prev);
              next.delete(normalizedUserId);
              return next;
            });
            window.setTimeout(reconcileOwnDmMessageStatuses, 0);
          }
          break;
        }
        default:
          logChatDebug('socket:unhandled_payload', {
            payloadType: payloadType || 'missing',
            ...(payload as unknown as Record<string, unknown>),
          });
          break;
      }
    },
    [reconcileOwnDmMessageStatuses, resolveOwnMessageStatus, toComparableId]
  );

  const connectSocket = useCallback(() => {
    if (!userId) return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      logChatDebug('socket:connect:skipped_existing_socket', { readyState: wsRef.current.readyState });
      return;
    }
    const url = getWebSocketUrl();
    logChatDebug('socket:connect:attempt', { userId, url });
    if (!url) {
      setIsConnecting(false);
      logChatDebug('socket:connect:aborted_missing_url');
      return;
    }
    setIsConnecting(true);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnecting(false);
      wsRef.current = ws;
      const authPayload: ChatSocketPayload = { type: 'auth' } as ChatSocketPayload;
      logChatDebug('socket:onopen:send_auth', authPayload as unknown as Record<string, unknown>);
      ws.send(JSON.stringify(authPayload));

      const roomId = pendingRoomJoinRef.current || activeRoomIdRef.current;
      if (roomId) {
        ws.send(JSON.stringify({ type: 'join_room', roomId } satisfies ChatSocketPayload));
        logChatDebug('socket:onopen:join_room_sent', { roomId });
      }
    };

    ws.onmessage = handleSocketMessage;

    ws.onclose = () => {
      setIsConnecting(false);
      logChatDebug('socket:onclose', { readyState: ws.readyState, userId: userIdRef.current });
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);

      if (!shouldReconnectRef.current) {
        logChatDebug('socket:reconnect:skipped_disabled');
        return;
      }

      reconnectAttemptRef.current += 1;
      const exponentialDelay = Math.min(RECONNECT_BASE_DELAY_MS * (2 ** (reconnectAttemptRef.current - 1)), RECONNECT_MAX_DELAY_MS);
      const jitter = Math.floor(Math.random() * 350);
      const delayMs = exponentialDelay + jitter;
      reconnectTimeout.current = setTimeout(connectSocket, delayMs);
      logChatDebug('socket:reconnect:scheduled', { delayMs, attempt: reconnectAttemptRef.current });
    };

    ws.onerror = (event) => {
      logChatDebug('socket:onerror', { eventType: event.type });
      ws.close();
    };
  }, [handleSocketMessage, userId]);

  useEffect(() => {
    if (!userId) return;
    shouldReconnectRef.current = true;
    connectSocket();
    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      typingIdleTimeoutRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      typingIdleTimeoutRef.current.clear();
      typingExpiryRef.current.forEach((roomMap) => {
        roomMap.forEach((timeoutId) => window.clearTimeout(timeoutId));
      });
      typingExpiryRef.current.clear();
      const socket = wsRef.current;
      wsRef.current = null;
      socket?.close();
    };
  }, [connectSocket, userId]);

  useEffect(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const roomId = pendingRoomJoinRef.current;
    if (!roomId) return;
    wsRef.current.send(JSON.stringify({ type: 'join_room', roomId } satisfies ChatSocketPayload));
    logChatDebug('socket:flush_pending_join_room', { roomId });
    pendingRoomJoinRef.current = null;
  }, [isConnecting]);

  useEffect(() => {
    if (userId) {
      refreshRooms();
      refreshFriendRequests();
    }
  }, [refreshRooms, refreshFriendRequests, userId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('pinnedRooms', JSON.stringify(Array.from(pinnedRoomIds)));
    }
  }, [pinnedRoomIds]);

  const sendMessage = useCallback(
    async (roomId: string, content: string, replyTo?: string | null) => {
      const trimmed = content.trim();
      if (!trimmed) return;
      const tempId = `temp-${Date.now()}`;
      const optimistic: MessageWithUser = {
        id: tempId,
        tempId,
        room_id: roomId,
        user_id: userId ?? 'me',
        content: trimmed,
        reply_to: replyTo,
        status: 'pending',
      };
      setMessages((prev) => ({ ...prev, [roomId]: [...(prev[roomId] || []), optimistic] }));
      try {
        logChatDebug('sendMessage:attempt', { roomId, replyTo: replyTo || null, contentLength: trimmed.length });
        const response = await fetch(`${CHAT_API_URL}/api/rooms/${roomId}/messages`, withAuthHeaders({
          method: 'POST',
          body: JSON.stringify({ content: trimmed, reply_to: replyTo }),
        }));
        if (!response.ok) {
          logChatDebug('sendMessage:failed_response', { status: response.status, statusText: response.statusText, roomId });
          throw new Error('Failed to send message');
        }
        const saved = (await response.json()) as MessageWithUser;
        logChatDebug('sendMessage:success', { roomId, messageId: saved.id, status: saved.status || 'unknown' });
        setMessages((prev) => {
          const list = prev[roomId] || [];
          const withoutTemp = list.filter((msg) => msg.id !== tempId && msg.id !== saved.id);
          return { ...prev, [roomId]: [...withoutTemp, { ...saved, status: 'sent' }] };
        });
        window.setTimeout(reconcileOwnDmMessageStatuses, 0);
      } catch (error) {
        logChatDebug('sendMessage:error', {
          roomId,
          error: error instanceof Error ? error.message : 'unknown-error',
        });
        setMessages((prev) => {
          const list = prev[roomId] || [];
          return {
            ...prev,
            [roomId]: list.map((msg) => (msg.id === tempId ? { ...msg, status: 'error' as MessageStatus } : msg)),
          };
        });
      }
    },
    [reconcileOwnDmMessageStatuses, userId, withAuthHeaders]
  );

  const togglePin = useCallback((roomId: string) => {
    setPinnedRoomIds((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) {
        next.delete(roomId);
      } else {
        next.add(roomId);
      }
      return next;
    });
    setRooms((prev) => prev.map((room) => (room.id === roomId ? { ...room, isPinned: !room.isPinned } : room)));
  }, []);

  const createDirectRoom = useCallback(
    async (targetUserId: string) => {
      if (!userId) return null;

      const findDirectRoom = (roomsList: RoomWithDetails[]) =>
        roomsList.find(
          (room) =>
            room.room_type === 'dm' &&
            room.members.some((member) => member.user_id === userId) &&
            room.members.some((member) => member.user_id === targetUserId)
        ) || null;

      const existing = findDirectRoom(rooms);
      if (existing) return existing;

      const refreshed = await refreshRooms();
      const fromRefreshed = findDirectRoom(refreshed);
      if (fromRefreshed) return fromRefreshed;

      const response = await fetch(
        `${CHAT_API_URL}/api/rooms/direct`,
        withAuthHeaders({ method: 'POST', body: JSON.stringify({ targetUserId }) })
      );
      if (!response.ok) {
        console.error('[ChatContext] failed to create direct room', {
          status: response.status,
          statusText: response.statusText,
        });
        return null;
      }

      const room = (await response.json()) as RoomWithDetails;
      const normalizedRoom = { ...room, isPinned: pinnedRoomIds.has(room.id) };
      setRooms((prev) => {
        const withoutDuplicate = prev.filter((existingRoom) => existingRoom.id !== room.id);
        return [normalizedRoom, ...withoutDuplicate];
      });

      return normalizedRoom;
    },
    [pinnedRoomIds, refreshRooms, rooms, userId, withAuthHeaders]
  );

  const createGroupRoom = useCallback(
    async (payload: { name: string; description?: string; icon?: string; memberIds: string[] }) => {
      if (!userId) return null;
      const response = await fetch(
        `${CHAT_API_URL}/api/rooms/group`,
        withAuthHeaders({ method: 'POST', body: JSON.stringify(payload) })
      );
      if (!response.ok) return null;
      const room = (await response.json()) as RoomWithDetails;
      setRooms((prev) => [{ ...room, isPinned: pinnedRoomIds.has(room.id) }, ...prev]);
      return room;
    },
    [pinnedRoomIds, userId, withAuthHeaders]
  );

  const searchUsers = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (trimmed.length < 2) return [] as UserSearchResult[];
      try {
        const url = `${CHAT_API_URL}/api/chat/people?query=${encodeURIComponent(trimmed)}`;
        logChatDebug('searchUsers:query', { url });
        const response = await fetch(url, withAuthHeaders());
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[ChatContext] people search failed', {
            status: response.status,
            statusText: response.statusText,
            body: errorText,
          });
          return [] as UserSearchResult[];
        }
        const data = (await response.json()) as PeopleSearchResult[];
        const mapped: UserSearchResult[] = data
          .filter((person) => person.id !== userId)
          .map((person) => {
            const existingRequest = friendRequests.find(
              (req) =>
                (req.sender_id === person.id && req.receiver_id === userId) ||
                (req.receiver_id === person.id && req.sender_id === userId)
            );

            return {
              id: person.id,
              email: person.email || '',
              full_name: person.displayName,
              role: person.role,
              committee: person.committeeCode || null,
              country: person.country || null,
              is_friend: existingRequest?.status === 'accepted',
              has_pending_request: existingRequest?.status === 'pending',
            };
          });
        return mapped;
      } catch (err) {
        console.error('[ChatContext] people search threw', err);
        return [] as UserSearchResult[];
      }
    },
    [friendRequests, userId, withAuthHeaders]
  );

  const sendFriendRequest = useCallback(
    async (targetUserId: string) => {
      if (!userId) return null;
      try {
        const response = await fetch(
          `${CHAT_API_URL}/api/chat/friend-requests`,
          withAuthHeaders({ method: 'POST', body: JSON.stringify({ targetUserId }) })
        );

        const json = (await response.json().catch(() => null)) as FriendRequest | { error?: string } | null;

        if (!response.ok || !json || Array.isArray(json) || !('id' in json)) {
          console.error('[ChatContext] failed to send friend request', {
            status: response.status,
            json,
          });
          return null;
        }

        const created = { ...json, status: normalizeFriendRequestStatus(json.status) as FriendRequest['status'] } as FriendRequest;
        setFriendRequests((prev) => {
          const withoutDupes = prev.filter((req) => req.id !== created.id);
          return [created, ...withoutDupes];
        });
        return created;
      } catch (error) {
        console.error('[ChatContext] friend request threw', error);
        return null;
      }
    },
    [userId, withAuthHeaders]
  );

  const acceptFriendRequest = useCallback(
    async (id: string) => {
      if (!userId) return;
      try {
        const response = await fetch(
          `${CHAT_API_URL}/api/chat/friend-requests/${id}/respond`,
          withAuthHeaders({
            method: 'POST',
            headers: { Accept: 'application/json' },
            body: JSON.stringify({ action: 'accept' }),
          })
        );

        const json = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null;

        if (!response.ok || !json?.success) {
          console.error('[ChatContext] failed to respond to request', {
            status: response.status,
            json,
          });
          return;
        }

        const acceptedRequest = friendRequests.find((req) => req.id === id) || null;
        setFriendRequests((prev) => {
          const remaining = prev.filter((req) => req.id !== id);
          const updatedStatus = normalizeFriendRequestStatus('accepted');
          const existing = prev.find((req) => req.id === id);
          const updated = existing ? { ...existing, status: updatedStatus } : null;
          return updated ? [updated, ...remaining] : remaining;
        });

        const peerId = acceptedRequest
          ? (acceptedRequest.sender_id === userId ? acceptedRequest.receiver_id : acceptedRequest.sender_id)
          : null;

        const syncRooms = await refreshRooms();
        const targetRoom =
          (peerId
            ? syncRooms.find(
                (room) =>
                  room.room_type === 'dm' &&
                  room.members.some((member) => member.user_id === userId) &&
                  room.members.some((member) => member.user_id === peerId)
              )
            : null);

        if (targetRoom) {
          await selectRoom(targetRoom);
        }
      } catch (error) {
        console.error('[ChatContext] respondToFriendRequest threw', error);
      }
    },
    [friendRequests, refreshRooms, selectRoom, userId, withAuthHeaders]
  );

  const declineFriendRequest = useCallback(
    async (id: string) => {
      if (!userId) return;
      try {
        const response = await fetch(
          `${CHAT_API_URL}/api/chat/friend-requests/${id}/respond`,
          withAuthHeaders({
            method: 'POST',
            headers: { Accept: 'application/json' },
            body: JSON.stringify({ action: 'reject' }),
          })
        );

        const json = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null;

        if (!response.ok || !json?.success) {
          console.error('[ChatContext] failed to respond to request', {
            status: response.status,
            json,
          });
          return;
        }

        setFriendRequests((prev) => {
          const remaining = prev.filter((req) => req.id !== id);
          const updatedStatus = normalizeFriendRequestStatus('rejected');
          const existing = prev.find((req) => req.id === id);
          const updated = existing ? { ...existing, status: updatedStatus } : null;
          return updated ? [updated, ...remaining] : remaining;
        });
      } catch (error) {
        console.error('[ChatContext] respondToFriendRequest threw', error);
      }
    },
    [userId, withAuthHeaders]
  );

  const respondToFriendRequest = useCallback(
    async (id: string, action: 'accept' | 'reject') => {
      if (action === 'accept') return acceptFriendRequest(id);
      return declineFriendRequest(id);
    },
    [acceptFriendRequest, declineFriendRequest]
  );

  const openDirectMessageRoomForUser = useCallback(
    async (targetUserId: string) => {
      if (!userId) return null;

      const room = await createDirectRoom(targetUserId);
      if (!room) return null;

      await selectRoom(room);
      return room;
    },
    [createDirectRoom, selectRoom, userId]
  );

  const value = useMemo<ChatContextValue>(
    () => ({
      rooms,
      activeRoom,
      messages,
      typingUsers,
      onlineUsers,
      isConnecting,
      friendRequests,
      incomingRequests: friendRequests.filter((req) => req.status === 'pending' && req.receiver_id === userId),
      currentUserId: userId,
      pinnedRoomIds,
      selectRoom,
      refreshRooms,
      refreshRoomMessages,
      sendMessage,
      sendTyping,
      togglePin,
      createDirectRoom,
      createGroupRoom,
      searchUsers,
      refreshFriendRequests,
      sendFriendRequest,
      respondToFriendRequest,
      acceptFriendRequest,
      declineFriendRequest,
      openDirectMessageRoomForUser,
    }),
    [
      rooms,
      activeRoom,
      messages,
      typingUsers,
      onlineUsers,
      isConnecting,
      friendRequests,
      userId,
      pinnedRoomIds,
      selectRoom,
      refreshRooms,
      refreshRoomMessages,
      sendMessage,
      sendTyping,
      togglePin,
      createDirectRoom,
      createGroupRoom,
      searchUsers,
      refreshFriendRequests,
      sendFriendRequest,
      respondToFriendRequest,
      acceptFriendRequest,
      declineFriendRequest,
      openDirectMessageRoomForUser,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
};
