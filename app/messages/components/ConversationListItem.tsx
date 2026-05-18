// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React from 'react';
import { RoomWithDetails } from '@/lib/chat/types';
import { abbreviateDelegationLabel, getUserDelegationLabel } from '@/lib/chat/delegation';
import { File, Pin, PinOff, UsersRound, Users } from 'lucide-react';
import UserAvatar from './UserAvatar';

interface Props {
  room: RoomWithDetails;
  isActive: boolean;
  onSelect: (room: RoomWithDetails) => void;
  onTogglePin: (roomId: string) => void;
  currentUserId?: string | null;
  onlineUsers: Set<string>;
}

const getDisplayMeta = (room: RoomWithDetails, currentUserId?: string | null) => {
  if (room.room_type === 'dm') {
    const me = room.members.find((m) => String(m.user_id) === String(currentUserId || '') || String(m.user?.id || '') === String(currentUserId || ''));
    const otherMember =
      room.members.find((m) => String(m.user_id) !== String(me?.user_id || '')) || room.members.find((m) => String(m.user_id) !== String(currentUserId || '')) || room.members[0];
    const other = otherMember?.user;
    const delegation = getUserDelegationLabel(other);
    const delegationShort = abbreviateDelegationLabel(delegation);
    const resolvedRoleLabel = (other?.role_title || other?.role || 'Delegate').toString();
    const isDelegate =
      String(other?.role || '').toLowerCase() === 'delegate' ||
      resolvedRoleLabel.toLowerCase() === 'delegate';
    const sub = isDelegate
      ? delegation || ''
      : delegation
        ? `${resolvedRoleLabel} · ${delegation}`
        : resolvedRoleLabel;

    return {
      name: other?.full_name || `${other?.first_name || ''} ${other?.last_name || ''}`.trim() || room.name,
      shortDelegation: delegationShort,
      sub
    };
  }

  const memberCount = room.members.length;
  const label = room.room_type === 'committee' ? 'Committee room' : 'Group chat';
  return {
    name: room.name,
    shortDelegation: '',
    sub: `${label} · ${memberCount} member${memberCount === 1 ? '' : 's'}`
  };
};

const ConversationListItem: React.FC<Props> = ({ room, isActive, onSelect, onTogglePin, currentUserId, onlineUsers }) => {
  const [contextMenuPosition, setContextMenuPosition] = React.useState<{ x: number; y: number } | null>(null);
  const meta = getDisplayMeta(room, currentUserId);
  const last = room.lastMessage;
  const unreadCount = Math.max(0, Math.floor(room.unreadCount || 0));
  const hasUnread = unreadCount > 0;
  const unreadBadgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);
  const dmPeer =
    room.room_type === 'dm'
      ? room.members.find((m) => String(m.user_id) !== String(currentUserId || ''))?.user || room.members[0]?.user
      : undefined;
  const hasOnlinePresence =
    room.room_type === 'dm' && room.members.some((m) => String(m.user_id) !== String(currentUserId || '') && onlineUsers.has(String(m.user_id)));
  const lastMessageText = last?.content?.trim() || '';
  const lastMessageAttachments = last?.attachments || [];
  const shouldShowAttachmentPreview = !lastMessageText && lastMessageAttachments.length > 0;
  const attachmentLabel =
    lastMessageAttachments.length === 1
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

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          setContextMenuPosition({ x: event.clientX, y: event.clientY });
        }}
        onClick={() => onSelect(room)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect(room);
          }
        }}
        className={`group w-full cursor-pointer px-2 py-1.5 text-left transition focus:outline-none focus-visible:outline-none ${
          isActive
            ? 'rounded-xl border-l-[3px] border-[#6E1D1B] bg-[#e8e8e8]'
            : 'rounded-xl bg-transparent hover:bg-[#ecebeb]'
        }`}
      >
        <div className="flex items-start gap-2.5">
          {room.room_type === 'dm' ? (
            <div className="relative shrink-0 pt-0.5">
              <UserAvatar user={dmPeer} size={40} />
              {hasOnlinePresence && <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500" />}
            </div>
          ) : (
            <div className="relative">
              <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-soft-ivory text-deep-red">
                {room.room_type === 'committee' ? <Users className="h-4 w-4" /> : <UsersRound className="h-4 w-4" />}
              </div>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className={`truncate text-[13px] leading-5 ${isActive ? 'text-[#6E1D1B]' : 'text-[#1a1c1c]'} ${hasUnread ? 'font-bold' : 'font-semibold'}`}>{meta.name}</p>
                {meta.shortDelegation ? (
                  <p className="truncate text-[11px] font-medium leading-4 text-[#1a1c1c]/65">({meta.shortDelegation})</p>
                ) : null}
              </div>
              <div className="ml-2 flex shrink-0 flex-col items-end gap-1.5">
                {last?.created_at && (
                  <span className={`text-[0.7rem] ${hasUnread ? 'font-semibold text-deep-red' : 'text-[#1a1c1c]/50'}`}>
                    {new Date(last.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                {hasUnread ? (
                  <span
                    aria-label={`${unreadCount} unread message${unreadCount === 1 ? '' : 's'}`}
                    className="inline-flex min-w-[1.2rem] items-center justify-center rounded-full background-deep-red px-1 py-0.5 text-[10px] font-bold leading-none text-white"
                  >
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
            ) : (
              <p className="mt-1 line-clamp-1 text-xs text-[#1a1c1c]/70">No messages yet</p>
            )}
          </div>
        </div>
      </div>
      {contextMenuPosition && (
        <div
          className="fixed z-50 min-w-[190px] overflow-hidden rounded-xl bg-white p-1 shadow-[0_8px_32px_rgba(26,28,28,0.06)]"
          style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onTogglePin(room.id);
              setContextMenuPosition(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#1a1c1c] hover:bg-warm-light-grey"
          >
            {room.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            <span>{room.isPinned ? 'Unpin chat' : 'Pin chat'}</span>
          </button>
        </div>
      )}
    </li>
  );
};

export default ConversationListItem;
