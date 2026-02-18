'use client';

import React, { useMemo } from 'react';
import { RoomWithDetails } from '@/lib/chat/types';
import ConversationListItem from './ConversationListItem';
import { MessageCircle } from 'lucide-react';

interface Props {
  rooms: RoomWithDetails[];
  activeRoomId?: string;
  onSelect: (room: RoomWithDetails) => void;
  onTogglePin: (roomId: string) => void;
  currentUserId?: string | null;
  onlineUsers: Set<string>;
  onNewChat: () => void;
  onNewGroup: () => void;
}

const sortRooms = (list: RoomWithDetails[]) =>
  [...list].sort((a, b) => {
    const aTime = a.lastMessage?.created_at ? new Date(a.lastMessage.created_at).getTime() : 0;
    const bTime = b.lastMessage?.created_at ? new Date(b.lastMessage.created_at).getTime() : 0;
    return bTime - aTime;
  });

const ConversationList: React.FC<Props> = ({
  rooms,
  activeRoomId,
  onSelect,
  onTogglePin,
  currentUserId,
  onlineUsers,
  onNewChat,
  onNewGroup,
}) => {
  const { pinned, committees, dms, groups } = useMemo(() => {
    const pinnedRooms = sortRooms(rooms.filter((room) => room.isPinned));
    const committeesRooms = sortRooms(rooms.filter((room) => room.room_type === 'committee' && !room.isPinned));
    const dmRooms = sortRooms(rooms.filter((room) => room.room_type === 'dm' && !room.isPinned));
    const groupRooms = sortRooms(rooms.filter((room) => room.room_type !== 'dm' && room.room_type !== 'committee' && !room.isPinned));
    return { pinned: pinnedRooms, committees: committeesRooms, dms: dmRooms, groups: groupRooms };
  }, [rooms]);

  const renderSection = (title: string, list: RoomWithDetails[]) => {
    if (!list.length) return null;
    return (
      <div className="space-y-2">
        <div className="px-2 text-[0.7rem] uppercase tracking-[0.2em]">{title}</div>
        <ul className="space-y-2">
          {list.map((room) => (
            <ConversationListItem
              key={room.id}
              room={room}
              isActive={room.id === activeRoomId}
              onSelect={onSelect}
              onTogglePin={onTogglePin}
              currentUserId={currentUserId}
              onlineUsers={onlineUsers}
            />
          ))}
        </ul>
      </div>
    );
  };

  const hasAnyRooms = rooms.length > 0;

  return (
    <div className="h-full">
      <div className="space-y-6 pb-6">
        {renderSection('Pinned', pinned)}
        {renderSection('Committees / Rooms', committees)}
        {renderSection('Direct Messages', dms)}
        {renderSection('Group Chats', groups)}
        {!hasAnyRooms && (
          <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-soft-ivory px-6 py-10 text-center">
            <MessageCircle className="text-deep-red/50" size={42} />
            <div>
              <p className="text-base font-semibold text-deep-red">You don’t have any conversations yet</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onNewChat}
                className="rounded-xl !bg-deep-red px-4 py-2 text-sm font-semibold text-almost-black-green/70 shadow-sm hover:!bg-dark-burgundy"
              >
                Start a conversation
              </button>
              <button
                type="button"
                onClick={onNewGroup}
                className="rounded-xl !bg-deep-red px-4 py-2 text-sm font-semibold text-almost-black-green/70 shadow-sm hover:!bg-dark-burgundy"
              >
                Start a group
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationList;
