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
      <div className="pb-3">
        {hasAnyRooms && (
          <div className="space-y-5">
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
          <div className="mt-4 flex flex-col items-center justify-center gap-2.5 rounded-xl border border-[#dcc0bd]/20 bg-[#ffffff] px-4 py-6 text-center">
            <MessageCircle className="text-deep-red/50" size={42} />
            <div>
              <p className="text-sm font-semibold text-[#6E1D1B]">You don’t have any conversations yet</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onNewChat}
                className="rounded-lg bg-[#6E1D1B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#500608]"
              >
                Start a conversation
              </button>
              <button
                type="button"
                onClick={onNewGroup}
                className="rounded-lg bg-[#6E1D1B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#500608]"
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
