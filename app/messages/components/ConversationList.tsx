// © 2026 Ansh Gupta. All rights reserved.
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
