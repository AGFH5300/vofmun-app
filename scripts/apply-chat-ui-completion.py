from pathlib import Path
import re


def replace_once(path: str, old: str, new: str):
    file_path = Path(path)
    source = file_path.read_text()
    if old not in source:
        raise SystemExit(f'Expected pattern missing in {path}: {old[:180]!r}')
    file_path.write_text(source.replace(old, new, 1))


# Extend room view state for local conversation preferences.
types_path = Path('lib/chat/types.ts')
types = types_path.read_text()
old_room_type = """export interface RoomWithDetails extends ChatRoom {
  members: RoomMember[];
  lastMessage?: MessageWithUser | null;
  isPinned?: boolean;
  unreadCount?: number;
}
"""
new_room_type = """export interface RoomWithDetails extends ChatRoom {
  members: RoomMember[];
  lastMessage?: MessageWithUser | null;
  isPinned?: boolean;
  isArchived?: boolean;
  isMuted?: boolean;
  unreadCount?: number;
}
"""
if old_room_type not in types:
    raise SystemExit('RoomWithDetails block missing')
types_path.write_text(types.replace(old_room_type, new_room_type, 1))


# Add persisted archive/mute/manual-unread actions to the central chat context.
context_path = Path('app/messages/context/ChatContext.tsx')
context = context_path.read_text()
context = context.replace(
    "  pinnedRoomIds: Set<string>;\n  totalUnreadCount: number;\n",
    "  pinnedRoomIds: Set<string>;\n  archivedRoomIds: Set<string>;\n  mutedRoomIds: Set<string>;\n  totalUnreadCount: number;\n",
    1,
)
context = context.replace(
    "  togglePin: (roomId: string) => void;\n",
    "  togglePin: (roomId: string) => void;\n  toggleArchive: (roomId: string) => void;\n  toggleMute: (roomId: string) => void;\n  markRoomUnread: (roomId: string) => void;\n  markRoomRead: (roomId: string) => void;\n",
    1,
)
helper_marker = "const normalizeFriendRequestStatus = (status?: string | null) => (status === 'declined' ? 'rejected' : status || 'pending');\n"
helper_replacement = """const normalizeFriendRequestStatus = (status?: string | null) => (status === 'declined' ? 'rejected' : status || 'pending');

const readStoredRoomIdSet = (storageKey: string) => {
  if (typeof window === 'undefined') return new Set<string>();
  try {
    const stored = window.localStorage.getItem(storageKey);
    const parsed = stored ? JSON.parse(stored) : [];
    return new Set<string>(Array.isArray(parsed) ? parsed.map((value) => String(value)) : []);
  } catch {
    return new Set<string>();
  }
};
"""
if helper_marker not in context:
    raise SystemExit('Chat context helper insertion point missing')
context = context.replace(helper_marker, helper_replacement, 1)

old_pinned_state = """  const [pinnedRoomIds, setPinnedRoomIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set<string>();
    const stored = window.localStorage.getItem('pinnedRooms');
    return new Set(stored ? JSON.parse(stored) : []);
  });
  const [unreadByRoom, setUnreadByRoom] = useState<Record<string, number>>({});
"""
new_pinned_state = """  const [pinnedRoomIds, setPinnedRoomIds] = useState<Set<string>>(() => readStoredRoomIdSet('pinnedRooms'));
  const [archivedRoomIds, setArchivedRoomIds] = useState<Set<string>>(() => readStoredRoomIdSet('vofmun.messages.archivedRooms'));
  const [mutedRoomIds, setMutedRoomIds] = useState<Set<string>>(() => readStoredRoomIdSet('vofmun.messages.mutedRooms'));
  const [manualUnreadRoomIds, setManualUnreadRoomIds] = useState<Set<string>>(() => readStoredRoomIdSet('vofmun.messages.manualUnreadRooms'));
  const [unreadByRoom, setUnreadByRoom] = useState<Record<string, number>>({});
"""
if old_pinned_state not in context:
    raise SystemExit('Pinned-room state block missing')
context = context.replace(old_pinned_state, new_pinned_state, 1)

old_rooms_view = """  const roomsWithUnreadState = useMemo(
    () =>
      rooms.map((room) => {
        const normalizedRoomId = toComparableId(room.id);
        const canonicalUnreadCount = Math.max(0, Math.floor(unreadByRoom[normalizedRoomId] ?? room.unreadCount ?? 0));

        if (canonicalUnreadCount === (room.unreadCount || 0)) {
          return room;
        }

        return {
          ...room,
          unreadCount: canonicalUnreadCount,
        };
      }),
    [rooms, unreadByRoom]
  );
"""
new_rooms_view = """  const roomsWithUnreadState = useMemo(
    () =>
      rooms.map((room) => {
        const normalizedRoomId = toComparableId(room.id);
        const baseUnreadCount = Math.max(0, Math.floor(unreadByRoom[normalizedRoomId] ?? room.unreadCount ?? 0));
        const canonicalUnreadCount = manualUnreadRoomIds.has(normalizedRoomId)
          ? Math.max(1, baseUnreadCount)
          : baseUnreadCount;

        return {
          ...room,
          isPinned: pinnedRoomIds.has(normalizedRoomId),
          isArchived: archivedRoomIds.has(normalizedRoomId),
          isMuted: mutedRoomIds.has(normalizedRoomId),
          unreadCount: canonicalUnreadCount,
        };
      }),
    [archivedRoomIds, manualUnreadRoomIds, mutedRoomIds, pinnedRoomIds, rooms, unreadByRoom]
  );
"""
if old_rooms_view not in context:
    raise SystemExit('roomsWithUnreadState block missing')
context = context.replace(old_rooms_view, new_rooms_view, 1)

old_persist_effect = """  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('pinnedRooms', JSON.stringify(Array.from(pinnedRoomIds)));
    }
  }, [pinnedRoomIds]);
"""
new_persist_effect = """  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('pinnedRooms', JSON.stringify(Array.from(pinnedRoomIds)));
    }
  }, [pinnedRoomIds]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('vofmun.messages.archivedRooms', JSON.stringify(Array.from(archivedRoomIds)));
  }, [archivedRoomIds]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('vofmun.messages.mutedRooms', JSON.stringify(Array.from(mutedRoomIds)));
  }, [mutedRoomIds]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('vofmun.messages.manualUnreadRooms', JSON.stringify(Array.from(manualUnreadRoomIds)));
  }, [manualUnreadRoomIds]);
"""
if old_persist_effect not in context:
    raise SystemExit('Pinned-room persistence effect missing')
context = context.replace(old_persist_effect, new_persist_effect, 1)

# Selecting a room always clears a manual unread marker.
select_marker = """      setActiveRoom(roomsRef.current.find((candidate) => toComparableId(candidate.id) === normalizedRoomId) || { ...room, id: normalizedRoomId });
      setRoomUnreadCount(normalizedRoomId, 0);
"""
select_replacement = """      setActiveRoom(roomsRef.current.find((candidate) => toComparableId(candidate.id) === normalizedRoomId) || { ...room, id: normalizedRoomId });
      setManualUnreadRoomIds((previous) => {
        if (!previous.has(normalizedRoomId)) return previous;
        const next = new Set(previous);
        next.delete(normalizedRoomId);
        return next;
      });
      setRoomUnreadCount(normalizedRoomId, 0);
"""
if select_marker not in context:
    raise SystemExit('Foundation selectRoom unread marker missing')
context = context.replace(select_marker, select_replacement, 1)

old_toggle_pin = """  const togglePin = useCallback((roomId: string) => {
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
"""
new_toggle_actions = """  const togglePin = useCallback((roomId: string) => {
    const normalizedRoomId = toComparableId(roomId);
    setPinnedRoomIds((prev) => {
      const next = new Set(prev);
      if (next.has(normalizedRoomId)) {
        next.delete(normalizedRoomId);
      } else {
        next.add(normalizedRoomId);
      }
      return next;
    });
  }, []);

  const toggleArchive = useCallback((roomId: string) => {
    const normalizedRoomId = toComparableId(roomId);
    setArchivedRoomIds((previous) => {
      const next = new Set(previous);
      if (next.has(normalizedRoomId)) next.delete(normalizedRoomId);
      else next.add(normalizedRoomId);
      return next;
    });
  }, []);

  const toggleMute = useCallback((roomId: string) => {
    const normalizedRoomId = toComparableId(roomId);
    setMutedRoomIds((previous) => {
      const next = new Set(previous);
      if (next.has(normalizedRoomId)) next.delete(normalizedRoomId);
      else next.add(normalizedRoomId);
      return next;
    });
  }, []);

  const markRoomUnread = useCallback((roomId: string) => {
    const normalizedRoomId = toComparableId(roomId);
    setManualUnreadRoomIds((previous) => {
      if (previous.has(normalizedRoomId)) return previous;
      const next = new Set(previous);
      next.add(normalizedRoomId);
      return next;
    });
    setRoomUnreadCount(normalizedRoomId, Math.max(1, unreadByRoomRef.current[normalizedRoomId] || 0));
  }, [setRoomUnreadCount]);

  const markRoomRead = useCallback((roomId: string) => {
    const normalizedRoomId = toComparableId(roomId);
    setManualUnreadRoomIds((previous) => {
      if (!previous.has(normalizedRoomId)) return previous;
      const next = new Set(previous);
      next.delete(normalizedRoomId);
      return next;
    });
    setRoomUnreadCount(normalizedRoomId, 0);
    const roomMessages = messagesRef.current[normalizedRoomId] || [];
    if (roomMessages.length > 0) {
      scheduleReceiptsForMessages(normalizedRoomId, roomMessages, true);
    }
  }, [scheduleReceiptsForMessages, setRoomUnreadCount]);
"""
if old_toggle_pin not in context:
    raise SystemExit('togglePin block missing')
context = context.replace(old_toggle_pin, new_toggle_actions, 1)

context = context.replace(
    "      pinnedRoomIds,\n      totalUnreadCount,\n",
    "      pinnedRoomIds,\n      archivedRoomIds,\n      mutedRoomIds,\n      totalUnreadCount,\n",
    1,
)
context = context.replace(
    "      togglePin,\n      createDirectRoom,\n",
    "      togglePin,\n      toggleArchive,\n      toggleMute,\n      markRoomUnread,\n      markRoomRead,\n      createDirectRoom,\n",
    1,
)
context = context.replace(
    "      pinnedRoomIds,\n      totalUnreadCount,\n      selectRoom,\n",
    "      pinnedRoomIds,\n      archivedRoomIds,\n      mutedRoomIds,\n      totalUnreadCount,\n      selectRoom,\n",
    1,
)
context = context.replace(
    "      togglePin,\n      createDirectRoom,\n",
    "      togglePin,\n      toggleArchive,\n      toggleMute,\n      markRoomUnread,\n      markRoomRead,\n      createDirectRoom,\n",
    1,
)
context_path.write_text(context)


# Replace the conversation row with a complete MUN-appropriate context menu.
Path('app/messages/components/ConversationListItem.tsx').write_text("""// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React from 'react';
import { RoomWithDetails } from '@/lib/chat/types';
import { abbreviateDelegationLabel, getUserDelegationLabel } from '@/lib/chat/delegation';
import {
  Archive,
  ArchiveRestore,
  Bell,
  BellOff,
  Download,
  Eraser,
  ExternalLink,
  File,
  Info,
  Mail,
  MailOpen,
  Pin,
  PinOff,
  Users,
  UsersRound,
} from 'lucide-react';
import UserAvatar from './UserAvatar';

interface Props {
  room: RoomWithDetails;
  isActive: boolean;
  onSelect: (room: RoomWithDetails) => void;
  onTogglePin: (roomId: string) => void;
  onToggleArchive: (roomId: string) => void;
  onToggleMute: (roomId: string) => void;
  onMarkUnread: (roomId: string) => void;
  onMarkRead: (roomId: string) => void;
  onOpenInNewWindow: (room: RoomWithDetails) => void;
  onShowInfo: (room: RoomWithDetails) => void | Promise<void>;
  onExportChat: (room: RoomWithDetails) => void | Promise<void>;
  onClearChat: (room: RoomWithDetails) => void | Promise<void>;
  currentUserId?: string | null;
  onlineUsers: Set<string>;
}

const getDisplayMeta = (room: RoomWithDetails, currentUserId?: string | null) => {
  if (room.room_type === 'dm') {
    const me = room.members.find((member) =>
      String(member.user_id) === String(currentUserId || '') ||
      String(member.user?.id || '') === String(currentUserId || ''),
    );
    const otherMember =
      room.members.find((member) => String(member.user_id) !== String(me?.user_id || '')) ||
      room.members.find((member) => String(member.user_id) !== String(currentUserId || '')) ||
      room.members[0];
    const other = otherMember?.user;
    const delegation = getUserDelegationLabel(other);
    const delegationShort = abbreviateDelegationLabel(delegation);
    const resolvedRoleLabel = (other?.role_title || other?.role || 'Delegate').toString();
    const isDelegate = String(other?.role || '').toLowerCase() === 'delegate' || resolvedRoleLabel.toLowerCase() === 'delegate';
    const sub = isDelegate ? delegation || '' : delegation ? `${resolvedRoleLabel} · ${delegation}` : resolvedRoleLabel;

    return {
      name: other?.full_name || `${other?.first_name || ''} ${other?.last_name || ''}`.trim() || room.name,
      shortDelegation: delegationShort,
      sub,
    };
  }

  const memberCount = room.members.length;
  const label = room.room_type === 'committee' ? 'Committee room' : 'Group chat';
  return {
    name: room.name,
    shortDelegation: '',
    sub: `${label} · ${memberCount} member${memberCount === 1 ? '' : 's'}`,
  };
};

const ConversationListItem: React.FC<Props> = ({
  room,
  isActive,
  onSelect,
  onTogglePin,
  onToggleArchive,
  onToggleMute,
  onMarkUnread,
  onMarkRead,
  onOpenInNewWindow,
  onShowInfo,
  onExportChat,
  onClearChat,
  currentUserId,
  onlineUsers,
}) => {
  const [contextMenuPosition, setContextMenuPosition] = React.useState<{ x: number; y: number } | null>(null);
  const menuId = React.useMemo(() => `conversation-menu-${room.id}`, [room.id]);
  const meta = getDisplayMeta(room, currentUserId);
  const last = room.lastMessage;
  const unreadCount = Math.max(0, Math.floor(room.unreadCount || 0));
  const hasUnread = unreadCount > 0;
  const unreadBadgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);
  const dmPeer = room.room_type === 'dm'
    ? room.members.find((member) => String(member.user_id) !== String(currentUserId || ''))?.user || room.members[0]?.user
    : undefined;
  const hasOnlinePresence = room.room_type === 'dm' && room.members.some(
    (member) => String(member.user_id) !== String(currentUserId || '') && onlineUsers.has(String(member.user_id)),
  );
  const lastMessageText = last?.content?.trim() || '';
  const lastMessageAttachments = last?.attachments || [];
  const shouldShowAttachmentPreview = !lastMessageText && lastMessageAttachments.length > 0;
  const attachmentLabel = lastMessageAttachments.length === 1
    ? lastMessageAttachments[0]?.original_name || 'Attachment'
    : `${lastMessageAttachments.length} attachments`;

  React.useEffect(() => {
    if (!contextMenuPosition) return;
    const closeMenu = () => setContextMenuPosition(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };
    window.addEventListener('click', closeMenu);
    window.addEventListener('contextmenu', closeMenu);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('contextmenu', closeMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenuPosition]);

  React.useEffect(() => {
    const handleAnotherMenuOpen = (event: Event) => {
      const customEvent = event as CustomEvent<{ id?: string }>;
      if (customEvent.detail?.id !== menuId) setContextMenuPosition(null);
    };
    window.addEventListener('vofmun-conversation-menu-opened', handleAnotherMenuOpen);
    return () => window.removeEventListener('vofmun-conversation-menu-opened', handleAnotherMenuOpen);
  }, [menuId]);

  const runMenuAction = (action: () => void | Promise<void>) => {
    setContextMenuPosition(null);
    void action();
  };

  const menuButtonClass = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-[#1a1c1c] transition hover:bg-warm-light-grey';

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onMouseDown={(event) => {
          if (event.button === 0) event.preventDefault();
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          window.dispatchEvent(new CustomEvent('vofmun-conversation-menu-opened', { detail: { id: menuId } }));
          const menuWidth = 246;
          const menuHeight = 378;
          setContextMenuPosition({
            x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
            y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
          });
        }}
        onClick={() => onSelect(room)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect(room);
          }
        }}
        className={`group w-full cursor-pointer px-2 py-1.5 text-left transition focus:outline-none ${
          isActive
            ? 'rounded-xl border-l-[3px] border-[#6E1D1B] bg-[#e8e8e8]'
            : 'rounded-xl bg-transparent hover:bg-[#ecebeb]'
        }`}
      >
        <div className="flex items-start gap-2.5">
          {room.room_type === 'dm' ? (
            <div className="relative shrink-0 pt-0.5">
              <UserAvatar user={dmPeer} size={40} />
              {hasOnlinePresence ? <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500" /> : null}
            </div>
          ) : (
            <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-soft-ivory text-deep-red">
              {room.room_type === 'committee' ? <Users className="h-4 w-4" /> : <UsersRound className="h-4 w-4" />}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className={`truncate text-[13px] leading-5 ${isActive ? 'text-[#6E1D1B]' : 'text-[#1a1c1c]'} ${hasUnread ? 'font-bold' : 'font-semibold'}`}>{meta.name}</p>
                  {room.isMuted ? <BellOff className="h-3 w-3 shrink-0 text-[#1a1c1c]/45" aria-label="Muted" /> : null}
                </div>
                {meta.shortDelegation ? <p className="truncate text-[11px] font-medium leading-4 text-[#1a1c1c]/65">({meta.shortDelegation})</p> : null}
              </div>
              <div className="ml-2 flex shrink-0 flex-col items-end gap-1.5">
                {last?.created_at ? (
                  <span className={`text-[0.7rem] ${hasUnread ? 'font-semibold text-deep-red' : 'text-[#1a1c1c]/50'}`}>
                    {new Date(last.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : null}
                {hasUnread ? (
                  <span aria-label={`${unreadCount} unread message${unreadCount === 1 ? '' : 's'}`} className="inline-flex min-w-[1.2rem] items-center justify-center rounded-full background-deep-red px-1 py-0.5 text-[10px] font-bold leading-none text-white">
                    {unreadBadgeLabel}
                  </span>
                ) : null}
              </div>
            </div>
            {last ? (
              shouldShowAttachmentPreview ? (
                <p className={`mt-0.5 inline-flex max-w-full items-center gap-1.5 line-clamp-1 text-[11px] ${hasUnread ? 'font-semibold text-[#1a1c1c]' : 'text-[#1a1c1c]/70'}`}>
                  <File className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{attachmentLabel}</span>
                </p>
              ) : (
                <p className={`mt-0.5 line-clamp-1 text-[11px] ${hasUnread ? 'font-semibold text-[#1a1c1c]' : 'text-[#1a1c1c]/70'}`}>
                  {`${room.room_type === 'dm' ? '' : last.user?.full_name ? `${last.user.full_name}: ` : ''}${lastMessageText}`}
                </p>
              )
            ) : <p className="mt-1 line-clamp-1 text-xs text-[#1a1c1c]/70">No messages yet</p>}
          </div>
        </div>
      </div>

      {contextMenuPosition ? (
        <div
          role="menu"
          className="fixed z-50 w-[238px] overflow-hidden rounded-xl border border-black/10 bg-white p-1.5 shadow-[0_14px_40px_rgba(17,27,33,0.22)]"
          style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" className={menuButtonClass} onClick={() => runMenuAction(() => onOpenInNewWindow(room))}>
            <ExternalLink className="h-4 w-4" /><span>Open in new window</span>
          </button>
          <button type="button" className={menuButtonClass} onClick={() => runMenuAction(() => hasUnread ? onMarkRead(room.id) : onMarkUnread(room.id))}>
            {hasUnread ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
            <span>{hasUnread ? 'Mark as read' : 'Mark as unread'}</span>
          </button>
          <button type="button" className={menuButtonClass} onClick={() => runMenuAction(() => onToggleArchive(room.id))}>
            {room.isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            <span>{room.isArchived ? 'Unarchive' : 'Archive'}</span>
          </button>
          <button type="button" className={menuButtonClass} onClick={() => runMenuAction(() => onTogglePin(room.id))}>
            {room.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            <span>{room.isPinned ? 'Unpin' : 'Pin'}</span>
          </button>
          <button type="button" className={menuButtonClass} onClick={() => runMenuAction(() => onToggleMute(room.id))}>
            {room.isMuted ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            <span>{room.isMuted ? 'Unmute' : 'Mute'}</span>
          </button>
          <div className="my-1 border-t border-black/10" />
          <button type="button" className={menuButtonClass} onClick={() => runMenuAction(() => onShowInfo(room))}>
            <Info className="h-4 w-4" /><span>Conversation info</span>
          </button>
          <button type="button" className={menuButtonClass} onClick={() => runMenuAction(() => onExportChat(room))}>
            <Download className="h-4 w-4" /><span>Export conversation</span>
          </button>
          <button type="button" className={`${menuButtonClass} text-red-700 hover:bg-red-50`} onClick={() => runMenuAction(() => onClearChat(room))}>
            <Eraser className="h-4 w-4" /><span>Clear conversation</span>
          </button>
        </div>
      ) : null}
    </li>
  );
};

export default ConversationListItem;
""")


Path('app/messages/components/ConversationList.tsx').write_text("""// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React, { useMemo } from 'react';
import { RoomWithDetails } from '@/lib/chat/types';
import ConversationListItem from './ConversationListItem';
import { Archive, MessageCircle } from 'lucide-react';

interface Props {
  rooms: RoomWithDetails[];
  activeRoomId?: string;
  onSelect: (room: RoomWithDetails) => void;
  onTogglePin: (roomId: string) => void;
  onToggleArchive: (roomId: string) => void;
  onToggleMute: (roomId: string) => void;
  onMarkUnread: (roomId: string) => void;
  onMarkRead: (roomId: string) => void;
  onOpenInNewWindow: (room: RoomWithDetails) => void;
  onShowInfo: (room: RoomWithDetails) => void | Promise<void>;
  onExportChat: (room: RoomWithDetails) => void | Promise<void>;
  onClearChat: (room: RoomWithDetails) => void | Promise<void>;
  currentUserId?: string | null;
  onlineUsers: Set<string>;
  onNewChat: () => void;
  onNewGroup: () => void;
}

const sortRooms = (list: RoomWithDetails[]) => [...list].sort((a, b) => {
  if (Boolean(a.isPinned) !== Boolean(b.isPinned)) return a.isPinned ? -1 : 1;
  const aTime = a.lastMessage?.created_at ? new Date(a.lastMessage.created_at).getTime() : 0;
  const bTime = b.lastMessage?.created_at ? new Date(b.lastMessage.created_at).getTime() : 0;
  return bTime - aTime;
});

const ConversationList: React.FC<Props> = (props) => {
  const {
    rooms,
    activeRoomId,
    onSelect,
    onTogglePin,
    onToggleArchive,
    onToggleMute,
    onMarkUnread,
    onMarkRead,
    onOpenInNewWindow,
    onShowInfo,
    onExportChat,
    onClearChat,
    currentUserId,
    onlineUsers,
    onNewChat,
    onNewGroup,
  } = props;

  const { channelRooms, privateRooms, archivedRooms } = useMemo(() => {
    const visibleRooms = sortRooms(rooms.filter((room) => !room.isArchived));
    return {
      channelRooms: visibleRooms.filter((room) => room.room_type !== 'dm'),
      privateRooms: visibleRooms.filter((room) => room.room_type === 'dm'),
      archivedRooms: sortRooms(rooms.filter((room) => room.isArchived)),
    };
  }, [rooms]);

  const renderRoom = (room: RoomWithDetails) => (
    <ConversationListItem
      key={room.id}
      room={room}
      isActive={room.id === activeRoomId}
      onSelect={onSelect}
      onTogglePin={onTogglePin}
      onToggleArchive={onToggleArchive}
      onToggleMute={onToggleMute}
      onMarkUnread={onMarkUnread}
      onMarkRead={onMarkRead}
      onOpenInNewWindow={onOpenInNewWindow}
      onShowInfo={onShowInfo}
      onExportChat={onExportChat}
      onClearChat={onClearChat}
      currentUserId={currentUserId}
      onlineUsers={onlineUsers}
    />
  );

  const hasAnyRooms = rooms.length > 0;

  return (
    <div className="h-full">
      <div className="pb-3">
        {hasAnyRooms ? (
          <div className="space-y-5">
            {channelRooms.length > 0 ? (
              <div>
                <p className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Channels</p>
                <ul className="space-y-1">{channelRooms.map(renderRoom)}</ul>
              </div>
            ) : null}
            {privateRooms.length > 0 ? (
              <div>
                <p className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Private Messages</p>
                <ul className="space-y-1">{privateRooms.map(renderRoom)}</ul>
              </div>
            ) : null}
            {archivedRooms.length > 0 ? (
              <div>
                <p className="mb-3 flex items-center gap-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
                  <Archive className="h-3 w-3" /> Archived
                </p>
                <ul className="space-y-1">{archivedRooms.map(renderRoom)}</ul>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center justify-center gap-2.5 rounded-xl border border-[#dcc0bd]/20 bg-white px-4 py-6 text-center">
            <MessageCircle className="text-deep-red/50" size={42} />
            <p className="text-sm font-semibold text-[#6E1D1B]">You don’t have any conversations yet</p>
            <div className="flex gap-2">
              <button type="button" onClick={onNewChat} className="rounded-lg bg-[#6E1D1B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#500608]">Start a conversation</button>
              <button type="button" onClick={onNewGroup} className="rounded-lg bg-[#6E1D1B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#500608]">Start a group</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationList;
""")


# Route message editing through the bottom composer while retaining the old fallback implementation.
bubble_path = Path('app/messages/components/MessageBubble.tsx')
bubble = bubble_path.read_text()
bubble = bubble.replace(
    "  onEditMessage?: (messageId: string, content: string) => Promise<void>;\n",
    "  onEditMessage?: (messageId: string, content: string) => Promise<void>;\n  onRequestEditMessage?: (message: MessageWithUser) => void;\n",
    1,
)
# Add the new prop to component destructuring immediately after the legacy prop.
bubble = bubble.replace(
    "  onEditMessage,\n  onReplyMessage,\n",
    "  onEditMessage,\n  onRequestEditMessage,\n  onReplyMessage,\n",
    1,
)
old_edit_click = """                          setEditingText(message.content || '');
                          setIsEditing(true);
                          closeContextMenu();
"""
new_edit_click = """                          if (onRequestEditMessage) {
                            onRequestEditMessage(message);
                          } else {
                            setEditingText(message.content || '');
                            setIsEditing(true);
                          }
                          closeContextMenu();
"""
if old_edit_click not in bubble:
    raise SystemExit('MessageBubble edit menu handler missing')
bubble_path.write_text(bubble.replace(old_edit_click, new_edit_click, 1))


# Add composer editing, conversation actions and draft restoration to the messages page.
page_path = Path('app/messages/page.tsx')
page = page_path.read_text()
page = page.replace(
    "  Loader2,\n  MoreVertical,\n",
    "  Loader2,\n  MoreVertical,\n  Pencil,\n  Check,\n",
    1,
)
page = page.replace(
    "type ActiveUnreadDividerSession = {\n",
    """type EditingMessageState = {
  roomId: string;
  messageId: string;
  originalContent: string;
};

type ComposerEditSnapshot = {
  roomId: string;
  composer: string;
  replyingToMessageId: string | null;
  pendingAttachments: PendingAttachmentItem[];
};

type ActiveUnreadDividerSession = {
""",
    1,
)
page = page.replace(
    "    togglePin,\n    currentUserId,\n",
    "    togglePin,\n    toggleArchive,\n    toggleMute,\n    markRoomUnread,\n    markRoomRead,\n    currentUserId,\n",
    1,
)
page = page.replace(
    "  const [replyingToMessageId, setReplyingToMessageId] = useState<string | null>(null);\n",
    """  const [replyingToMessageId, setReplyingToMessageId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<EditingMessageState | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const editComposerSnapshotRef = useRef<ComposerEditSnapshot | null>(null);
  const deepLinkedRoomHandledRef = useRef(false);
""",
    1,
)

# Archived rooms should never become the automatic desktop default.
page = page.replace(
    "    const pinned = filteredRooms.filter((room) => room.isPinned).sort(byLatestMessage);\n    const unpinned = filteredRooms.filter((room) => !room.isPinned).sort(byLatestMessage);\n",
    "    const selectableRooms = filteredRooms.filter((room) => !room.isArchived);\n    const pinned = selectableRooms.filter((room) => room.isPinned).sort(byLatestMessage);\n    const unpinned = selectableRooms.filter((room) => !room.isPinned).sort(byLatestMessage);\n",
    1,
)

# Do not overwrite the preserved draft with the temporary edit text.
page = page.replace(
    "    const nextDraft = draftsByRoom[roomId] || \"\";\n",
    "    if (editingMessage?.roomId === roomId) return;\n\n    const nextDraft = draftsByRoom[roomId] || \"\";\n",
    1,
)
page = page.replace(
    "  }, [activeRoom?.id, draftsByRoom]);\n\n  useEffect(() => {\n    const roomId = String(activeRoom?.id || \"\");\n    if (!roomId) return;\n\n    composerRoomSnapshotRef.current = { roomId, draft: composer };\n",
    "  }, [activeRoom?.id, draftsByRoom, editingMessage?.roomId]);\n\n  useEffect(() => {\n    const roomId = String(activeRoom?.id || \"\");\n    if (!roomId || editingMessage?.roomId === roomId) return;\n\n    composerRoomSnapshotRef.current = { roomId, draft: composer };\n",
    1,
)
page = page.replace(
    "  }, [activeRoom?.id, composer]);\n",
    "  }, [activeRoom?.id, composer, editingMessage?.roomId]);\n",
    1,
)

edit_helpers_marker = """  const handleSend = async () => {
    const roomId = activeRoom?.id ? String(activeRoom.id) : null;
"""
edit_helpers_replacement = """  const restoreComposerAfterEdit = () => {
    const snapshot = editComposerSnapshotRef.current;
    editComposerSnapshotRef.current = null;
    setEditingMessage(null);
    setIsSavingEdit(false);

    if (!snapshot) return;
    setDraftsByRoom((previous) => ({ ...previous, [snapshot.roomId]: snapshot.composer }));
    if (String(activeRoom?.id || '') === snapshot.roomId) {
      setComposer(snapshot.composer);
      setReplyingToMessageId(snapshot.replyingToMessageId);
      setPendingAttachments(snapshot.pendingAttachments);
      pendingAttachmentRoomIdRef.current = snapshot.pendingAttachments.length > 0 ? snapshot.roomId : null;
      window.requestAnimationFrame(() => focusComposerWithoutScroll());
    }
  };

  const cancelEditingMessage = () => {
    restoreComposerAfterEdit();
  };

  const beginEditingMessage = (message: MessageWithUser) => {
    const roomId = activeRoom?.id ? String(activeRoom.id) : '';
    if (!roomId || message.deleted_at) return;

    editComposerSnapshotRef.current = {
      roomId,
      composer,
      replyingToMessageId,
      pendingAttachments,
    };
    setEditingMessage({
      roomId,
      messageId: String(message.id),
      originalContent: message.content || '',
    });
    setComposer(message.content || '');
    setReplyingToMessageId(null);
    setPendingAttachments([]);
    setAttachmentUploadError(null);
    setShowAttachmentMenu(false);
    closeEmojiModal();
    sendTyping(roomId, false);
    window.requestAnimationFrame(() => focusComposerWithoutScroll());
  };

  const handleSend = async () => {
    const roomId = activeRoom?.id ? String(activeRoom.id) : null;
"""
if edit_helpers_marker not in page:
    raise SystemExit('handleSend insertion point missing')
page = page.replace(edit_helpers_marker, edit_helpers_replacement, 1)

send_guard = """    if (!roomId || (trimmedComposer.length === 0 && uploadedAttachments.length === 0) || isUploadingAttachments) return;

    const previousComposer = composer;
"""
send_edit_branch = """    if (editingMessage) {
      if (!roomId || roomId !== editingMessage.roomId || isSavingEdit || trimmedComposer.length === 0) return;
      if (trimmedComposer === editingMessage.originalContent.trim()) {
        restoreComposerAfterEdit();
        return;
      }

      setIsSavingEdit(true);
      sendTyping(roomId, false);
      try {
        await editMessage(roomId, editingMessage.messageId, trimmedComposer);
        toast.success('Message updated');
        restoreComposerAfterEdit();
      } catch (error) {
        setIsSavingEdit(false);
        toast.error(error instanceof Error ? error.message : 'Failed to edit message');
      }
      return;
    }

    if (!roomId || (trimmedComposer.length === 0 && uploadedAttachments.length === 0) || isUploadingAttachments) return;

    const previousComposer = composer;
"""
if send_guard not in page:
    raise SystemExit('handleSend guard missing')
page = page.replace(send_guard, send_edit_branch, 1)

# Cancel the edit safely before switching rooms and restore the old room's draft.
page = page.replace(
    "  const handleSelectRoom = async (room: RoomWithDetails) => {\n    setShowAttachmentMenu(false);\n",
    "  const handleSelectRoom = async (room: RoomWithDetails) => {\n    if (editingMessage) cancelEditingMessage();\n    setShowAttachmentMenu(false);\n",
    1,
)

# Add deep links and context-menu actions after handleSelectRoom.
room_action_marker = """    window.requestAnimationFrame(() => {
      focusComposerWithoutScroll();
    });
  };

  useEffect(() => {
    if (!initialChatReady || activeRoom || orderedRoomsForDefaultSelection.length === 0) return;
"""
room_action_replacement = """    window.requestAnimationFrame(() => {
      focusComposerWithoutScroll();
    });
  };

  const openConversationInNewWindow = (room: RoomWithDetails) => {
    const url = new URL('/messages', window.location.origin);
    url.searchParams.set('room', String(room.id));
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  };

  const showConversationInfo = async (room: RoomWithDetails) => {
    await handleSelectRoom(room);
    setShowDetails(true);
  };

  const exportConversation = (room: RoomWithDetails) => {
    const roomMessages = (messages[String(room.id)] || []).filter((message) => !message.deleted_at);
    const lines = roomMessages.map((message) => {
      const senderName = message.user?.full_name || `${message.user?.first_name || ''} ${message.user?.last_name || ''}`.trim() || 'Participant';
      return `[${formatTranscriptTimestamp(message.created_at)}] ${senderName}: ${getMessageTextForTranscript(message)}`;
    });
    const blob = new Blob([lines.join('\\n') || 'No visible messages.'], { type: 'text/plain;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `${(room.name || 'conversation').replace(/[^a-z0-9_-]+/gi, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  };

  const clearConversation = async (room: RoomWithDetails) => {
    const roomMessages = messages[String(room.id)] || [];
    const messageIds = roomMessages.map((message) => String(message.id)).filter(Boolean);
    if (messageIds.length === 0) {
      toast.info('This conversation is already clear.');
      return;
    }
    const confirmed = window.confirm('Clear all visible messages in this conversation for you? This does not delete them for other participants.');
    if (!confirmed) return;
    try {
      await deleteMessagesForMe(String(room.id), messageIds);
      toast.success('Conversation cleared for you');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to clear conversation');
    }
  };

  useEffect(() => {
    if (!initialChatReady || deepLinkedRoomHandledRef.current || typeof window === 'undefined') return;
    const requestedRoomId = new URLSearchParams(window.location.search).get('room');
    if (!requestedRoomId) {
      deepLinkedRoomHandledRef.current = true;
      return;
    }
    const requestedRoom = rooms.find((room) => String(room.id) === requestedRoomId);
    if (!requestedRoom) return;
    deepLinkedRoomHandledRef.current = true;
    void handleSelectRoom(requestedRoom);
  }, [initialChatReady, rooms]);

  useEffect(() => {
    if (!initialChatReady || activeRoom || orderedRoomsForDefaultSelection.length === 0) return;
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('room')) return;
"""
if room_action_marker not in page:
    raise SystemExit('Room action insertion marker missing')
page = page.replace(room_action_marker, room_action_replacement, 1)

# Composer enablement and message-bubble edit callback.
old_can_send = """  const hasUploadedPendingAttachments = pendingAttachments.some((item) => item.status === \"uploaded\");
  const canSendMessage = !isAnySelectionModeActive && (composer.trim().length > 0 || hasUploadedPendingAttachments) && !isUploadingAttachments;
"""
new_can_send = """  const hasUploadedPendingAttachments = pendingAttachments.some((item) => item.status === \"uploaded\");
  const canSendMessage = editingMessage
    ? !isAnySelectionModeActive && !isSavingEdit && composer.trim().length > 0 && composer.trim() !== editingMessage.originalContent.trim()
    : !isAnySelectionModeActive && (composer.trim().length > 0 || hasUploadedPendingAttachments) && !isUploadingAttachments;
"""
if old_can_send not in page:
    raise SystemExit('canSendMessage block missing')
page = page.replace(old_can_send, new_can_send, 1)
page = page.replace(
    "onEditMessage={(messageId, content) => editMessage(activeRoom.id, messageId, content)}",
    "onRequestEditMessage={beginEditingMessage}",
    1,
)

# Wire the expanded conversation menu.
conversation_props_marker = """                onSelect={handleSelectRoom}
                onTogglePin={togglePin}
                currentUserId={currentUserId}
"""
conversation_props_replacement = """                onSelect={handleSelectRoom}
                onTogglePin={togglePin}
                onToggleArchive={toggleArchive}
                onToggleMute={toggleMute}
                onMarkUnread={markRoomUnread}
                onMarkRead={markRoomRead}
                onOpenInNewWindow={openConversationInNewWindow}
                onShowInfo={showConversationInfo}
                onExportChat={exportConversation}
                onClearChat={clearConversation}
                currentUserId={currentUserId}
"""
if conversation_props_marker not in page:
    raise SystemExit('ConversationList props marker missing')
page = page.replace(conversation_props_marker, conversation_props_replacement, 1)

# Insert the visible edit banner above reply state.
reply_banner_marker = """                  <div className=\"space-y-2\">
                    {replyingToMessage ? (
"""
edit_banner = """                  <div className=\"space-y-2\">
                    {editingMessage ? (
                      <div className=\"flex items-center justify-between gap-3 rounded-xl border border-[#6E1D1B]/25 bg-[#fff7f4] px-3 py-2 shadow-sm\">
                        <div className=\"flex min-w-0 items-center gap-2\">
                          <span className=\"inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6E1D1B]/10 text-[#6E1D1B]\">
                            <Pencil className=\"h-4 w-4\" />
                          </span>
                          <div className=\"min-w-0\">
                            <p className=\"text-xs font-semibold text-[#6E1D1B]\">Editing message</p>
                            <p className=\"truncate text-xs text-almost-black-green/65\">Your previous draft will return after saving or cancelling.</p>
                          </div>
                        </div>
                        <button type=\"button\" onClick={cancelEditingMessage} className=\"rounded-lg border border-[#6E1D1B]/20 bg-white p-1.5 text-[#6E1D1B] hover:bg-[#6E1D1B]/5\" aria-label=\"Cancel message edit\">
                          <X className=\"h-4 w-4\" />
                        </button>
                      </div>
                    ) : null}
                    {replyingToMessage ? (
"""
if reply_banner_marker not in page:
    raise SystemExit('Composer edit banner marker missing')
page = page.replace(reply_banner_marker, edit_banner, 1)

# Disable non-text composer tools while editing and add Escape cancellation.
page = page.replace(
    "                        disabled={isUploadingAttachments}\n",
    "                        disabled={isUploadingAttachments || Boolean(editingMessage)}\n",
    1,
)
page = page.replace(
    "                    {emojiSuggestions.length > 0 && (\n",
    "                    {!editingMessage && emojiSuggestions.length > 0 && (\n",
    1,
)
page = page.replace(
    "                          sendTyping(activeRoom.id, true);\n",
    "                          if (!editingMessage) sendTyping(activeRoom.id, true);\n",
    1,
)
page = page.replace(
    "                        onFocus={() => sendTyping(activeRoom.id, true)}\n",
    "                        onFocus={() => { if (!editingMessage) sendTyping(activeRoom.id, true); }}\n",
    1,
)
page = page.replace(
    "                        onKeyDown={(event) => {\n                          if (emojiSuggestions.length > 0 && event.key === \"ArrowLeft\") {\n",
    "                        onKeyDown={(event) => {\n                          if (editingMessage && event.key === \"Escape\") {\n                            event.preventDefault();\n                            cancelEditingMessage();\n                            return;\n                          }\n\n                          if (!editingMessage && emojiSuggestions.length > 0 && event.key === \"ArrowLeft\") {\n",
    1,
)
page = page.replace(
    "                          if (emojiSuggestions.length > 0 && event.key === \"ArrowRight\") {\n",
    "                          if (!editingMessage && emojiSuggestions.length > 0 && event.key === \"ArrowRight\") {\n",
    1,
)
page = page.replace(
    "                            if (emojiSuggestions.length > 0) {\n",
    "                            if (!editingMessage && emojiSuggestions.length > 0) {\n",
    1,
)
page = page.replace(
    "                        placeholder={isAnySelectionModeActive ? \"Selection mode active\" : \"Type your message...\"}\n",
    "                        placeholder={isAnySelectionModeActive ? \"Selection mode active\" : editingMessage ? \"Edit your message...\" : \"Type your message...\"}\n",
    1,
)
# Disable emoji picker button while editing.
emoji_button_marker = """                        onClick={() => {
                          if (showEmojiModal) {
"""
emoji_button_replacement = """                        disabled={Boolean(editingMessage)}
                        onClick={() => {
                          if (editingMessage) return;
                          if (showEmojiModal) {
"""
if emoji_button_marker not in page:
    raise SystemExit('Emoji button marker missing')
page = page.replace(emoji_button_marker, emoji_button_replacement, 1)
page = page.replace(
    "                      aria-label=\"Send message\"\n                    >\n                      <Send className=\"h-5 w-5\" />\n",
    "                      aria-label={editingMessage ? \"Save message edit\" : \"Send message\"}\n                    >\n                      {isSavingEdit ? <Loader2 className=\"h-5 w-5 animate-spin\" /> : editingMessage ? <Check className=\"h-5 w-5\" /> : <Send className=\"h-5 w-5\" />}\n",
    1,
)
page = page.replace(
    "                    Press <b>Enter</b> to send, <b>Shift+Enter</b> for a new line.\n",
    "                    {editingMessage ? <>Press <b>Enter</b> to save, <b>Escape</b> to cancel.</> : <>Press <b>Enter</b> to send, <b>Shift+Enter</b> for a new line.</>}\n",
    1,
)
page_path.write_text(page)


# Add static regression checks for the complete chat UI contract.
verify_path = Path('scripts/verify-auth-bootstrap.mjs')
verify = verify_path.read_text()
verify += """

const messagesPageSource = fs.readFileSync('app/messages/page.tsx', 'utf8');
const messageBubbleSource = fs.readFileSync('app/messages/components/MessageBubble.tsx', 'utf8');
const conversationItemSource = fs.readFileSync('app/messages/components/ConversationListItem.tsx', 'utf8');
const conversationListSource = fs.readFileSync('app/messages/components/ConversationList.tsx', 'utf8');

if (!messagesPageSource.includes('editComposerSnapshotRef') || !messagesPageSource.includes('restoreComposerAfterEdit') || !messagesPageSource.includes('Your previous draft will return')) {
  throw new Error('Composer-based editing no longer preserves and restores the existing draft.');
}

if (!messageBubbleSource.includes('onRequestEditMessage(message)') || !messagesPageSource.includes('onRequestEditMessage={beginEditingMessage}')) {
  throw new Error('Message editing has fallen back to the low-contrast inline bubble editor.');
}

for (const label of ['Open in new window', 'Mark as unread', 'Archive', 'Mute', 'Conversation info', 'Export conversation', 'Clear conversation']) {
  if (!conversationItemSource.includes(label)) {
    throw new Error(`Conversation context menu is missing ${label}.`);
  }
}

if (conversationItemSource.includes('Contact info')) {
  throw new Error('Conversation menu incorrectly exposes consumer contact-info language in the MUN app.');
}

if (!conversationListSource.includes('archivedRooms') || !chatContextSource.includes('manualUnreadRoomIds')) {
  throw new Error('Archive or manual-unread conversation state is not persisted.');
}
"""
verify_path.write_text(verify)
