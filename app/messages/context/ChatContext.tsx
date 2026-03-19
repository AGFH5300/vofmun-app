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
import { toast } from 'sonner';

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
  editMessage: (roomId: string, messageId: string, content: string) => Promise<void>;
  deleteMessage: (roomId: string, messageId: string) => Promise<void>;
  deleteMessagesForMe: (roomId: string, messageIds: string[]) => Promise<void>;
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
const isDevelopment = process.env.NODE_ENV !== 'production';
const isReceiptsDebugEnabled = process.env.NEXT_PUBLIC_CHAT_RECEIPTS_DEBUG === '1';
const TYPING_TRUE_THROTTLE_MS = 1000;
const TYPING_IDLE_TIMEOUT_MS = 2500;
const TYPING_REMOTE_EXPIRY_MS = 5000;
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 12000;
const RECEIPT_DEBOUNCE_MS = 300;
const BOOTSTRAP_FETCH_TIMEOUT_MS = 12000;
const FRIEND_REQUEST_REFRESH_DEBOUNCE_MS = 80;

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


type ChatUserLike = MessageWithUser['user'] | FriendRequest['sender'] | null | undefined;

const toDirectoryUser = (profile: ChatUserLike) => {
  if (!profile?.id) return null;
  const first = profile.first_name ?? null;
  const last = profile.last_name ?? null;
  const fullName =
    profile.full_name?.trim() || `${first || ''} ${last || ''}`.trim() || profile.email || profile.id;

  return {
    id: String(profile.id),
    email: profile.email || '',
    full_name: fullName,
    first_name: first,
    last_name: last,
    avatar_url: profile.avatar_url || null,
  } satisfies FriendRequest['sender'];
};


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
  const composed = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  if (composed) return composed;
  if (user.email) return user.email;
  return '';
};

const FALLBACK_USER_DISPLAY = 'Unknown user';

const getFriendRequestDisplayName = (targetUserId: string, fallbackUser?: FriendRequest['sender'] | null) => {
  const normalizedId = String(targetUserId);
  const display = formatUserDisplayName(fallbackUser);
  if (display) return display;
  return isUuid(normalizedId) ? FALLBACK_USER_DISPLAY : normalizedId;
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

const isPendingLocalMessage = (message: MessageWithUser) => {
  const id = toComparableId(message.id);
  return Boolean(message.tempId) || id.startsWith('temp-') || message.status === 'pending';
};

const normalizeMessageContentForMatch = (content?: string | null) => (content || '').trim();

const getAttachmentMatchSignature = (attachments?: MessageWithUser['attachments']) => {
  if (!attachments || attachments.length === 0) return '';
  return [...attachments]
    .map((attachment) => {
      const bucket = attachment?.bucket || '';
      const path = attachment?.path || '';
      const name = attachment?.original_name || '';
      const size = Number(attachment?.size_bytes || 0);
      return `${bucket}:${path}:${name}:${size}`;
    })
    .sort()
    .join('|');
};

const isLikelyOptimisticMatch = (candidate: MessageWithUser, incoming: MessageWithUser, currentUserId: string | null) => {
  if (!isPendingLocalMessage(candidate)) return false;
  if (toComparableId(candidate.room_id) !== toComparableId(incoming.room_id)) return false;
  if (toComparableId(candidate.user_id) !== toComparableId(incoming.user_id)) return false;
  if (!currentUserId || toComparableId(candidate.user_id) !== toComparableId(currentUserId)) return false;

  const candidateContent = normalizeMessageContentForMatch(candidate.content);
  const incomingContent = normalizeMessageContentForMatch(incoming.content);
  if (candidateContent !== incomingContent) return false;

  const candidateAttachments = getAttachmentMatchSignature(candidate.attachments);
  const incomingAttachments = getAttachmentMatchSignature(incoming.attachments);
  if (candidateAttachments !== incomingAttachments) return false;

  const candidateCreatedAt = candidate.created_at ? new Date(candidate.created_at).getTime() : Number.NaN;
  const incomingCreatedAt = incoming.created_at ? new Date(incoming.created_at).getTime() : Number.NaN;
  if (Number.isFinite(candidateCreatedAt) && Number.isFinite(incomingCreatedAt)) {
    const delta = Math.abs(incomingCreatedAt - candidateCreatedAt);
    if (delta > 2 * 60 * 1000) return false;
  }

  return true;
};

const reconcileIncomingMessage = (
  currentList: MessageWithUser[],
  incoming: MessageWithUser,
  currentUserId: string | null
) => {
  const byServerIdIndex = currentList.findIndex((item) => toComparableId(item.id) === toComparableId(incoming.id));
  if (byServerIdIndex >= 0) {
    const merged = [...currentList];
    merged[byServerIdIndex] = {
      ...merged[byServerIdIndex],
      ...incoming,
      tempId: undefined,
    };
    return merged;
  }

  const optimisticIndex = currentList.findIndex((item) => isLikelyOptimisticMatch(item, incoming, currentUserId));
  if (optimisticIndex >= 0) {
    const merged = [...currentList];
    merged[optimisticIndex] = {
      ...merged[optimisticIndex],
      ...incoming,
      tempId: undefined,
    };
    return merged;
  }

  return [...currentList, incoming];
};


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
  const pendingRoomJoinIdsRef = useRef<Set<string>>(new Set());
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
  const postedReceiptKeysRef = useRef<Map<string, string>>(new Map());
  const scheduledReceiptKeysRef = useRef<Map<string, string>>(new Map());
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
  const friendRequestRefetchScheduledRef = useRef(false);
  const friendRequestRefetchInFlightRef = useRef(false);
  const friendRequestRefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const friendRequestRefetchQueuedRef = useRef(false);
  const friendRequestSnapshotRef = useRef<
    Map<string, { status: FriendRequest['status']; senderId: string; receiverId: string; sender?: FriendRequest['sender']; receiver?: FriendRequest['receiver'] }>
  >(new Map());
  const friendRequestToastBootstrapRef = useRef(false);
  const friendRequestToastTransitionsRef = useRef<Set<string>>(new Set());
  const visibilityRefreshInFlightRef = useRef(false);
  const userDirectoryRef = useRef<Record<string, FriendRequest['sender']>>({});
  const hiddenMessageIdsByRoomRef = useRef<Record<string, Set<string>>>({});
  const joinedSocketRoomIdsRef = useRef<Set<string>>(new Set());

  const cacheHiddenMessageIdsForRoom = useCallback(async (roomId: string) => {
    const normalizedRoomId = toComparableId(roomId);
    const currentUserId = toComparableId(userIdRef.current);
    if (!currentUserId) return new Set<string>();

    const { data, error } = await supabase
      .from('message_hidden_for_users')
      .select('message_id')
      .eq('room_id', normalizedRoomId)
      .eq('user_id', currentUserId);

    if (error) {
      console.error('[ChatContext] failed to load hidden messages for room', {
        roomId: normalizedRoomId,
        error,
      });
      return hiddenMessageIdsByRoomRef.current[normalizedRoomId] || new Set<string>();
    }

    const hiddenIds = new Set((data || []).map((row: { message_id?: string | number | null }) => toComparableId(row.message_id)).filter(Boolean));
    hiddenMessageIdsByRoomRef.current[normalizedRoomId] = hiddenIds;
    return hiddenIds;
  }, []);

  const filterHiddenMessagesForRoom = useCallback((roomId: string, roomMessages: MessageWithUser[]) => {
    const normalizedRoomId = toComparableId(roomId);
    const hiddenIds = hiddenMessageIdsByRoomRef.current[normalizedRoomId];
    if (!hiddenIds || hiddenIds.size === 0) return roomMessages;
    return roomMessages.filter((message) => !hiddenIds.has(toComparableId(message.id)));
  }, []);

  const getVisibleLastMessageForRoom = useCallback(
    (roomId: string, roomMessages?: MessageWithUser[]) => {
      const normalizedRoomId = toComparableId(roomId);
      const sourceMessages = roomMessages ?? messagesRef.current[normalizedRoomId] ?? [];
      const visibleMessages = filterHiddenMessagesForRoom(normalizedRoomId, sourceMessages);
      return visibleMessages[visibleMessages.length - 1] || null;
    },
    [filterHiddenMessagesForRoom]
  );

  const mergeUsersIntoDirectory = useCallback((profiles: ChatUserLike[]) => {
    const prepared = profiles
      .map((profile) => toDirectoryUser(profile))
      .filter((profile): profile is FriendRequest['sender'] => Boolean(profile));

    if (prepared.length === 0) return;

    setUserDirectory((prev) => {
      let changed = false;
      const next = { ...prev };

      prepared.forEach((profile) => {
        const existing = prev[profile.id];
        if (!existing || !existing.full_name || existing.full_name === FALLBACK_USER_DISPLAY) {
          next[profile.id] = { ...existing, ...profile };
          changed = true;
          return;
        }

        const shouldImproveName =
          (!existing.full_name || existing.full_name === profile.id || existing.full_name === FALLBACK_USER_DISPLAY) &&
          Boolean(profile.full_name && profile.full_name !== profile.id);

        if (shouldImproveName) {
          next[profile.id] = { ...existing, ...profile };
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, []);

  const isDocumentVisible = useCallback(
    () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
    []
  );

  const isRoomActivelyRead = useCallback(
    (roomId: string | null | undefined) => {
      const normalizedRoomId = toComparableId(roomId);
      if (!normalizedRoomId) return false;
      return normalizedRoomId === toComparableId(activeRoomIdRef.current) && isDocumentVisible();
    },
    [isDocumentVisible]
  );

  const setRoomUnreadCount = useCallback((roomId: string, count: number) => {
    const normalizedRoomId = toComparableId(roomId);
    const safeCount = Math.max(0, Math.floor(count));
    unreadByRoomRef.current = {
      ...unreadByRoomRef.current,
      [normalizedRoomId]: safeCount,
    };
    setUnreadByRoom((prev) => {
      const previous = prev[normalizedRoomId] || 0;
      if (previous === safeCount) return prev;
      return { ...prev, [normalizedRoomId]: safeCount };
    });
    setRooms((prev) =>
      prev.map((room) =>
        toComparableId(room.id) === normalizedRoomId
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
    const nextCount = (unreadByRoomRef.current[normalizedRoomId] || 0) + 1;
    unreadByRoomRef.current = {
      ...unreadByRoomRef.current,
      [normalizedRoomId]: nextCount,
    };
    setUnreadByRoom((prev) => {
      return { ...prev, [normalizedRoomId]: nextCount };
    });
    setRooms((prev) =>
      prev.map((room) =>
        toComparableId(room.id) === normalizedRoomId
          ? {
              ...room,
              unreadCount: nextCount,
            }
          : room
      )
    );
  }, []);

  const applyIncomingMessageToRoomList = useCallback((
    roomId: string,
    message: MessageWithUser,
    options?: { incrementUnread?: boolean }
  ) => {
    const normalizedRoomId = toComparableId(roomId);
    const shouldIncrementUnread = Boolean(options?.incrementUnread);

    setRooms((prev) => {
      let didUpdate = false;
      const nextRooms = prev.map((room) => {
        if (toComparableId(room.id) !== normalizedRoomId) return room;

        didUpdate = true;
        const nextUnreadCount = shouldIncrementUnread
          ? Math.max(0, Math.floor(unreadByRoomRef.current[normalizedRoomId] ?? room.unreadCount ?? 0)) + 1
          : Math.max(0, Math.floor(unreadByRoomRef.current[normalizedRoomId] ?? room.unreadCount ?? 0));

        return {
          ...room,
          lastMessage: message,
          unreadCount: nextUnreadCount,
        };
      });

      return didUpdate ? nextRooms : prev;
    });
  }, []);

  const joinSocketRooms = useCallback((roomIds: Array<string | null | undefined>) => {
    const socket = wsRef.current;
    const normalizedRoomIds = Array.from(new Set(roomIds.map((roomId) => toComparableId(roomId)).filter(Boolean)));
    if (normalizedRoomIds.length === 0) return;

    normalizedRoomIds.forEach((roomId) => pendingRoomJoinIdsRef.current.add(roomId));

    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    normalizedRoomIds.forEach((roomId) => {
      if (joinedSocketRoomIdsRef.current.has(roomId)) {
        pendingRoomJoinIdsRef.current.delete(roomId);
        return;
      }

      socket.send(JSON.stringify({ type: 'join_room', roomId } satisfies ChatSocketPayload));
      joinedSocketRoomIdsRef.current.add(roomId);
      logChatDebug('socket:join_room_sent', { roomId });
      pendingRoomJoinIdsRef.current.delete(roomId);
    });
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

    const missingIds = uniqueIds.filter((id) => !userDirectoryRef.current[id]);
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

    mergeUsersIntoDirectory(
      data.map((row) => ({
        id: row.id,
        email: row.email || '',
        full_name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
        first_name: row.first_name || null,
        last_name: row.last_name || null,
      }))
    );
  }, [mergeUsersIntoDirectory]);

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
      const fromFallback = getFriendRequestDisplayName(normalizedId, fallbackUser);
      if (fromFallback) return fromFallback;
      const fromCache = getFriendRequestDisplayName(normalizedId, userDirectory[normalizedId]);
      if (fromCache) return fromCache;
      return FALLBACK_USER_DISPLAY;
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

  const getReceiptSignature = useCallback((roomId: string, messageIds: string[], markRead: boolean) => {
    const normalizedMessageIds = Array.from(new Set(messageIds.map((id) => String(id)))).sort();
    return `${roomId}|${markRead ? 'read' : 'delivered'}|${normalizedMessageIds.join(',')}`;
  }, []);

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
    joinSocketRooms(rooms.map((room) => room.id));
  }, [joinSocketRooms, rooms]);

  useEffect(() => {
    const activeRoomId = activeRoomIdRef.current;
    if (!activeRoomId) return;

    const nextActiveRoom = rooms.find((room) => room.id === activeRoomId);
    if (nextActiveRoom) {
      setActiveRoom((prev) => (prev?.id === nextActiveRoom.id ? { ...prev, ...nextActiveRoom } : nextActiveRoom));
      return;
    }

    setActiveRoom(rooms[0] || null);
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

  const roomsWithUnreadState = useMemo(
    () =>
      rooms.map((room) => {
        const normalizedRoomId = toComparableId(room.id);
        const canonicalUnreadCount = isRoomActivelyRead(normalizedRoomId)
          ? 0
          : Math.max(0, Math.floor(unreadByRoom[normalizedRoomId] ?? room.unreadCount ?? 0));

        if (canonicalUnreadCount === (room.unreadCount || 0)) {
          return room;
        }

        return {
          ...room,
          unreadCount: canonicalUnreadCount,
        };
      }),
    [isRoomActivelyRead, rooms, unreadByRoom]
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
    mergeUsersIntoDirectory(data.flatMap((room) => room.members.map((member) => member.user)));

    const enriched = data.map((room) => {
      const normalizedRoomId = toComparableId(room.id);
      const locallyVisibleLastMessage = getVisibleLastMessageForRoom(normalizedRoomId);
      const serverLastMessage = room.lastMessage && !hiddenMessageIdsByRoomRef.current[normalizedRoomId]?.has(toComparableId(room.lastMessage.id))
        ? room.lastMessage
        : null;
      const serverUnreadCount = typeof room.unreadCount === 'number' ? Math.max(0, room.unreadCount) : 0;
      const localUnreadCount = unreadByRoomRef.current[normalizedRoomId];
      const mergedUnreadCount = isRoomActivelyRead(normalizedRoomId)
        ? 0
        : Math.max(localUnreadCount ?? 0, serverUnreadCount);

      return {
        ...room,
        id: normalizedRoomId,
        lastMessage: locallyVisibleLastMessage || serverLastMessage,
        members: room.members.map((member) => ({
          ...member,
          user: member.user || userDirectoryRef.current[String(member.user_id)] || undefined,
        })),
        isPinned: pinnedRoomIds.has(normalizedRoomId),
        unreadCount: mergedUnreadCount,
      };
    });
    setRooms((prev) => {
      const previousById = new Map(prev.map((room) => [room.id, room]));
      return enriched.map((room) => {
        const previous = previousById.get(room.id);
        const previousMembersByUserId = new Map((previous?.members || []).map((member) => [String(member.user_id), member.user]));
        return {
          ...room,
          members: room.members.map((member) => ({
            ...member,
            user: member.user || previousMembersByUserId.get(String(member.user_id)) || userDirectoryRef.current[String(member.user_id)] || undefined,
          })),
        };
      });
    });
    const nextUnreadByRoom = enriched.reduce<Record<string, number>>((acc, room) => {
      acc[room.id] = Math.max(0, Math.floor(room.unreadCount || 0));
      return acc;
    }, {});
    unreadByRoomRef.current = nextUnreadByRoom;
    setUnreadByRoom(nextUnreadByRoom);

    const activeRoomId = activeRoomIdRef.current;
    if (activeRoomId) {
      const updated = enriched.find((room) => room.id === activeRoomId);
      if (updated) {
        setActiveRoom(updated);
      }
    }
    return enriched;
  }, [fetchWithTimeout, getVisibleLastMessageForRoom, isRoomActivelyRead, mergeUsersIntoDirectory, pinnedRoomIds, userId, withAuthHeaders]);

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
      const receiptKey = getReceiptSignature(roomId, normalizedMessageIds, markRead);
      const dedupeScopeKey = `${roomId}|${markRead ? 'read' : 'delivered'}`;
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
        if (response.ok) {
          postedReceiptKeysRef.current.set(dedupeScopeKey, receiptKey);
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
    [getReceiptSignature, userId, withAuthHeaders]
  );

  const flushScheduledReceipts = useCallback(async () => {
    const queued = pendingReceiptQueueRef.current;
    pendingReceiptQueueRef.current = null;
    if (!queued) return;

    const deliveredIds = Array.from(queued.delivered);
    const readIds = Array.from(queued.read);

    scheduledReceiptKeysRef.current.delete(`${queued.roomId}|delivered`);
    scheduledReceiptKeysRef.current.delete(`${queued.roomId}|read`);

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
      const dedupeScopeKey = `${roomId}|${markRead ? 'read' : 'delivered'}`;
      if (ids.length === 0) {
        scheduledReceiptKeysRef.current.delete(dedupeScopeKey);
        return;
      }

      const receiptKey = getReceiptSignature(roomId, ids, markRead);
      if (
        scheduledReceiptKeysRef.current.get(dedupeScopeKey) === receiptKey ||
        postedReceiptKeysRef.current.get(dedupeScopeKey) === receiptKey ||
        inFlightReceiptKeysRef.current.has(receiptKey)
      ) {
        return;
      }

      scheduledReceiptKeysRef.current.set(dedupeScopeKey, receiptKey);

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
    [collectReceiptCandidates, flushScheduledReceipts, getReceiptSignature]
  );

  const refreshRoomMessages = useCallback(
    async (roomId: string) => {
      if (!userId) return false;
      const normalizedRoomId = toComparableId(roomId);
      const response = await fetchWithTimeout(`${CHAT_API_URL}/api/rooms/${normalizedRoomId}/messages`, await withAuthHeaders());
      if (!response.ok) return false;
      const data = (await response.json()) as MessageWithUser[];
      const hiddenMessageIds = await cacheHiddenMessageIdsForRoom(normalizedRoomId);
      const visibleData = data.filter((message) => !hiddenMessageIds.has(toComparableId(message.id)));
      mergeUsersIntoDirectory(visibleData.map((message) => message.user));
      const roomMemberIds = getRoomMemberIds(normalizedRoomId, roomsRef.current);
      const withResolvedStatus = visibleData
        .map((message) =>
          hydrateMessage(
            {
              ...message,
              room_id: normalizedRoomId,
              user: message.user || userDirectoryRef.current[String(message.user_id)] || undefined,
            },
            userId,
            roomMemberIds
          )
        )
        .sort((a, b) => {
          const first = a.created_at ? new Date(a.created_at).getTime() : Number.MAX_SAFE_INTEGER;
          const second = b.created_at ? new Date(b.created_at).getTime() : Number.MAX_SAFE_INTEGER;
          return first - second;
        });
      scheduleReceiptsForMessages(normalizedRoomId, withResolvedStatus, false);
      if (isRoomActivelyRead(normalizedRoomId)) {
        scheduleReceiptsForMessages(normalizedRoomId, withResolvedStatus, true);
        setRoomUnreadCount(normalizedRoomId, 0);
      }

      messagesRef.current = {
        ...messagesRef.current,
        [normalizedRoomId]: withResolvedStatus,
      };
      setMessages((prev) => ({ ...prev, [normalizedRoomId]: withResolvedStatus }));
      setRooms((prev) =>
        prev.map((room) =>
          toComparableId(room.id) === normalizedRoomId
            ? {
                ...room,
                lastMessage: withResolvedStatus[withResolvedStatus.length - 1] || null,
              }
            : room
        )
      );
      return true;
    },
    [cacheHiddenMessageIdsForRoom, fetchWithTimeout, isRoomActivelyRead, mergeUsersIntoDirectory, scheduleReceiptsForMessages, setRoomUnreadCount, userId, withAuthHeaders]
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
      pendingRoomJoinIdsRef.current.add(room.id);
      setActiveRoom(rooms.find((candidate) => candidate.id === room.id) || room);
      if (isRoomActivelyRead(room.id)) {
        setRoomUnreadCount(room.id, 0);
      }
      if (!messagesRef.current[room.id]) {
        await refreshRoomMessages(room.id);
      }
      if (isRoomActivelyRead(room.id)) {
        setRoomUnreadCount(room.id, 0);
      }
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        joinSocketRooms([room.id]);
      } else {
        logChatDebug('selectRoom:join_room_skipped_socket_not_open', {
          roomId: room.id,
          readyState: wsRef.current?.readyState ?? 'missing',
        });
      }
    },
    [isRoomActivelyRead, joinSocketRooms, refreshRoomMessages, rooms, sendTyping, setRoomUnreadCount]
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
          joinSocketRooms([
            activeRoomIdRef.current,
            ...roomsRef.current.map((room) => room.id),
            ...Array.from(pendingRoomJoinIdsRef.current),
          ]);
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
          mergeUsersIntoDirectory([rawMessage.user]);
          const memberIds = getRoomMemberIds(normalizedRoomId, roomsRef.current);
          const message = hydrateMessage(
            {
              ...rawMessage,
              room_id: normalizedRoomId,
              user: rawMessage.user || userDirectoryRef.current[String(rawMessage.user_id)] || undefined,
            },
            userIdRef.current,
            memberIds
          );
          const roomHiddenIds = hiddenMessageIdsByRoomRef.current[normalizedRoomId];
          if (roomHiddenIds?.has(toComparableId(message.id))) {
            break;
          }
          logChatDebug('socket:new_message', {
            roomId: normalizedRoomId,
            messageId: message.id,
            fromUserId: message.user_id,
            contentPreview: String(message.content || '').slice(0, 80),
          });
          setMessages((prev) => {
            const list = prev[normalizedRoomId] || [];
            const reconciled = reconcileIncomingMessage(list, message, userIdRef.current);
            return { ...prev, [normalizedRoomId]: reconciled };
          });
          const isOwnMessage = toComparableId(message.user_id) === toComparableId(userIdRef.current);
          const isActiveRoom = normalizedRoomId === activeRoomIdRef.current;
          const isVisible = isDocumentVisible();
          const shouldIncrementUnread = !isOwnMessage && (!isActiveRoom || !isVisible);
          applyIncomingMessageToRoomList(normalizedRoomId, message, { incrementUnread: shouldIncrementUnread });
          if (shouldIncrementUnread) {
            incrementRoomUnreadCount(normalizedRoomId);
          }
          if (normalizedRoomId === activeRoomIdRef.current) {
            const roomMessages = [...(messagesRef.current[normalizedRoomId] || []), message];
            scheduleReceiptsForMessages(normalizedRoomId, roomMessages, false);
            if (isRoomActivelyRead(normalizedRoomId)) {
              scheduleReceiptsForMessages(normalizedRoomId, roomMessages, true);
              setRoomUnreadCount(normalizedRoomId, 0);
            }
          }
          break;
        }

        case 'message_updated': {
          const rawMessage = payload.message;
          const roomId = rawMessage?.room_id || payload.roomId;
          if (!rawMessage || !roomId) break;

          const normalizedRoomId = toComparableId(roomId);
          mergeUsersIntoDirectory([rawMessage.user]);
          const memberIds = getRoomMemberIds(normalizedRoomId, roomsRef.current);
          const hydrated = hydrateMessage(
            {
              ...rawMessage,
              room_id: normalizedRoomId,
              user: rawMessage.user || userDirectoryRef.current[String(rawMessage.user_id)] || undefined,
            },
            userIdRef.current,
            memberIds
          );

          setMessages((prev) => {
            const list = prev[normalizedRoomId] || [];
            const messageIndex = list.findIndex((item) => toComparableId(item.id) === toComparableId(hydrated.id));
            if (messageIndex < 0) return prev;
            const next = [...list];
            next[messageIndex] = { ...next[messageIndex], ...hydrated };
            return { ...prev, [normalizedRoomId]: next };
          });

          setRooms((prev) =>
            prev.map((room) => {
              if (toComparableId(room.id) !== normalizedRoomId) return room;
              if (!room.lastMessage || toComparableId(room.lastMessage.id) !== toComparableId(hydrated.id)) return room;
              return { ...room, lastMessage: { ...room.lastMessage, ...hydrated } };
            })
          );
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
    [applyIncomingMessageToRoomList, incrementRoomUnreadCount, isDocumentVisible, isRoomActivelyRead, mergeUsersIntoDirectory, scheduleReceiptsForMessages, setRoomUnreadCount, joinSocketRooms]
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
    joinedSocketRoomIdsRef.current = new Set();
    wsRef.current = ws;

    ws.onopen = async () => {
      if (!isMountedRef.current) return;
      setIsConnecting(false);
      wsRef.current = ws;
      const accessToken = await getAccessToken();
      const authPayload: ChatSocketPayload = { type: 'auth', token: accessToken || undefined } as ChatSocketPayload;
      logChatDebug('socket:onopen:send_auth', authPayload as unknown as Record<string, unknown>);
      ws.send(JSON.stringify(authPayload));

      joinSocketRooms([activeRoomIdRef.current, ...roomsRef.current.map((room) => room.id)]);
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
      joinedSocketRoomIdsRef.current = new Set();
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
  }, [getAccessToken, handleSocketMessage, joinSocketRooms, userId]);

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
      postedReceiptKeysRef.current.clear();
      scheduledReceiptKeysRef.current.clear();
      inFlightReceiptKeysRef.current.clear();
      const socket = wsRef.current;
      wsRef.current = null;
      joinedSocketRoomIdsRef.current = new Set();
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
    joinSocketRooms([...rooms.map((room) => room.id), activeRoomIdRef.current]);
  }, [isConnecting, joinSocketRooms, rooms]);


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

    const runFriendRequestRefreshQueue = async () => {
      if (friendRequestRefetchInFlightRef.current) return;

      friendRequestRefetchInFlightRef.current = true;
      try {
        while (friendRequestRefetchQueuedRef.current) {
          friendRequestRefetchQueuedRef.current = false;
          await refreshFriendRequestsRef.current();
        }
      } finally {
        friendRequestRefetchInFlightRef.current = false;
      }
    };

    const scheduleFriendRequestRefresh = (incoming: FriendRequest) => {
      const normalized = normalizeFriendRequestRecord(incoming);
      if (!isFriendRequestInvolvingUser(normalized, userId)) return;

      friendRequestRefetchQueuedRef.current = true;
      if (friendRequestRefetchScheduledRef.current) return;

      friendRequestRefetchScheduledRef.current = true;
      friendRequestRefetchTimerRef.current = setTimeout(() => {
        friendRequestRefetchScheduledRef.current = false;
        friendRequestRefetchTimerRef.current = null;
        void runFriendRequestRefreshQueue();
      }, FRIEND_REQUEST_REFRESH_DEBOUNCE_MS);
    };

    const channel = supabase
      .channel(`friend-requests:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'friend_requests', filter: `sender_id=eq.${userId}` },
        (payload) => {
          const next = payload.new as FriendRequest;
          if (next?.id) scheduleFriendRequestRefresh(next);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'friend_requests', filter: `receiver_id=eq.${userId}` },
        (payload) => {
          const next = payload.new as FriendRequest;
          if (next?.id) scheduleFriendRequestRefresh(next);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'friend_requests', filter: `sender_id=eq.${userId}` },
        (payload) => {
          const next = payload.new as FriendRequest;
          if (next?.id) scheduleFriendRequestRefresh(next);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'friend_requests', filter: `receiver_id=eq.${userId}` },
        (payload) => {
          const next = payload.new as FriendRequest;
          if (next?.id) scheduleFriendRequestRefresh(next);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'friend_requests', filter: `sender_id=eq.${userId}` },
        (payload) => {
          const previous = payload.old as FriendRequest;
          if (previous?.id) scheduleFriendRequestRefresh(previous);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'friend_requests', filter: `receiver_id=eq.${userId}` },
        (payload) => {
          const previous = payload.old as FriendRequest;
          if (previous?.id) scheduleFriendRequestRefresh(previous);
        }
      )
      .subscribe();

    return () => {
      if (friendRequestRefetchTimerRef.current) {
        clearTimeout(friendRequestRefetchTimerRef.current);
        friendRequestRefetchTimerRef.current = null;
      }
      friendRequestRefetchScheduledRef.current = false;
      friendRequestRefetchQueuedRef.current = false;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      friendRequestSnapshotRef.current = new Map();
      friendRequestToastBootstrapRef.current = false;
      friendRequestToastTransitionsRef.current.clear();
      return;
    }

    const previousSnapshot = friendRequestSnapshotRef.current;
    const nextSnapshot = new Map<
      string,
      { status: FriendRequest['status']; senderId: string; receiverId: string; sender?: FriendRequest['sender']; receiver?: FriendRequest['receiver'] }
    >();

    friendRequests.forEach((request) => {
      nextSnapshot.set(String(request.id), {
        status: request.status,
        senderId: String(request.sender_id),
        receiverId: String(request.receiver_id),
        sender: request.sender,
        receiver: request.receiver,
      });
    });

    if (!friendRequestToastBootstrapRef.current) {
      friendRequestSnapshotRef.current = nextSnapshot;
      friendRequestToastBootstrapRef.current = true;
      return;
    }

    const currentTransitions = friendRequestToastTransitionsRef.current;
    const notifyTransition = (transitionKey: string, handler: () => void) => {
      if (currentTransitions.has(transitionKey)) return;
      currentTransitions.add(transitionKey);
      if (currentTransitions.size > 200) {
        const [first] = currentTransitions;
        if (first) currentTransitions.delete(first);
      }
      handler();
    };

    nextSnapshot.forEach((request, requestId) => {
      const previous = previousSnapshot.get(requestId);

      if (!previous && request.status === 'pending' && request.receiverId === userId) {
        const senderName = resolveUserDisplay(request.senderId, request.sender);
        notifyTransition(`${requestId}:none->pending:incoming`, () => {
          toast.info(`${senderName} sent you a friend request.`);
        });
        return;
      }

      if (!previous || previous.status === request.status) return;

      if (previous.status === 'pending' && request.status === 'accepted' && request.senderId === userId) {
        const receiverName = resolveUserDisplay(request.receiverId, request.receiver);
        notifyTransition(`${requestId}:pending->accepted:sender`, () => {
          toast.success(`${receiverName} accepted your friend request.`);
        });
        return;
      }

      if (previous.status === 'pending' && request.status === 'rejected' && request.senderId === userId) {
        const receiverName = resolveUserDisplay(request.receiverId, request.receiver);
        notifyTransition(`${requestId}:pending->rejected:sender`, () => {
          toast.info(`${receiverName} declined your friend request.`);
        });
      }
    });

    friendRequestSnapshotRef.current = nextSnapshot;
  }, [friendRequests, resolveUserDisplay, userId]);

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

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimisticCreatedAt = new Date().toISOString();
      const optimistic: MessageWithUser = {
        id: tempId,
        tempId,
        room_id: roomId,
        user_id: userId ?? 'me',
        content: trimmed,
        reply_to: replyTo,
        attachments,
        created_at: optimisticCreatedAt,
        status: 'pending',
        user: (userId && userDirectoryRef.current[String(userId)]) || undefined,
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
        mergeUsersIntoDirectory([saved.user]);
        logChatDebug('sendMessage:success', { roomId, messageId: saved.id, status: saved.status || 'unknown' });
        setMessages((prev) => {
          const list = prev[roomId] || [];
          const memberIds = getRoomMemberIds(roomId, roomsRef.current);
          const hydratedSaved = hydrateMessage(
            {
              ...saved,
              status: 'sent',
              user: saved.user || userDirectoryRef.current[String(saved.user_id)] || optimistic.user,
            },
            userIdRef.current,
            memberIds
          );
          const reconciled = reconcileIncomingMessage(list, hydratedSaved, userIdRef.current);
          return { ...prev, [roomId]: reconciled };
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
    [mergeUsersIntoDirectory, userId, withAuthHeaders]
  );


  const applyUpdatedMessage = useCallback((roomId: string, updatedMessage: MessageWithUser) => {
    const normalizedRoomId = toComparableId(roomId);
    setMessages((prev) => {
      const list = prev[normalizedRoomId] || [];
      const memberIds = getRoomMemberIds(normalizedRoomId, roomsRef.current);
      const hydrated = hydrateMessage(
        {
          ...updatedMessage,
          room_id: normalizedRoomId,
          user: updatedMessage.user || userDirectoryRef.current[String(updatedMessage.user_id)] || undefined,
        },
        userIdRef.current,
        memberIds
      );
      const messageIndex = list.findIndex((item) => toComparableId(item.id) === toComparableId(hydrated.id));
      if (messageIndex < 0) return prev;
      const next = [...list];
      next[messageIndex] = { ...next[messageIndex], ...hydrated };
      return { ...prev, [normalizedRoomId]: next };
    });

    setRooms((prev) =>
      prev.map((room) => {
        if (toComparableId(room.id) !== normalizedRoomId) return room;
        if (!room.lastMessage || toComparableId(room.lastMessage.id) !== toComparableId(updatedMessage.id)) return room;
        return { ...room, lastMessage: { ...room.lastMessage, ...updatedMessage } };
      })
    );
  }, []);

  const editMessage = useCallback(
    async (roomId: string, messageId: string, content: string) => {
      const trimmed = content.trim();
      if (!trimmed) throw new Error('Message content cannot be empty.');

      const response = await fetch(
        `${CHAT_API_URL}/api/rooms/${roomId}/messages/${messageId}`,
        await withAuthHeaders({
          method: 'PATCH',
          headers: { Accept: 'application/json' },
          body: JSON.stringify({ content: trimmed }),
        })
      );

      const json = (await response.json().catch(() => null)) as MessageWithUser | { error?: string } | null;
      if (!response.ok || !json || Array.isArray(json) || !('id' in json)) {
        throw new Error((json && 'error' in json && json.error) || 'Failed to edit message');
      }

      applyUpdatedMessage(roomId, json);
    },
    [applyUpdatedMessage, withAuthHeaders]
  );

  const deleteMessage = useCallback(
    async (roomId: string, messageId: string) => {
      const response = await fetch(
        `${CHAT_API_URL}/api/rooms/${roomId}/messages/${messageId}`,
        await withAuthHeaders({
          method: 'DELETE',
          headers: { Accept: 'application/json' },
        })
      );

      const json = (await response.json().catch(() => null)) as MessageWithUser | { error?: string } | null;
      if (!response.ok || !json || Array.isArray(json) || !('id' in json)) {
        throw new Error((json && 'error' in json && json.error) || 'Failed to delete message');
      }

      applyUpdatedMessage(roomId, json);
    },
    [applyUpdatedMessage, withAuthHeaders]
  );

  const deleteMessagesForMe = useCallback(
    async (roomId: string, messageIds: string[]) => {
      const normalizedRoomId = toComparableId(roomId);
      const normalizedUserId = toComparableId(userId);
      const uniqueMessageIds = Array.from(new Set(messageIds.map((id) => toComparableId(id)).filter(Boolean)));
      if (!normalizedUserId || uniqueMessageIds.length === 0) return;

      const payload = uniqueMessageIds.map((messageId) => ({
        room_id: normalizedRoomId,
        message_id: messageId,
        user_id: normalizedUserId,
      }));

      console.debug('[ChatContext] deleteMessagesForMe:start', {
        roomId: normalizedRoomId,
        messageIds: uniqueMessageIds,
        payload,
      });

      const { error } = await supabase
        .from('message_hidden_for_users')
        .upsert(payload, { onConflict: 'room_id,message_id,user_id', ignoreDuplicates: true });

      if (error) {
        console.error('[ChatContext] deleteMessagesForMe:error', {
          roomId: normalizedRoomId,
          messageIds: uniqueMessageIds,
          payload,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw new Error(error.message || 'Failed to delete messages for you');
      }

      const roomHiddenIds = new Set(hiddenMessageIdsByRoomRef.current[normalizedRoomId] || []);
      uniqueMessageIds.forEach((messageId) => roomHiddenIds.add(messageId));
      hiddenMessageIdsByRoomRef.current[normalizedRoomId] = roomHiddenIds;

      const currentRoomMessages = messagesRef.current[normalizedRoomId] || [];
      const nextRoomMessages = currentRoomMessages.filter((message) => !roomHiddenIds.has(toComparableId(message.id)));
      messagesRef.current = {
        ...messagesRef.current,
        [normalizedRoomId]: nextRoomMessages,
      };
      setMessages((prev) => ({
        ...prev,
        [normalizedRoomId]: (prev[normalizedRoomId] || []).filter((message) => !roomHiddenIds.has(toComparableId(message.id))),
      }));

      const fallbackLastMessage = getVisibleLastMessageForRoom(normalizedRoomId, nextRoomMessages);
      setRooms((prev) =>
        prev.map((room) => {
          if (toComparableId(room.id) !== normalizedRoomId) return room;
          if (room.lastMessage && !roomHiddenIds.has(toComparableId(room.lastMessage.id))) {
            return room;
          }
          return {
            ...room,
            lastMessage: fallbackLastMessage,
          };
        })
      );

      console.debug('[ChatContext] deleteMessagesForMe:success', {
        roomId: normalizedRoomId,
        messageIds: uniqueMessageIds,
        hiddenCount: roomHiddenIds.size,
        remainingVisibleCount: nextRoomMessages.length,
        fallbackLastMessageId: fallbackLastMessage?.id ?? null,
      });
    },
    [getVisibleLastMessageForRoom, userId]
  );

  const activeRoomMessages = activeRoom?.id ? messages[activeRoom.id] || [] : [];

  useEffect(() => {
    if (!activeRoom?.id || !userId) return;
    const roomId = activeRoom.id;
    if (activeRoomMessages.length === 0) return;

    scheduleReceiptsForMessages(roomId, activeRoomMessages, false);
    if (typeof document !== 'undefined' && document.visibilityState !== 'hidden') {
      scheduleReceiptsForMessages(roomId, activeRoomMessages, true);
    }
  }, [activeRoom?.id, activeRoomMessages, scheduleReceiptsForMessages, userId]);

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
          mergeUsersIntoDirectory([next.user]);
          const roomMemberIds = getRoomMemberIds(roomId, roomsRef.current);
          const hydrated = hydrateMessage(
            {
              ...next,
              room_id: roomId,
              user: next.user || userDirectoryRef.current[String(next.user_id)] || undefined,
            },
            userIdRef.current,
            roomMemberIds
          );
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
  }, [activeRoom?.id, mergeUsersIntoDirectory]);

  useEffect(() => {
    userDirectoryRef.current = userDirectory;
  }, [userDirectory]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const clearActiveRoomWhenVisible = () => {
      if (document.visibilityState === 'hidden') return;
      const activeRoomId = activeRoomIdRef.current;
      if (!activeRoomId) return;
      if ((unreadByRoomRef.current[activeRoomId] || 0) > 0) {
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
    const activeRoomId = activeRoom?.id;
    if (!activeRoomId || !isRoomActivelyRead(activeRoomId)) return;
    if ((unreadByRoom[activeRoomId] || 0) === 0) return;
    setRoomUnreadCount(activeRoomId, 0);
  }, [activeRoom?.id, isRoomActivelyRead, setRoomUnreadCount, unreadByRoom]);


  useEffect(() => {
    if (!userId || typeof document === 'undefined') return;

    const refreshOnResume = async () => {
      if (document.visibilityState === 'hidden' || visibilityRefreshInFlightRef.current) return;
      visibilityRefreshInFlightRef.current = true;
      try {
        const refreshedRooms = await refreshRoomsRef.current();
        await refreshFriendRequestsRef.current();

        const activeRoomId = activeRoomIdRef.current;
        if (activeRoomId && refreshedRooms.some((room) => room.id === activeRoomId)) {
          await refreshRoomMessagesRef.current(activeRoomId);
        }
      } finally {
        visibilityRefreshInFlightRef.current = false;
      }
    };

    const onVisible = () => {
      void refreshOnResume();
    };

    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId]);

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
      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as
          | { error?: string; devError?: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } }
          | null;
        const errorMessage = json?.error || 'Unable to create group chat right now.';
        const devError = json?.devError;
        const devErrorSummary = devError
          ? [devError.code, devError.message, devError.details, devError.hint].filter(Boolean).join(' | ')
          : null;
        console.error('[ChatContext] failed to create group room', {
          status: response.status,
          statusText: response.statusText,
          errorMessage,
          devError,
        });
        toast.error(isDevelopment && devErrorSummary ? `${errorMessage}: ${devErrorSummary}` : errorMessage);
        return null;
      }
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
        await refreshFriendRequests();
        return created;
      } catch (error) {
        console.error('[ChatContext] friend request threw', error);
        return null;
      }
    },
    [refreshFriendRequests, userId, withAuthHeaders]
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
        await refreshFriendRequests();

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
    [friendRequests, refreshFriendRequests, refreshRooms, selectRoom, userId, withAuthHeaders]
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

        await refreshFriendRequests();
      } catch (error) {
        console.error('[ChatContext] respondToFriendRequest threw', error);
      }
    },
    [refreshFriendRequests, userId, withAuthHeaders]
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
      rooms: roomsWithUnreadState,
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
      editMessage,
      deleteMessage,
      deleteMessagesForMe,
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
      roomsWithUnreadState,
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
      editMessage,
      deleteMessage,
      deleteMessagesForMe,
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
