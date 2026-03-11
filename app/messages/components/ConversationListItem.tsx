// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React from 'react';
import { RoomWithDetails } from '@/lib/chat/types';
import { abbreviateDelegationLabel, getUserDelegationLabel } from '@/lib/chat/delegation';
import { File, Pin, PinOff, UserRound, Users } from 'lucide-react';
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
        className={`group w-full cursor-pointer border-x-0 border-b border-t-0 px-4 py-3 text-left transition focus:outline-none focus-visible:outline-none ${
          isActive
            ? 'border-[#d9d9d9] bg-[#ece5dd]'
            : 'border-[#efefef] bg-white hover:bg-[#f8f8f8]'
        }`}
      >
        <div className="flex items-start gap-3">
          {room.room_type === 'dm' ? (
            <div className="relative shrink-0 pt-0.5">
              <UserAvatar user={dmPeer} size={40} />
              {hasOnlinePresence && <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500" />}
            </div>
          ) : (
            <div className="relative">
              <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-soft-ivory text-deep-red">
                {room.room_type === 'committee' ? <Users className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
              </div>
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-base font-semibold leading-5 text-deep-red">{meta.name}</p>
                {meta.shortDelegation ? (
                  <p className="mt-0.5 text-sm font-medium leading-4 text-almost-black-green/70">({meta.shortDelegation})</p>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-2">
                {last?.created_at && (
                  <span className="text-[0.7rem] text-almost-black-green/50">
                    {new Date(last.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
            {last ? (
              shouldShowAttachmentPreview ? (
                <p className="mt-1 inline-flex max-w-full items-center gap-1.5 line-clamp-1 text-xs text-almost-black-green/70">
                  <File className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{attachmentLabel}</span>
                </p>
              ) : (
                <p className="mt-1 line-clamp-1 text-xs text-almost-black-green/70">
                  {`${room.room_type === 'dm' ? '' : last.user?.full_name ? `${last.user.full_name}: ` : ''}${lastMessageText}`}
                </p>
              )
            ) : (
              <p className="mt-1 line-clamp-1 text-xs text-almost-black-green/70">No messages yet</p>
            )}
            {room.unreadCount ? (
              <span className="mt-2 inline-flex items-center rounded-full bg-deep-red/10 px-2 py-0.5 text-[0.7rem] font-semibold text-deep-red">
                {room.unreadCount} new
              </span>
            ) : null}
          </div>
        </div>
      </div>
      {contextMenuPosition && (
        <div
          className="fixed z-50 min-w-[190px] overflow-hidden rounded-xl border border-soft-ivory bg-white p-1 shadow-2xl"
          style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onTogglePin(room.id);
              setContextMenuPosition(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-almost-black-green hover:bg-warm-light-grey"
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
