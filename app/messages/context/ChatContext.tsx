// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChatSocketPayload,
  FriendRequest,
  LEGACY_CHAT_ID_PREFIX_RE,
  MessageAttachmentInput,
  MessageStatus,
  MessageWithUser,
  RoomWithDetails,
  UserSearchResult,
} from '@/lib/chat/types';
import { useSession } from '@/app/context/sessionContext';
import supabase from '@/lib/supabase';
import { normalizeMessageMeta, resolveOwnMessageStatus } from '@/lib/chat/messageMeta';
import { getBrowserAccessToken, withBrowserAuthHeaders } from '@/lib/auth/browserAuthFetch';

const CHAT_WS_URL = process.env.NEXT_PUBLIC_CHAT_WS_URL;
const CHAT_API_URL = process.env.NEXT_PUBLIC_CHAT_API_URL || '';
const CHAT_WS_PATH = '/chat-ws'; // Canonical websocket path served by server/chat/server.ts

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
  initialChatReady: boolean;
  bootstrapProgress: {
    percent: number;
    label: string;
    preloadedRooms: number;
    totalRooms: number;
  };
  friendRequests: FriendRequest[];
  incomingRequests: FriendRequest[];
  resolveUserDisplay: (userId: string, fallbackUser?: FriendRequest['sender'] | null) => string;
  currentUserId: string | null;
  pinnedRoomIds: Set<string>;
  totalUnreadCount: number;
  selectRoom: (room: RoomWithDetails) => Promise<void>;
  refreshRooms: () => Promise<RoomWithDetails[]>;
  refreshRoomMessages: (roomId: string) => Promise<boolean>;
  sendMessage: (roomId: string, content: string, attachments?: MessageAttachmentInput[], replyTo?: string | null) => Promise<void>;
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
const CHAT_BOOTSTRAP_DEBUG_PREFIX = '[ChatBootstrapDebug]';
const isChatDebugEnabled = process.env.NEXT_PUBLIC_CHAT_DEBUG === '1';
const isReceiptsDebugEnabled = process.env.NEXT_PUBLIC_CHAT_RECEIPTS_DEBUG === '1';
const TYPING_TRUE_THROTTLE_MS = 1000;
const TYPING_IDLE_TIMEOUT_MS = 2500;
const TYPING_REMOTE_EXPIRY_MS = 5000;
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 12000;
const RECEIPT_DEBOUNCE_MS = 300;
const BOOTSTRAP_FETCH_TIMEOUT_MS = 12000;

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

const logChatDebug = (message: string, details?: Record<string, unknown>) => {
  if (!isChatDebugEnabled) return;
  if (details) {
    console.warn(`${CHAT_DEBUG_PREFIX} ${message}`, details);
    return;
  }
  console.warn(`${CHAT_DEBUG_PREFIX} ${message}`);
};

const logReceiptsDebug = (message: string, details?: Record<string, unknown>) => {
  if (!isReceiptsDebugEnabled) return;
  if (details) {
    console.warn(`[ChatReceiptsDebug] ${message}`, details);
    return;
  }
  console.warn(`[ChatReceiptsDebug] ${message}`);
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
    const hasSocketPath = new RegExp(`${CHAT_WS_PATH}/?$`).test(url.pathname);
    const pathname = hasSocketPath
      ? url.pathname
      : `${basePathWithoutApi || ''}${CHAT_WS_PATH}`;
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


const parseFriendRequestsResponse = (json: unknown): FriendRequest[] | null => {
  if (Array.isArray(json)) return json as FriendRequest[];
  if (json && typeof json === 'object' && 'requests' in json && Array.isArray((json as { requests?: unknown }).requests)) {
    return (json as { requests: FriendRequest[] }).requests;
  }
  return null;
};

const normalizeFriendRequestRecord = (request: FriendRequest): FriendRequest => ({
  ...request,
  sender_id: String(request.sender_id),
  receiver_id: String(request.receiver_id),
  status: normalizeFriendRequestStatus(request.status) as FriendRequest['status'],
});

const formatUserDisplayName = (user?: FriendRequest['sender'] | null) => {
  if (!user) return '';
  const fullName = user.full_name?.trim();
  if (fullName) return fullName;
  const composed = `${user.firstname || ''} ${user.lastname || ''}`.trim();
  if (composed) return composed;
  if (user.email) return user.email;
  return '';
};

const isFriendRequestInvolvingUser = (request: FriendRequest, currentUserId: string) => {
  const normalizedUserId = String(currentUserId);
  return String(request.sender_id) === normalizedUserId || String(request.receiver_id) === normalizedUserId;
};

const getRoomMemberIds = (roomId: string, rooms: RoomWithDetails[]): string[] => {
  const room = rooms.find((item) => item.id === roomId);
  return room?.members.map((member) => String(member.user_id)) || [];
};

const hydrateMessage = (message: MessageWithUser, currentUserId: string | null, roomMemberIds: string[]): MessageWithUser => ({
  ...message,
  meta: normalizeMessageMeta(message.meta),
  status: resolveOwnMessageStatus(message, currentUserId, roomMemberIds),
});

const mergeMessageMeta = (existingMeta: unknown, incomingMeta: unknown) => {
  const existing = normalizeMessageMeta(existingMeta);
  const incoming = normalizeMessageMeta(incomingMeta);
  return {
    ...existing,
    ...incoming,
    receipts: {
      delivered: {
        ...existing.receipts.delivered,
        ...incoming.receipts.delivered,
      },
      read: {
        ...existing.receipts.read,
        ...incoming.receipts.read,
      },
    },
  };
};

function toComparableId(value: string | number | null | undefined): string {
  return String(value ?? '');
}


export const ChatProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [rooms, setRooms] = useState<RoomWithDetails[]>([]);
  const [activeRoom, setActiveRoom] = useState<RoomWithDetails | null>(null);
  const [messages, setMessages] = useState<Record<string, MessageWithUser[]>>({});
  const [typingUsers, setTypingUsers] = useState<Record<string, Set<string>>>({});
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const { user, authReady, isAuthenticated } = useSession();
  const [userId, setUserId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasLoadedInitialRooms, setHasLoadedInitialRooms] = useState(false);
  const [hasLoadedInitialRoomMessages, setHasLoadedInitialRoomMessages] = useState(false);
  const [initialChatReady, setInitialChatReady] = useState(false);
  const [bootstrapProgress, setBootstrapProgress] = useState({
    percent: 5,
    label: 'Preparing session…',
    preloadedRooms: 0,
    totalRooms: 0,
  });
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [userDirectory, setUserDirectory] = useState<Record<string, FriendRequest['sender']>>({});
  const [pinnedRoomIds, setPinnedRoomIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set<string>();
    const stored = window.localStorage.getItem('pinnedRooms');
    return new Set(stored ? JSON.parse(stored) : []);
  });
  const [unreadByRoom, setUnreadByRoom] = useState<Record<string, number>>({});

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const pendingRoomJoinRef = useRef<string | null>(null);
  const activeRoomIdRef = useRef<string | null>(null);
  const roomsRef = useRef<RoomWithDetails[]>([]);
  const onlineUsersRef = useRef<Set<string>>(new Set());
  const messagesRef = useRef<Record<string, MessageWithUser[]>>({});
  const userIdRef = useRef<string | null>(null);
  const shouldReconnectRef = useRef(true);
  const typingThrottleRef = useRef<Map<string, number>>(new Map());
  const typingIdleTimeoutRef = useRef<Map<string, number>>(new Map());
  const typingExpiryRef = useRef<Map<string, Map<string, number>>>(new Map());
  const receiptDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingReceiptQueueRef = useRef<{ roomId: string; delivered: Set<string>; read: Set<string> } | null>(null);
  const lastReceiptKeyRef = useRef<string | null>(null);
  const inFlightReceiptKeysRef = useRef<Set<string>>(new Set());
  const lastScheduledReadLogKeyRef = useRef<string | null>(null);
  const initialBootstrapStartedRef = useRef(false);
  const initialBootstrapDoneRef = useRef(false);
  const lastAuthenticatedUserIdRef = useRef<string | null>(null);
  const refreshRoomsRef = useRef<() => Promise<RoomWithDetails[]>>(async () => []);
  const refreshFriendRequestsRef = useRef<() => Promise<void>>(async () => {});
  const refreshRoomMessagesRef = useRef<(roomId: string) => Promise<boolean>>(async () => false);
  const unreadByRoomRef = useRef<Record<string, number>>({});
  const defaultDocumentTitleRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  const setRoomUnreadCount = useCallback((roomId: string, count: number) => {
    const normalizedRoomId = toComparableId(roomId);
    const safeCount = Math.max(0, Math.floor(count));
    setUnreadByRoom((prev) => {
      const previous = prev[normalizedRoomId] || 0;
      if (previous === safeCount) return prev;
      const next = { ...prev, [normalizedRoomId]: safeCount };
      console.debug('[MessagesUnreadDebug] room_unread_set', {
        roomId: normalizedRoomId,
        previous,
        next: safeCount,
      });
      return next;
    });
    setRooms((prev) =>
      prev.map((room) =>
        room.id === normalizedRoomId
          ? {
              ...room,
              unreadCount: safeCount,
            }
          : room
      )
    );
  }, []);

  const incrementRoomUnreadCount = useCallback((roomId: string) => {
    const normalizedRoomId = toComparableId(roomId);
    setUnreadByRoom((prev) => {
      const nextCount = (prev[normalizedRoomId] || 0) + 1;
      const next = { ...prev, [normalizedRoomId]: nextCount };
      console.debug('[MessagesUnreadDebug] room_unread_increment', {
        roomId: normalizedRoomId,
        next: nextCount,
      });
      return next;
    });
    setRooms((prev) =>
      prev.map((room) =>
        room.id === normalizedRoomId
          ? {
              ...room,
              unreadCount: (room.unreadCount || 0) + 1,
            }
          : room
      )
    );
  }, []);

  const fetchWithTimeout = useCallback(async (input: RequestInfo | URL, init?: RequestInit, timeoutMs = BOOTSTRAP_FETCH_TIMEOUT_MS) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, []);

  const fetchAndCacheUsers = useCallback(async (ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids.map((id) => String(id)).filter(Boolean)));
    if (uniqueIds.length === 0) return;

    const missingIds = uniqueIds.filter((id) => !userDirectory[id]);
    if (missingIds.length === 0) return;

    const { data, error } = await supabase
      .from('app_users')
      .select('id, first_name, last_name, email')
      .in('id', missingIds);

    if (error) {
      console.error('[ChatContext] failed to fetch app_users for friend requests', error);
      return;
    }

    if (!data?.length) return;

    const nextEntries: Record<string, FriendRequest['sender']> = {};
    data.forEach((row) => {
      const fullName = `${row.first_name || ''} ${row.last_name || ''}`.trim();
      nextEntries[row.id] = {
        id: row.id,
        email: row.email || '',
        full_name: fullName,
        firstname: row.first_name || null,
        lastname: row.last_name || null,
      };
    });

    setUserDirectory((prev) => ({ ...prev, ...nextEntries }));
  }, [userDirectory]);

  const hydrateFriendRequestUsers = useCallback((request: FriendRequest): FriendRequest => {
    const senderProfile = request.sender || userDirectory[String(request.sender_id)] || undefined;
    const receiverProfile = request.receiver || userDirectory[String(request.receiver_id)] || undefined;
    return {
      ...request,
      sender: senderProfile,
      receiver: receiverProfile,
    };
  }, [userDirectory]);

  const resolveUserDisplay = useCallback(
    (targetUserId: string, fallbackUser?: FriendRequest['sender'] | null) => {
      const normalizedId = String(targetUserId);
      const fromFallback = formatUserDisplayName(fallbackUser);
      if (fromFallback) return fromFallback;
      const fromCache = formatUserDisplayName(userDirectory[normalizedId]);
      if (fromCache) return fromCache;
      return normalizedId;
    },
    [userDirectory]
  );

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const token = await getBrowserAccessToken("ChatContext");
    if (!token) {
      console.error('[ChatContext] failed to resolve Supabase access token');
    }
    return token;
  }, []);

  const withAuthHeaders = useCallback(
    async (extra?: RequestInit): Promise<RequestInit> =>
      withBrowserAuthHeaders(extra, "ChatContext"),
    []
  );

  const collectReceiptCandidates = useCallback(
    (roomMessages: MessageWithUser[], markRead: boolean) => {
      if (!userId) return [] as string[];

      return roomMessages
        .filter((message) => {
          if (String(message.user_id) === userId) return false;
          const messageId = String(message.id ?? '');
          if (!isUuid(messageId)) return false;

          const meta = normalizeMessageMeta(message.meta);
          const hasDelivered = Boolean(meta.receipts.delivered[userId]);
          const hasRead = Boolean(meta.receipts.read[userId]);

          if (markRead) return !hasRead;
          return !hasDelivered;
        })
        .map((message) => String(message.id));
    },
    [userId]
  );

  useEffect(() => {
    if (!authReady) {
      if (isAuthenticated && user) {
        return;
      }
      setUserId(null);
      return;
    }

    if (!isAuthenticated || !user) {
      lastAuthenticatedUserIdRef.current = null;
      setUserId(null);
      setHasLoadedInitialRooms(false);
      setHasLoadedInitialRoomMessages(false);
      setInitialChatReady(false);
      initialBootstrapStartedRef.current = false;
      initialBootstrapDoneRef.current = false;
      setBootstrapProgress({
        percent: 5,
        label: 'Preparing session…',
        preloadedRooms: 0,
        totalRooms: 0,
      });
      console.debug(`${CHAT_BOOTSTRAP_DEBUG_PREFIX} user_identity_reset`, {
        authReady,
        isAuthenticated,
      });
      return;
    }

    const candidate = user.id ? String(user.id) : null;

    if (candidate) {
      const normalizedCandidate = String(candidate);
      if (lastAuthenticatedUserIdRef.current && lastAuthenticatedUserIdRef.current !== normalizedCandidate) {
        setHasLoadedInitialRooms(false);
        setHasLoadedInitialRoomMessages(false);
        setInitialChatReady(false);
        initialBootstrapStartedRef.current = false;
        initialBootstrapDoneRef.current = false;
        setBootstrapProgress({
          percent: 5,
          label: 'Preparing session…',
          preloadedRooms: 0,
          totalRooms: 0,
        });
        console.debug(`${CHAT_BOOTSTRAP_DEBUG_PREFIX} user_identity_changed`, {
          from: lastAuthenticatedUserIdRef.current,
          to: normalizedCandidate,
        });
      }
      lastAuthenticatedUserIdRef.current = normalizedCandidate;
      setUserId(normalizedCandidate);
      setBootstrapProgress((prev) => ({
        ...prev,
        percent: Math.max(prev.percent, 20),
        label: 'Session ready…',
      }));
      return;
    }

    setUserId(null);
  }, [authReady, isAuthenticated, user]);

  useEffect(() => {
    console.debug(`${CHAT_BOOTSTRAP_DEBUG_PREFIX} ChatProvider mounted`);
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      console.debug(`${CHAT_BOOTSTRAP_DEBUG_PREFIX} ChatProvider unmounted`);
      console.debug('[MessagesPageDebug] route_leave_cleanup_path', {
        activeRoomId: activeRoomIdRef.current,
      });
    };
  }, []);


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
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    unreadByRoomRef.current = unreadByRoom;
  }, [unreadByRoom]);

  const totalUnreadCount = useMemo(
    () => Object.values(unreadByRoom).reduce((total, count) => total + Math.max(0, count || 0), 0),
    [unreadByRoom]
  );

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    if (!defaultDocumentTitleRef.current) {
      defaultDocumentTitleRef.current = document.title || 'VOFMUN ONE';
    }
    const baseTitle = defaultDocumentTitleRef.current || 'VOFMUN ONE';
    document.title = totalUnreadCount > 0 ? `(${totalUnreadCount}) ${baseTitle}` : baseTitle;
    window.localStorage.setItem('vofmun.messages.unreadTotal', String(totalUnreadCount));
    window.dispatchEvent(new CustomEvent('vofmun:messages-unread-updated', { detail: { totalUnreadCount } }));
    console.debug('[MessagesUnreadDebug] total_unread_and_title_updated', {
      totalUnreadCount,
      title: document.title,
    });
  }, [totalUnreadCount]);

  useEffect(() => {
    if (!isReceiptsDebugEnabled || !userId) return;
    const firstRoomMessageWithReceipts = Object.values(messages)
      .flat()
      .find((message) => {
        const meta = normalizeMessageMeta(message.meta);
        return Object.keys(meta.receipts.delivered).length > 0 || Object.keys(meta.receipts.read).length > 0;
      });

    const sampleMeta = firstRoomMessageWithReceipts ? normalizeMessageMeta(firstRoomMessageWithReceipts.meta) : null;
    const sampleReceiptKeys = sampleMeta
      ? Array.from(new Set([...Object.keys(sampleMeta.receipts.delivered), ...Object.keys(sampleMeta.receipts.read)]))
      : [];

    logReceiptsDebug('identity_alignment', {
      currentUserId: userId,
      sampleMessageId: firstRoomMessageWithReceipts?.id || null,
      sampleReceiptKeys,
    });
  }, [messages, userId]);

  const refreshRooms = useCallback(async () => {
    if (!userId) return [] as RoomWithDetails[];
    logChatDebug('refreshRooms:start', { userId, endpoint: `${CHAT_API_URL}/api/rooms` });
    const response = await fetchWithTimeout(`${CHAT_API_URL}/api/rooms`, await withAuthHeaders());
    if (!response.ok) {
      logChatDebug('refreshRooms:failed', { status: response.status, statusText: response.statusText });
      return [] as RoomWithDetails[];
    }
    const data = (await response.json()) as RoomWithDetails[];
    logChatDebug('refreshRooms:success', { count: data.length, roomIds: data.map((room) => room.id) });
    const enriched = data.map((room) => ({
      ...room,
      isPinned: pinnedRoomIds.has(room.id),
      unreadCount: unreadByRoomRef.current[room.id] ?? room.unreadCount ?? 0,
    }));
    setRooms(enriched);
    setUnreadByRoom((prev) => {
      const next = { ...prev };
      enriched.forEach((room) => {
        const fromServer = typeof room.unreadCount === 'number' ? Math.max(0, room.unreadCount) : null;
        if (fromServer !== null && next[room.id] === undefined) {
          next[room.id] = fromServer;
        }
      });
      return next;
    });

    const activeRoomId = activeRoomIdRef.current;
    if (activeRoomId) {
      const updated = enriched.find((room) => room.id === activeRoomId);
      if (updated) {
        setActiveRoom(updated);
      }
    }
    return enriched;
  }, [fetchWithTimeout, pinnedRoomIds, userId, withAuthHeaders]);

  const refreshFriendRequests = useCallback(async () => {
    if (!userId) return;
    const response = await fetchWithTimeout(`${CHAT_API_URL}/api/friend-requests`, await withAuthHeaders());
    if (!response.ok) {
      console.error('[ChatContext] failed to load friend requests', response.status, response.statusText);
      return;
    }
    const json = (await response.json().catch(() => null)) as unknown;
    const requests = parseFriendRequestsResponse(json);
    if (!requests) {
      console.error('[ChatContext] friend request response unexpected', { json });
      return;
    }
    const normalizedRequests = requests.map((request) => ({
      ...request,
      status: normalizeFriendRequestStatus(request.status) as FriendRequest['status'],
    }));
    await fetchAndCacheUsers(normalizedRequests.flatMap((request) => [request.sender_id, request.receiver_id]));
    setFriendRequests(normalizedRequests.map((request) => hydrateFriendRequestUsers(request)));
  }, [fetchAndCacheUsers, fetchWithTimeout, hydrateFriendRequestUsers, userId, withAuthHeaders]);

  const markReceipts = useCallback(
    async (roomId: string, messageIds: string[], markRead = false) => {
      if (!userId || messageIds.length === 0) return;

      const normalizedMessageIds = Array.from(new Set(messageIds.map((id) => String(id)))).sort();
      const receiptKey = `${roomId}|${markRead ? 'read' : 'delivered'}|${normalizedMessageIds.join(',')}`;
      if (lastReceiptKeyRef.current === receiptKey || inFlightReceiptKeysRef.current.has(receiptKey)) {
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
        if (response.ok) {
          lastReceiptKeyRef.current = receiptKey;
        }
        const responseBody = await response
          .clone()
          .json()
          .catch(() => null);
        logReceiptsDebug('receipt_post:response', {
          roomId,
          status: response.status,
          ok: response.ok,
          body: responseBody,
        });
      } finally {
        inFlightReceiptKeysRef.current.delete(receiptKey);
      }
    },
    [userId, withAuthHeaders]
  );

  const flushScheduledReceipts = useCallback(async () => {
    const queued = pendingReceiptQueueRef.current;
    pendingReceiptQueueRef.current = null;
    if (!queued) return;

    const deliveredIds = Array.from(queued.delivered);
    const readIds = Array.from(queued.read);

    if (deliveredIds.length > 0) {
      await markReceipts(queued.roomId, deliveredIds, false);
    }
    if (readIds.length > 0) {
      await markReceipts(queued.roomId, readIds, true);
    }
  }, [markReceipts]);

  const scheduleReceiptsForMessages = useCallback(
    (roomId: string, roomMessages: MessageWithUser[], markRead: boolean) => {
      const ids = collectReceiptCandidates(roomMessages, markRead);
      if (ids.length === 0) return;

      if (markRead) {
        const logKey = `${roomId}|${ids.join(',')}`;
        if (lastScheduledReadLogKeyRef.current !== logKey) {
          lastScheduledReadLogKeyRef.current = logKey;
          logReceiptsDebug('receipt_schedule:mark_read_candidates', {
            roomId,
            candidateCount: ids.length,
            candidateIds: ids.slice(0, 5),
            currentUserId: userIdRef.current,
          });
        }
      }

      const existingQueue = pendingReceiptQueueRef.current;
      const queue =
        existingQueue && existingQueue.roomId === roomId
          ? existingQueue
          : { roomId, delivered: new Set<string>(), read: new Set<string>() };

      ids.forEach((id) => {
        if (markRead) {
          queue.read.add(id);
          queue.delivered.add(id);
          return;
        }
        queue.delivered.add(id);
      });

      pendingReceiptQueueRef.current = queue;

      if (receiptDebounceTimerRef.current) {
        clearTimeout(receiptDebounceTimerRef.current);
      }

      receiptDebounceTimerRef.current = setTimeout(() => {
        receiptDebounceTimerRef.current = null;
        void flushScheduledReceipts();
      }, RECEIPT_DEBOUNCE_MS);
    },
    [collectReceiptCandidates, flushScheduledReceipts]
  );

  const refreshRoomMessages = useCallback(
    async (roomId: string) => {
      if (!userId) return false;
      const response = await fetchWithTimeout(`${CHAT_API_URL}/api/rooms/${roomId}/messages`, await withAuthHeaders());
      if (!response.ok) return false;
      const data = (await response.json()) as MessageWithUser[];
      const roomMemberIds = getRoomMemberIds(roomId, roomsRef.current);
      const withResolvedStatus = data.map((message) => hydrateMessage(message, userId, roomMemberIds));
      scheduleReceiptsForMessages(roomId, withResolvedStatus, false);
      if (typeof document !== 'undefined' && document.visibilityState !== 'hidden' && roomId === activeRoomIdRef.current) {
        scheduleReceiptsForMessages(roomId, withResolvedStatus, true);
      }

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
      return true;
    },
    [fetchWithTimeout, scheduleReceiptsForMessages, userId, withAuthHeaders]
  );

  useEffect(() => {
    refreshRoomsRef.current = refreshRooms;
  }, [refreshRooms]);

  useEffect(() => {
    refreshFriendRequestsRef.current = refreshFriendRequests;
  }, [refreshFriendRequests]);

  useEffect(() => {
    refreshRoomMessagesRef.current = refreshRoomMessages;
  }, [refreshRoomMessages]);

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
      setRoomUnreadCount(room.id, 0);
      if (!messagesRef.current[room.id]) {
        await refreshRoomMessages(room.id);
      }
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
    [refreshRoomMessages, rooms, sendTyping, setRoomUnreadCount]
  );

  const handleSocketMessage = useCallback(
    (event: MessageEvent) => {
      logChatDebug('socket:onmessage:raw', { data: event.data });
      let payload: ChatSocketPayload;
      try {
        payload = JSON.parse(event.data) as ChatSocketPayload;
      } catch {
        return;
      }
      const payloadWithLegacy = payload as ChatSocketPayload & {
        event?: string;
        action?: string;
        room_id?: string | number;
        user_id?: string | number;
        is_typing?: boolean;
        online_user_ids?: Array<string | number>;
        online_users?: Array<string | number>;
        onlineUsers?: Array<string | number>;
        actor_id?: string | number;
        mark_read?: boolean;
        message_ids?: Array<string | number>;
        receipts_patch?: Record<string, MessageWithUser['meta']>;
      };
      const payloadType = payload.type || payloadWithLegacy.event || payloadWithLegacy.action;
      const roomId = payload.roomId ? String(payload.roomId) : payloadWithLegacy.room_id ? String(payloadWithLegacy.room_id) : undefined;
      const payloadUserId = payload.userId ? String(payload.userId) : payloadWithLegacy.user_id ? String(payloadWithLegacy.user_id) : undefined;
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
          const memberIds = getRoomMemberIds(normalizedRoomId, roomsRef.current);
          const message = hydrateMessage({ ...rawMessage, room_id: normalizedRoomId }, userIdRef.current, memberIds);
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
            return { ...prev, [normalizedRoomId]: [...withoutTemp, message] };
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
          const isOwnMessage = toComparableId(message.user_id) === toComparableId(userIdRef.current);
          const isActiveRoom = normalizedRoomId === activeRoomIdRef.current;
          const isVisible = typeof document !== 'undefined' && document.visibilityState !== 'hidden';
          const shouldIncrementUnread = !isOwnMessage && (!isActiveRoom || !isVisible);
          if (shouldIncrementUnread) {
            incrementRoomUnreadCount(normalizedRoomId);
          } else {
            console.debug('[MessagesUnreadDebug] room_unread_not_incremented', {
              roomId: normalizedRoomId,
              isOwnMessage,
              isActiveRoom,
              isVisible,
            });
          }
          if (normalizedRoomId === activeRoomIdRef.current) {
            const roomMessages = [...(messagesRef.current[normalizedRoomId] || []), message];
            scheduleReceiptsForMessages(normalizedRoomId, roomMessages, false);
            if (typeof document !== 'undefined' && document.visibilityState !== 'hidden') {
              scheduleReceiptsForMessages(normalizedRoomId, roomMessages, true);
            }
          }
          break;
        }
        case 'receipts_updated': {
          const normalizedRoomId = roomId ? toComparableId(roomId) : undefined;
          const messageIds = (payload.messageIds || payloadWithLegacy.message_ids || [])
            .map((id) => toComparableId(id))
            .filter(Boolean);
          const receiptsPatch = payload.receiptsPatch || payloadWithLegacy.receipts_patch || {};
          const actorId = payload.actorId ? toComparableId(payload.actorId) : payloadWithLegacy.actor_id ? toComparableId(payloadWithLegacy.actor_id) : null;
          const markRead = Boolean(payload.markRead ?? payloadWithLegacy.mark_read);

          if (!normalizedRoomId || (messageIds.length === 0 && Object.keys(receiptsPatch).length === 0)) break;

          let updatedCount = 0;
          setMessages((prev) => {
            const roomMessages = prev[normalizedRoomId] || [];
            if (roomMessages.length === 0) return prev;

            const messageIdSet = new Set(messageIds);
            const roomMemberIds = getRoomMemberIds(normalizedRoomId, roomsRef.current);
            const nextRoomMessages = roomMessages.map((message) => {
              const messageId = toComparableId(message.id);
              const patchedMeta = receiptsPatch[messageId];

              if (!patchedMeta && !messageIdSet.has(messageId)) {
                return message;
              }

              const mergedMeta = mergeMessageMeta(message.meta, patchedMeta || {});
              updatedCount += 1;

              const mergedMessage = {
                ...message,
                meta: mergedMeta,
              };

              return {
                ...mergedMessage,
                status: resolveOwnMessageStatus(mergedMessage, userIdRef.current, roomMemberIds),
              };
            });

            return {
              ...prev,
              [normalizedRoomId]: nextRoomMessages,
            };
          });

          logReceiptsDebug('socket:receipts_updated', {
            roomId: normalizedRoomId,
            actorId,
            markRead,
            messageCount: messageIds.length,
            updatedCount,
          });
          break;
        }
        case 'typing':
        case 'user_typing': {
          if (!roomId || !payloadUserId) break;
          logChatDebug('socket:user_typing', { roomId, userId: payloadUserId, isTyping });

          const roomTypingExpiry = typingExpiryRef.current.get(roomId) || new Map<string, number>();
          if (isTyping) {
            const existingTimeout = roomTypingExpiry.get(payloadUserId);
            if (existingTimeout) {
              window.clearTimeout(existingTimeout);
            }
            const timeoutHandle = window.setTimeout(() => {
              setTypingUsers((prev) => {
                const set = new Set(prev[roomId] || []);
                if (!set.has(payloadUserId)) return prev;
                set.delete(payloadUserId);
                return { ...prev, [roomId]: set };
              });
              const roomMap = typingExpiryRef.current.get(roomId);
              roomMap?.delete(payloadUserId);
            }, TYPING_REMOTE_EXPIRY_MS);
            roomTypingExpiry.set(payloadUserId, timeoutHandle);
            typingExpiryRef.current.set(roomId, roomTypingExpiry);
          } else {
            const existingTimeout = roomTypingExpiry.get(payloadUserId);
            if (existingTimeout) {
              window.clearTimeout(existingTimeout);
              roomTypingExpiry.delete(payloadUserId);
            }
          }

          setTypingUsers((prev) => {
            const set = new Set(prev[roomId] || []);
            if (isTyping) {
              set.add(payloadUserId);
            } else {
              set.delete(payloadUserId);
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
          }
          break;
        }
        case 'user_online': {
          if (payloadUserId) {
            const normalizedUserId = toComparableId(payloadUserId);
            logChatDebug('socket:user_online', { userId: normalizedUserId });
            setOnlineUsers((prev) => new Set(prev).add(normalizedUserId));
          }
          break;
        }
        case 'user_offline': {
          if (payloadUserId) {
            const normalizedUserId = toComparableId(payloadUserId);
            logChatDebug('socket:user_offline', { userId: normalizedUserId });
            setOnlineUsers((prev) => {
              const next = new Set(prev);
              next.delete(normalizedUserId);
              return next;
            });
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
    [incrementRoomUnreadCount, scheduleReceiptsForMessages]
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

    ws.onopen = async () => {
      if (!isMountedRef.current) return;
      setIsConnecting(false);
      wsRef.current = ws;
      const accessToken = await getAccessToken();
      const authPayload: ChatSocketPayload = { type: 'auth', token: accessToken || undefined } as ChatSocketPayload;
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
      if (!isMountedRef.current) return;
      setIsConnecting(false);
      setOnlineUsers(new Set());
      setTypingUsers({});
      typingExpiryRef.current.forEach((roomMap) => {
        roomMap.forEach((timeoutId) => window.clearTimeout(timeoutId));
      });
      typingExpiryRef.current.clear();
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
  }, [getAccessToken, handleSocketMessage, userId]);

  useEffect(() => {
    if (!userId) return;
    shouldReconnectRef.current = true;
    connectSocket();
    return () => {
      console.debug('[MessagesPageDebug] ChatProvider socket cleanup start', {
        userId,
        activeRoomId: activeRoomIdRef.current,
      });
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
      if (receiptDebounceTimerRef.current) {
        window.clearTimeout(receiptDebounceTimerRef.current);
        receiptDebounceTimerRef.current = null;
      }
      pendingReceiptQueueRef.current = null;
      const socket = wsRef.current;
      wsRef.current = null;
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.onerror = null;
      }
      socket?.close();
      console.debug('[MessagesPageDebug] ChatProvider socket cleanup complete', {
        userId,
      });
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
    console.debug(`${CHAT_BOOTSTRAP_DEBUG_PREFIX} gate`, {
      authReady,
      isAuthenticated,
      userId,
      initialBootstrapStarted: initialBootstrapStartedRef.current,
      initialBootstrapDone: initialBootstrapDoneRef.current,
    });

    if (!authReady || !isAuthenticated || !userId) return;
    if (initialBootstrapDoneRef.current || initialBootstrapStartedRef.current) return;

    initialBootstrapStartedRef.current = true;
    let cancelled = false;

    const runInitialBootstrap = async () => {
      console.debug(`${CHAT_BOOTSTRAP_DEBUG_PREFIX} start`, { userId });
      try {
        console.debug(`${CHAT_BOOTSTRAP_DEBUG_PREFIX} bootstrap:refreshRooms:start`);
        const loadedRooms = await refreshRoomsRef.current();
        console.debug(`${CHAT_BOOTSTRAP_DEBUG_PREFIX} bootstrap:refreshRooms:success`, { roomCount: loadedRooms.length });
        if (cancelled) return;
        setHasLoadedInitialRooms(true);
        setBootstrapProgress({
          percent: 45,
          label: 'Conversations loaded…',
          preloadedRooms: 0,
          totalRooms: loadedRooms.length,
        });

        console.debug(`${CHAT_BOOTSTRAP_DEBUG_PREFIX} bootstrap:refreshFriendRequests:start`);
        await refreshFriendRequestsRef.current();
        console.debug(`${CHAT_BOOTSTRAP_DEBUG_PREFIX} bootstrap:refreshFriendRequests:success`);
        if (cancelled) return;
        setBootstrapProgress((prev) => ({
          ...prev,
          percent: 60,
          label: prev.totalRooms > 0 ? 'Preloading room messages…' : 'Wrapping up…',
        }));

        if (loadedRooms.length === 0) {
          setHasLoadedInitialRoomMessages(true);
          initialBootstrapDoneRef.current = true;
          setBootstrapProgress({
            percent: 95,
            label: 'Finalizing chat setup…',
            preloadedRooms: 0,
            totalRooms: 0,
          });
          console.debug(`${CHAT_BOOTSTRAP_DEBUG_PREFIX} success`, { roomCount: 0 });
          return;
        }

        let preloadedRooms = 0;
        for (const room of loadedRooms) {
          if (cancelled) return;
          try {
            console.debug(`${CHAT_BOOTSTRAP_DEBUG_PREFIX} bootstrap:refreshRoomMessages:start`, { roomId: room.id });
            await refreshRoomMessagesRef.current(room.id);
            console.debug(`${CHAT_BOOTSTRAP_DEBUG_PREFIX} bootstrap:refreshRoomMessages:success`, { roomId: room.id });
          } catch (roomError) {
            console.debug(`${CHAT_BOOTSTRAP_DEBUG_PREFIX} bootstrap:refreshRoomMessages:error`, {
              roomId: room.id,
              error: roomError instanceof Error ? roomError.message : String(roomError),
            });
          }
          preloadedRooms += 1;
          const roomProgress = Math.round(60 + (preloadedRooms / loadedRooms.length) * 35);
          setBootstrapProgress({
            percent: roomProgress,
            label: 'Preloading room messages…',
            preloadedRooms,
            totalRooms: loadedRooms.length,
          });
        }
        if (cancelled) return;

        setHasLoadedInitialRoomMessages(true);
        initialBootstrapDoneRef.current = true;
        setBootstrapProgress((prev) => ({
          ...prev,
          percent: 95,
          label: 'Finalizing chat setup…',
        }));
        console.debug(`${CHAT_BOOTSTRAP_DEBUG_PREFIX} success`, { roomCount: loadedRooms.length });
        console.debug(`${CHAT_BOOTSTRAP_DEBUG_PREFIX} bootstrap:done`, { roomCount: loadedRooms.length });
      } catch (error) {
        if (cancelled) return;
        console.debug(`${CHAT_BOOTSTRAP_DEBUG_PREFIX} failure`, {
          error: error instanceof Error ? error.message : String(error),
        });
        setHasLoadedInitialRooms(true);
        setHasLoadedInitialRoomMessages(true);
        initialBootstrapDoneRef.current = true;
        setBootstrapProgress((prev) => ({
          ...prev,
          percent: Math.max(prev.percent, 95),
          label: 'Finalizing chat setup…',
        }));
        console.debug(`${CHAT_BOOTSTRAP_DEBUG_PREFIX} bootstrap:done`, { degraded: true });
      }
    };

    void runInitialBootstrap();

    return () => {
      cancelled = true;
    };
  }, [authReady, isAuthenticated, userId]);

  useEffect(() => {
    if (initialChatReady) return;
    if (!authReady || !isAuthenticated) return;
    if (!hasLoadedInitialRooms || !hasLoadedInitialRoomMessages) return;
    setInitialChatReady(true);
    setBootstrapProgress((prev) => ({
      ...prev,
      percent: 100,
      label: 'Chat ready',
    }));
    console.debug(`${CHAT_BOOTSTRAP_DEBUG_PREFIX} initial_chat_ready`);
  }, [authReady, hasLoadedInitialRoomMessages, hasLoadedInitialRooms, initialChatReady, isAuthenticated]);

  useEffect(() => {
    if (!userId) return;

    const applyRealtimeFriendRequest = (incoming: FriendRequest) => {
      const normalized = normalizeFriendRequestRecord(incoming);
      if (!isFriendRequestInvolvingUser(normalized, userId)) return;

      void fetchAndCacheUsers([normalized.sender_id, normalized.receiver_id]);

      setFriendRequests((prev) => {
        const existing = prev.find((request) => request.id === normalized.id);
        const withoutDupes = prev.filter((request) => request.id !== normalized.id);
        const mergedRequest = {
          ...normalized,
          sender: normalized.sender || existing?.sender || userDirectory[String(normalized.sender_id)],
          receiver: normalized.receiver || existing?.receiver || userDirectory[String(normalized.receiver_id)],
        };
        return [mergedRequest, ...withoutDupes];
      });
    };

    const removeRealtimeFriendRequest = (incoming: FriendRequest) => {
      if (!isFriendRequestInvolvingUser(incoming, userId)) return;
      setFriendRequests((prev) => prev.filter((request) => request.id !== incoming.id));
    };

    const channel = supabase
      .channel(`friend-requests:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'friend_requests', filter: `sender_id=eq.${userId}` },
        (payload) => {
          const next = payload.new as FriendRequest;
          if (next?.id) applyRealtimeFriendRequest(next);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'friend_requests', filter: `receiver_id=eq.${userId}` },
        (payload) => {
          const next = payload.new as FriendRequest;
          if (next?.id) applyRealtimeFriendRequest(next);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'friend_requests', filter: `sender_id=eq.${userId}` },
        (payload) => {
          const next = payload.new as FriendRequest;
          if (next?.id) applyRealtimeFriendRequest(next);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'friend_requests', filter: `receiver_id=eq.${userId}` },
        (payload) => {
          const next = payload.new as FriendRequest;
          if (next?.id) applyRealtimeFriendRequest(next);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'friend_requests', filter: `sender_id=eq.${userId}` },
        (payload) => {
          const previous = payload.old as FriendRequest;
          if (previous?.id) removeRealtimeFriendRequest(previous);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'friend_requests', filter: `receiver_id=eq.${userId}` },
        (payload) => {
          const previous = payload.old as FriendRequest;
          if (previous?.id) removeRealtimeFriendRequest(previous);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchAndCacheUsers, userDirectory, userId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('pinnedRooms', JSON.stringify(Array.from(pinnedRoomIds)));
    }
  }, [pinnedRoomIds]);

  const sendMessage = useCallback(
    async (roomId: string, content: string, attachments: MessageAttachmentInput[] = [], replyTo?: string | null) => {
      const trimmed = content.trim();
      if (!trimmed && attachments.length === 0) return;

      if (process.env.NODE_ENV !== 'production' && userId && LEGACY_CHAT_ID_PREFIX_RE.test(String(userId))) {
        console.error('[ChatContext] Legacy chat identity detected for sendMessage userId. Expected Supabase auth user.id.', {
          userId,
          roomId,
        });
      }

      const tempId = `temp-${Date.now()}`;
      const optimistic: MessageWithUser = {
        id: tempId,
        tempId,
        room_id: roomId,
        user_id: userId ?? 'me',
        content: trimmed,
        reply_to: replyTo,
        attachments,
        status: 'pending',
      };
      setMessages((prev) => ({ ...prev, [roomId]: [...(prev[roomId] || []), optimistic] }));
      try {
        logChatDebug('sendMessage:attempt', {
          roomId,
          replyTo: replyTo || null,
          contentLength: trimmed.length,
          attachmentCount: attachments.length,
        });
        console.debug('sendMessage payload', {
          roomId,
          content: trimmed,
          contentLength: typeof trimmed === 'string' ? trimmed.trim().length : 0,
          attachments,
          attachmentsLength: Array.isArray(attachments) ? attachments.length : -1,
        });
        const response = await fetch(`${CHAT_API_URL}/api/rooms/${roomId}/messages`, await withAuthHeaders({
          method: 'POST',
          body: JSON.stringify({ content: trimmed, reply_to: replyTo, attachments }),
        }));
        if (!response.ok) {
          const errorText = await response.text();
          console.error('sendMessage failed', {
            status: response.status,
            roomId,
            content: trimmed,
            attachments,
            errorText,
          });
          logChatDebug('sendMessage:failed_response', { status: response.status, statusText: response.statusText, roomId });
          throw new Error(`Failed to send message (status: ${response.status})`);
        }
        const saved = (await response.json()) as MessageWithUser;
        logChatDebug('sendMessage:success', { roomId, messageId: saved.id, status: saved.status || 'unknown' });
        setMessages((prev) => {
          const list = prev[roomId] || [];
          const withoutTemp = list.filter((msg) => msg.id !== tempId && msg.id !== saved.id);
          const memberIds = getRoomMemberIds(roomId, roomsRef.current);
          return { ...prev, [roomId]: [...withoutTemp, hydrateMessage({ ...saved, status: 'sent' }, userIdRef.current, memberIds)] };
        });
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
    [userId, withAuthHeaders]
  );

  useEffect(() => {
    if (!activeRoom?.id || !userId) return;
    const roomId = activeRoom.id;
    const roomMessages = messages[roomId] || [];
    if (roomMessages.length === 0) return;

    scheduleReceiptsForMessages(roomId, roomMessages, false);
    if (typeof document !== 'undefined' && document.visibilityState !== 'hidden') {
      scheduleReceiptsForMessages(roomId, roomMessages, true);
    }
  }, [activeRoom?.id, messages, scheduleReceiptsForMessages, userId]);

  useEffect(() => {
    if (!activeRoom?.id || !userId) return;

    const onFocus = () => {
      if (document.visibilityState === 'hidden') return;
      const currentMessages = messagesRef.current[activeRoom.id] || [];
      scheduleReceiptsForMessages(activeRoom.id, currentMessages, true);
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [activeRoom?.id, scheduleReceiptsForMessages, userId]);

  useEffect(() => {
    if (!activeRoom?.id) return;
    const roomId = activeRoom.id;
    const channel = supabase
      .channel(`messages:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const next = payload.new as MessageWithUser;
          if (!next?.id) return;
          if (payload.eventType === 'UPDATE') {
            logReceiptsDebug('realtime:update:meta_receipts', {
              roomId,
              messageId: next.id,
              receipts: normalizeMessageMeta(next.meta).receipts,
            });
          }
          const roomMemberIds = getRoomMemberIds(roomId, roomsRef.current);
          const hydrated = hydrateMessage({ ...next, room_id: roomId }, userIdRef.current, roomMemberIds);
          setMessages((prev) => {
            const list = prev[roomId] || [];
            const hasExisting = list.some((item) => item.id === hydrated.id);
            const merged = hasExisting
              ? list.map((item) =>
                  item.id === hydrated.id
                    ? (() => {
                        const mergedMeta = mergeMessageMeta(item.meta, hydrated.meta);
                        const mergedMessage = {
                          ...item,
                          ...hydrated,
                          meta: mergedMeta,
                          user: item.user || hydrated.user,
                        };
                        return {
                          ...mergedMessage,
                          status: resolveOwnMessageStatus(mergedMessage, userIdRef.current, roomMemberIds),
                        };
                      })()
                    : item
                )
              : [...list, hydrated];
            return {
              ...prev,
              [roomId]: merged.sort((a, b) => {
                const first = a.created_at ? new Date(a.created_at).getTime() : Number.MAX_SAFE_INTEGER;
                const second = b.created_at ? new Date(b.created_at).getTime() : Number.MAX_SAFE_INTEGER;
                return first - second;
              }),
            };
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeRoom?.id]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const clearActiveRoomWhenVisible = () => {
      if (document.visibilityState === 'hidden') return;
      const activeRoomId = activeRoomIdRef.current;
      if (!activeRoomId) return;
      if ((unreadByRoomRef.current[activeRoomId] || 0) > 0) {
        console.debug('[MessagesUnreadDebug] clear_active_room_on_visibility', { roomId: activeRoomId });
        setRoomUnreadCount(activeRoomId, 0);
      }
    };

    document.addEventListener('visibilitychange', clearActiveRoomWhenVisible);
    window.addEventListener('focus', clearActiveRoomWhenVisible);
    return () => {
      document.removeEventListener('visibilitychange', clearActiveRoomWhenVisible);
      window.removeEventListener('focus', clearActiveRoomWhenVisible);
    };
  }, [setRoomUnreadCount]);


  useEffect(() => {
    if (typeof document === 'undefined') return;

    const logResumeState = (trigger: string) => {
      console.debug('[MessagesResumeDebug] chat_context_state', {
        trigger,
        visibilityState: document.visibilityState,
        activeRoomId: activeRoomIdRef.current,
        initialChatReady,
        isConnecting,
        websocketReadyState: wsRef.current?.readyState ?? 'missing',
      });
    };

    const onVisibilityChange = () => {
      logResumeState('visibilitychange');
    };

    const onFocus = () => {
      logResumeState('window_focus');
    };

    const onBlur = () => {
      logResumeState('window_blur');
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, [initialChatReady, isConnecting]);

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
        await withAuthHeaders({ method: 'POST', body: JSON.stringify({ targetUserId }) })
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
        await withAuthHeaders({ method: 'POST', body: JSON.stringify(payload) })
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
        const response = await fetch(url, await withAuthHeaders());
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
          .map((person) => ({
            id: person.id,
            email: person.email || '',
            full_name: person.displayName,
            role: person.role,
            committee: person.committeeCode || null,
            country: person.country || null,
            is_friend: false,
            has_pending_request: false,
          }));
        return mapped;
      } catch (err) {
        console.error('[ChatContext] people search threw', err);
        return [] as UserSearchResult[];
      }
    },
    [userId, withAuthHeaders]
  );

  const sendFriendRequest = useCallback(
    async (targetUserId: string) => {
      if (!userId) return null;
      try {
        const response = await fetch(
          `${CHAT_API_URL}/api/friend-requests`,
          await withAuthHeaders({ method: 'POST', body: JSON.stringify({ targetUserId }) })
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
          `${CHAT_API_URL}/api/friend-requests/${id}/respond`,
          await withAuthHeaders({
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
          `${CHAT_API_URL}/api/friend-requests/${id}/respond`,
          await withAuthHeaders({
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
      initialChatReady,
      bootstrapProgress,
      friendRequests,
      incomingRequests: friendRequests.filter((req) => req.status === 'pending' && req.receiver_id === userId),
      resolveUserDisplay,
      currentUserId: userId,
      pinnedRoomIds,
      totalUnreadCount,
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
      initialChatReady,
      bootstrapProgress,
      friendRequests,
      resolveUserDisplay,
      userId,
      pinnedRoomIds,
      totalUnreadCount,
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
