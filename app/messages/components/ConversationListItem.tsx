'use client';

import React from 'react';
import { RoomWithDetails } from '@/lib/chat/types';
import UserAvatar from './UserAvatar';
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
    const other = room.members.find((m) => m.user_id !== currentUserId)?.user;
    return {
      name: other?.full_name || room.name,
      sub: other?.role_title || other?.committee || 'Direct message',
      avatarUser: other,
    };
  }

  const memberCount = room.members.length;
  const label = room.room_type === 'committee' ? 'Committee room' : 'Group chat';
  return {
    name: room.name,
    sub: `${label} · ${memberCount} member${memberCount === 1 ? '' : 's'}`,
    avatarUser: undefined,
  };
};

const ConversationListItem: React.FC<Props> = ({ room, isActive, onSelect, onTogglePin, currentUserId, onlineUsers }) => {
  const meta = getDisplayMeta(room, currentUserId);
  const last = room.lastMessage;
  const hasOnlinePresence = room.room_type === 'dm' && room.members.some((m) => onlineUsers.has(m.user_id));

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(room)}
        className={`group w-full rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-deep-red/40 ${
          isActive ? 'border-deep-red/40 bg-soft-rose/40 shadow-sm' : 'border-transparent hover:border-soft-ivory hover:bg-soft-ivory'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="relative">
            {room.room_type === 'dm' ? (
              <UserAvatar user={meta.avatarUser} size={42} />
            ) : (
              <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-soft-ivory text-deep-red">
                {room.room_type === 'committee' ? <Users className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
              </div>
            )}
            {hasOnlinePresence && (
              <span className="absolute -right-1 -bottom-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-deep-red">{meta.name}</p>
                <p className="text-[0.75rem] text-almost-black-green/60">{meta.sub}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePin(room.id);
                  }}
                  aria-label={room.isPinned ? 'Unpin conversation' : 'Pin conversation'}
                  className={`rounded-full p-1 text-almost-black-green/50 hover:text-deep-red ${room.isPinned ? 'bg-soft-rose/50' : ''}`}
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
              {last ? `${last.user?.full_name ? `${last.user.full_name}: ` : ''}${last.content}` : 'No messages yet'}
            </p>
            {room.unreadCount ? (
              <span className="mt-2 inline-flex items-center rounded-full bg-deep-red/10 px-2 py-0.5 text-[0.7rem] font-semibold text-deep-red">
                {room.unreadCount} new
              </span>
            ) : null}
          </div>
        </div>
      </button>
    </li>
  );
};

export default ConversationListItem;
