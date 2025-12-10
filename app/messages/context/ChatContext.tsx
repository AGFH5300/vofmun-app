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

const CHAT_WS_URL = import.meta.env.VITE_CHAT_WS_URL;
const CHAT_API_URL = import.meta.env.VITE_CHAT_API_URL || '';

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
  currentUserId: string | null;
  pinnedRoomIds: Set<string>;
  selectRoom: (room: RoomWithDetails) => Promise<void>;
  refreshRooms: () => Promise<void>;
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
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

const getWebSocketUrl = () => {
  if (CHAT_WS_URL) return CHAT_WS_URL;
  const { protocol, host } = window.location;
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${host}/chat-ws`;
};

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
    if ('delegateID' in user && user.delegateID) {
      setUserId(String(user.delegateID));
      return;
    }
    if ('chairID' in user && user.chairID) {
      setUserId(String(user.chairID));
      return;
    }
    if ('adminID' in user && user.adminID) {
      setUserId(String(user.adminID));
      return;
    }
    if ('secretariatID' in user && user.secretariatID) {
      setUserId(String(user.secretariatID));
      return;
    }
    setUserId(null);
  }, [user]);

  const refreshRooms = useCallback(async () => {
    if (!userId) return;
    const response = await fetch(`${CHAT_API_URL}/api/rooms`, withAuthHeaders());
    if (!response.ok) return;
    const data = (await response.json()) as RoomWithDetails[];
    const enriched = data.map((room) => ({
      ...room,
      isPinned: pinnedRoomIds.has(room.id),
    }));
    setRooms(enriched);
    if (activeRoom) {
      const updated = enriched.find((room) => room.id === activeRoom.id);
      if (updated) setActiveRoom(updated);
    }
  }, [activeRoom, pinnedRoomIds, userId, withAuthHeaders]);

  const refreshFriendRequests = useCallback(async () => {
    if (!userId) return;
    const response = await fetch(`/api/chat/friend-requests`, withAuthHeaders());
    if (!response.ok) {
      console.error('[ChatContext] failed to load friend requests', response.status, response.statusText);
      return;
    }
    const json = (await response.json().catch(() => null)) as { ok?: boolean; requests?: FriendRequest[] } | null;
    if (!json?.ok || !json.requests) {
      console.error('[ChatContext] friend request response unexpected', json);
      return;
    }
    setFriendRequests(json.requests);
  }, [userId, withAuthHeaders]);

  const fetchMessages = useCallback(
    async (roomId: string) => {
      if (!userId) return;
      const response = await fetch(`${CHAT_API_URL}/api/rooms/${roomId}/messages`, withAuthHeaders());
      if (!response.ok) return;
      const data = (await response.json()) as MessageWithUser[];
      setMessages((prev) => ({ ...prev, [roomId]: data }));
    },
    [userId, withAuthHeaders]
  );

  const selectRoom = useCallback(
    async (room: RoomWithDetails) => {
      setActiveRoom(room);
      await fetchMessages(room.id);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const payload: ChatSocketPayload = { type: 'join_room', roomId: room.id } as ChatSocketPayload;
        wsRef.current.send(JSON.stringify(payload));
      }
    },
    [fetchMessages]
  );

  const handleSocketMessage = useCallback(
    (event: MessageEvent) => {
      const payload = JSON.parse(event.data) as ChatSocketPayload;
      switch (payload.type) {
        case 'authenticated': {
          if (activeRoom && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'join_room', roomId: activeRoom.id } satisfies ChatSocketPayload));
          }
          break;
        }
        case 'new_message': {
          const message = payload.message;
          if (!message || !message.room_id) break;
          setMessages((prev) => {
            const list = prev[message.room_id] || [];
            if (list.some((item) => item.id === message.id)) {
              return prev;
            }
            const withoutTemp = list.filter((item) => item.id !== message.id && item.tempId !== message.id);
            return { ...prev, [message.room_id]: [...withoutTemp, { ...message, status: 'delivered' as MessageStatus }] };
          });
          break;
        }
        case 'user_typing': {
          if (!payload.roomId || !payload.userId) break;
          setTypingUsers((prev) => {
            const set = new Set(prev[payload.roomId] || []);
            if (payload.isTyping) {
              set.add(payload.userId);
            } else {
              set.delete(payload.userId);
            }
            return { ...prev, [payload.roomId]: set };
          });
          break;
        }
        case 'user_online': {
          if (payload.userId) {
            setOnlineUsers((prev) => new Set(prev).add(payload.userId!));
          }
          break;
        }
        case 'user_offline': {
          if (payload.userId) {
            setOnlineUsers((prev) => {
              const next = new Set(prev);
              next.delete(payload.userId!);
              return next;
            });
          }
          break;
        }
        default:
          break;
      }
    },
    [activeRoom]
  );

  const connectSocket = useCallback(() => {
    if (!userId) return;
    setIsConnecting(true);
    const url = getWebSocketUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnecting(false);
      const authPayload: ChatSocketPayload = { type: 'auth' } as ChatSocketPayload;
      ws.send(JSON.stringify(authPayload));
    };

    ws.onmessage = handleSocketMessage;

    ws.onclose = () => {
      setIsConnecting(false);
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = setTimeout(connectSocket, 1000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [handleSocketMessage, userId]);

  useEffect(() => {
    if (!userId) return;
    connectSocket();
    return () => {
      reconnectTimeout.current && clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [connectSocket, userId]);

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
        room_id: roomId,
        user_id: userId ?? 'me',
        content: trimmed,
        reply_to: replyTo,
        status: 'pending',
      };
      setMessages((prev) => ({ ...prev, [roomId]: [...(prev[roomId] || []), optimistic] }));
      try {
        const response = await fetch(`${CHAT_API_URL}/api/rooms/${roomId}/messages`, withAuthHeaders({
          method: 'POST',
          body: JSON.stringify({ content: trimmed, reply_to: replyTo }),
        }));
        if (!response.ok) {
          throw new Error('Failed to send message');
        }
        const saved = (await response.json()) as MessageWithUser;
        setMessages((prev) => {
          const list = prev[roomId] || [];
          const withoutTemp = list.filter((msg) => msg.id !== tempId && msg.id !== saved.id);
          return { ...prev, [roomId]: [...withoutTemp, { ...saved, status: 'delivered' }] };
        });
      } catch (error) {
        setMessages((prev) => {
          const list = prev[roomId] || [];
          return {
            ...prev,
            [roomId]: list.map((msg) => (msg.id === tempId ? { ...msg, status: 'error' as MessageStatus } : msg)),
          };
        });
      }
    },
    [userId, withAuthHeaders]
  );

  const sendTyping = useCallback(
    (roomId: string, isTyping: boolean) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      const payload: ChatSocketPayload = { type: 'typing', roomId, isTyping } as ChatSocketPayload;
      wsRef.current.send(JSON.stringify(payload));
    },
    []
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
      const response = await fetch(
        `${CHAT_API_URL}/api/rooms/direct`,
        withAuthHeaders({ method: 'POST', body: JSON.stringify({ targetUserId }) })
      );
      if (!response.ok) return null;
      const room = (await response.json()) as RoomWithDetails;
      setRooms((prev) => {
        const existing = prev.find((r) => r.id === room.id);
        const updated = existing ? prev.map((r) => (r.id === room.id ? room : r)) : [room, ...prev];
        return updated.map((r) => ({ ...r, isPinned: pinnedRoomIds.has(r.id) }));
      });
      return room;
    },
    [pinnedRoomIds, userId, withAuthHeaders]
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
        const url = `/api/chat/people?query=${encodeURIComponent(trimmed)}`;
        console.log('[ChatContext] searching people', url);
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
          '/api/chat/friend-requests',
          withAuthHeaders({ method: 'POST', body: JSON.stringify({ receiverId: targetUserId }) })
        );

        const json = (await response.json().catch(() => null)) as
          | { ok: boolean; request?: FriendRequest; already_exists?: boolean; status?: string; error?: string }
          | null;

        if (!response.ok || !json?.ok) {
          console.error('[ChatContext] failed to send friend request', {
            status: response.status,
            json,
          });
          return null;
        }

        if (json.request) {
          const created = json.request;
          setFriendRequests((prev) => {
            const withoutDupes = prev.filter(
              (req) => !(req.sender_id === created.sender_id && req.receiver_id === created.receiver_id && req.status === created.status)
            );
            return [created, ...withoutDupes];
          });
          return created;
        }

        if (json.already_exists) {
          const existing = friendRequests.find(
            (req) =>
              (req.sender_id === targetUserId && req.receiver_id === userId) ||
              (req.sender_id === userId && req.receiver_id === targetUserId)
          );
          if (existing) {
            return existing;
          }
          await refreshFriendRequests();
        }

        return null;
      } catch (error) {
        console.error('[ChatContext] friend request threw', error);
        return null;
      }
    },
    [friendRequests, refreshFriendRequests, userId, withAuthHeaders]
  );

  const respondToFriendRequest = useCallback(
    async (id: string, action: 'accept' | 'reject') => {
      if (!userId) return;
      try {
        const response = await fetch(
          `/api/chat/friend-requests/${id}/respond`,
          withAuthHeaders({
            method: 'POST',
            headers: { Accept: 'application/json' },
            body: JSON.stringify({ action: action === 'reject' ? 'decline' : 'accept' }),
          })
        );

        const json = (await response.json().catch(() => null)) as
          | { ok?: boolean; status?: string; request?: FriendRequest; error?: string }
          | null;

        if (!response.ok || !json?.ok) {
          console.error('[ChatContext] failed to respond to request', {
            status: response.status,
            json,
          });
          return;
        }

        setFriendRequests((prev) => {
          const remaining = prev.filter((req) => req.id !== id);
          const updatedStatus = json.request?.status || json.status || (action === 'accept' ? 'accepted' : 'rejected');
          const existing = prev.find((req) => req.id === id) || json.request;
          const updated = existing ? { ...existing, status: updatedStatus } : null;
          return updated ? [updated, ...remaining] : remaining;
        });

        refreshRooms();
      } catch (error) {
        console.error('[ChatContext] respondToFriendRequest threw', error);
      }
    },
    [refreshRooms, userId, withAuthHeaders]
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
      currentUserId: userId,
      pinnedRoomIds,
      selectRoom,
      refreshRooms,
      sendMessage,
      sendTyping,
      togglePin,
      createDirectRoom,
      createGroupRoom,
      searchUsers,
      refreshFriendRequests,
      sendFriendRequest,
      respondToFriendRequest,
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
      sendMessage,
      sendTyping,
      togglePin,
      createDirectRoom,
      createGroupRoom,
      searchUsers,
      refreshFriendRequests,
      sendFriendRequest,
      respondToFriendRequest,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
};