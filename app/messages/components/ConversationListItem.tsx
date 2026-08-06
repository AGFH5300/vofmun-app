// © 2026 Ansh Gupta. All rights reserved.
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
