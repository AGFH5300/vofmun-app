'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import supabase from '@/lib/supabase';
import {
  ChatSocketPayload,
  FriendRequest,
  MessageStatus,
  MessageWithUser,
  RoomWithDetails,
  UserSearchResult,
} from '@/lib/chat/types';

const CHAT_WS_URL = import.meta.env.VITE_CHAT_WS_URL;
const CHAT_API_URL = import.meta.env.VITE_CHAT_API_URL || '';

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
  sendFriendRequest: (targetUserId: string) => Promise<void>;
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
  const [token, setToken] = useState<string | null>(null);
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
      ...extra,
      headers: {
        'Content-Type': 'application/json',
        ...(extra?.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }),
    [token]
  );

  const fetchToken = useCallback(async () => {
    const session = await supabase.auth.getSession();
    const sessionToken = session.data.session?.access_token ?? null;
    setToken(sessionToken);
    setUserId(session.data.session?.user?.id ?? null);
  }, []);

  useEffect(() => {
    fetchToken();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token ?? null);
      setUserId(session?.user?.id ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, [fetchToken]);

  const refreshRooms = useCallback(async () => {
    if (!token) return;
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
  }, [activeRoom, pinnedRoomIds, token, withAuthHeaders]);

  const refreshFriendRequests = useCallback(async () => {
    if (!token) return;
    const response = await fetch(`${CHAT_API_URL}/api/friend-requests`, withAuthHeaders());
    if (!response.ok) return;
    const data = (await response.json()) as FriendRequest[];
    setFriendRequests(data);
  }, [token, withAuthHeaders]);

  const fetchMessages = useCallback(
    async (roomId: string) => {
      if (!token) return;
      const response = await fetch(`${CHAT_API_URL}/api/rooms/${roomId}/messages`, withAuthHeaders());
      if (!response.ok) return;
      const data = (await response.json()) as MessageWithUser[];
      setMessages((prev) => ({ ...prev, [roomId]: data }));
    },
    [token, withAuthHeaders]
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
    if (!token) return;
    setIsConnecting(true);
    const url = getWebSocketUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnecting(false);
      const authPayload: ChatSocketPayload = { type: 'auth', token } as ChatSocketPayload;
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
  }, [handleSocketMessage, token]);

  useEffect(() => {
    if (!token) return;
    connectSocket();
    return () => {
      reconnectTimeout.current && clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [connectSocket, token]);

  useEffect(() => {
    if (token) {
      refreshRooms();
      refreshFriendRequests();
    }
  }, [refreshRooms, refreshFriendRequests, token]);

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
      if (!token) return null;
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
    [pinnedRoomIds, token, withAuthHeaders]
  );

  const createGroupRoom = useCallback(
    async (payload: { name: string; description?: string; icon?: string; memberIds: string[] }) => {
      if (!token) return null;
      const response = await fetch(
        `${CHAT_API_URL}/api/rooms/group`,
        withAuthHeaders({ method: 'POST', body: JSON.stringify(payload) })
      );
      if (!response.ok) return null;
      const room = (await response.json()) as RoomWithDetails;
      setRooms((prev) => [{ ...room, isPinned: pinnedRoomIds.has(room.id) }, ...prev]);
      return room;
    },
    [pinnedRoomIds, token, withAuthHeaders]
  );

  const searchUsers = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (!token || trimmed.length < 2) return [] as UserSearchResult[];
      try {
        const response = await fetch(
          `${CHAT_API_URL}/api/chat/people?query=${encodeURIComponent(trimmed)}`,
          withAuthHeaders()
        );
        if (!response.ok) return [] as UserSearchResult[];
        return (await response.json()) as UserSearchResult[];
      } catch (_err) {
        return [] as UserSearchResult[];
      }
    },
    [token, withAuthHeaders]
  );

  const sendFriendRequest = useCallback(
    async (targetUserId: string) => {
      if (!token) return;
      await fetch(
        `${CHAT_API_URL}/api/friend-requests`,
        withAuthHeaders({ method: 'POST', body: JSON.stringify({ targetUserId }) })
      );
      refreshFriendRequests();
    },
    [refreshFriendRequests, token, withAuthHeaders]
  );

  const respondToFriendRequest = useCallback(
    async (id: string, action: 'accept' | 'reject') => {
      if (!token) return;
      await fetch(
        `${CHAT_API_URL}/api/friend-requests/${id}/respond`,
        withAuthHeaders({ method: 'POST', body: JSON.stringify({ action }) })
      );
      refreshFriendRequests();
      refreshRooms();
    },
    [refreshFriendRequests, refreshRooms, token, withAuthHeaders]
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