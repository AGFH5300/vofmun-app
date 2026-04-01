// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
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
  const orderedRooms = useMemo(() => {
    const pinnedRooms = sortRooms(rooms.filter((room) => room.isPinned));
    const nonPinned = sortRooms(rooms.filter((room) => !room.isPinned));
    return [...pinnedRooms, ...nonPinned];
  }, [rooms]);

  const hasAnyRooms = rooms.length > 0;
  const channelRooms = orderedRooms.filter((room) => room.room_type !== "dm");
  const privateRooms = orderedRooms.filter((room) => room.room_type === "dm");

  return (
    <div className="h-full">
      <div className="pb-6">
        {hasAnyRooms && (
          <div className="space-y-6">
            <div>
              <p className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Channels</p>
              <ul className="space-y-1">
                {channelRooms.map((room) => (
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
            <div>
              <p className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Private Messages</p>
              <ul className="space-y-1">
                {privateRooms.map((room) => (
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
          </div>
        )}
        {!hasAnyRooms && (
          <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-2xl bg-[#ffffff] px-6 py-10 text-center shadow-[0_8px_32px_rgba(26,28,28,0.06)]">
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
