'use client';

import React from 'react';
import { RoomWithDetails } from '@/lib/chat/types';
import { Pin, PinOff, UserRound, Users } from 'lucide-react';

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
    const delegation = other?.country || other?.committee;
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
      name: other?.full_name || `${other?.firstname || ''} ${other?.lastname || ''}`.trim() || room.name,
      sub
    };
  }

  const memberCount = room.members.length;
  const label = room.room_type === 'committee' ? 'Committee room' : 'Group chat';
  return {
    name: room.name,
    sub: `${label} · ${memberCount} member${memberCount === 1 ? '' : 's'}`
  };
};

const ConversationListItem: React.FC<Props> = ({ room, isActive, onSelect, onTogglePin, currentUserId, onlineUsers }) => {
  const meta = getDisplayMeta(room, currentUserId);
  const last = room.lastMessage;
  const hasOnlinePresence =
    room.room_type === 'dm' && room.members.some((m) => String(m.user_id) !== String(currentUserId || '') && onlineUsers.has(String(m.user_id)));

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
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
        <div className={`flex items-start ${room.room_type === 'dm' ? 'gap-0' : 'gap-3'}`}>
          {room.room_type !== 'dm' && (
            <div className="relative">
              <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-soft-ivory text-deep-red">
                {room.room_type === 'committee' ? <Users className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
              </div>
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-deep-red">{meta.name}</p>
                {meta.sub ? <p className="text-[0.75rem] text-almost-black-green/60">{meta.sub}</p> : null}
              </div>
              <div className="flex flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePin(room.id);
                  }}
                  aria-label={room.isPinned ? 'Unpin conversation' : 'Pin conversation'}
                  className={`rounded-full p-1 text-almost-black-green/50 hover:text-deep-red focus:outline-none focus-visible:outline-none ${room.isPinned ? 'bg-[#ddd4cb]' : ''}`}
                >
                  {room.isPinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
                </button>
                {last?.created_at && (
                  <span className="text-[0.7rem] text-almost-black-green/50">
                    {new Date(last.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
            <p className="mt-1 line-clamp-1 text-xs text-almost-black-green/70">
              {last
                ? `${room.room_type === 'dm' ? '' : last.user?.full_name ? `${last.user.full_name}: ` : ''}${last.content}`
                : 'No messages yet'}
            </p>
            {room.room_type === 'dm' && hasOnlinePresence && <p className="mt-1 text-[0.68rem] font-medium text-emerald-600">online</p>}
            {room.unreadCount ? (
              <span className="mt-2 inline-flex items-center rounded-full bg-deep-red/10 px-2 py-0.5 text-[0.7rem] font-semibold text-deep-red">
                {room.unreadCount} new
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
};

export default ConversationListItem;
