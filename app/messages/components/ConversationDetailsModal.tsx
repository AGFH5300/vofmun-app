'use client';

import React from 'react';
import { Dialog } from '@headlessui/react';
import { RoomWithDetails } from '@/lib/chat/types';
import UserAvatar from './UserAvatar';
import { Ban, LogOut, UserPlus2 } from 'lucide-react';

interface Props {
  room: RoomWithDetails | null;
  open: boolean;
  onClose: () => void;
  currentUserId?: string | null;
  onAddMembers?: () => void;
  onBlockUser?: (userId: string) => void;
  onLeave?: () => void;
}

const ConversationDetailsModal: React.FC<Props> = ({ room, open, onClose, currentUserId, onAddMembers, onBlockUser, onLeave }) => {
  if (!room) return null;

  const isDirectMessage = room.room_type === 'dm';
  const peer = isDirectMessage
    ? room.members.find((member) => member.user_id !== currentUserId) || room.members[0]
    : null;
  const displayName = isDirectMessage
    ? peer?.user?.full_name || `${peer?.user?.firstname || ''} ${peer?.user?.lastname || ''}`.trim() || 'Direct message'
    : room.name;

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-start justify-center overflow-y-auto px-4 py-10">
        <Dialog.Panel className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="text-xl font-semibold text-deep-red">Conversation details</Dialog.Title>
              <p className="text-sm text-almost-black-green/70">Room overview and participants.</p>
            </div>
            <button onClick={onClose} className="text-sm text-almost-black-green/60 hover:text-deep-red">Close</button>
          </div>

          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-soft-ivory px-4 py-3">
              <p className="text-sm font-semibold text-deep-red">{displayName}</p>
              {room.description && <p className="text-sm text-almost-black-green/70">{room.description}</p>}
              <p className="text-xs text-almost-black-green/50">{room.room_type === 'dm' ? 'Direct message' : room.room_type}</p>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-almost-black-green/60">Participants</p>
              <div className="space-y-2">
                {room.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between rounded-xl border border-soft-ivory px-3 py-2">
                    <div className="flex items-center gap-3">
                      <UserAvatar user={member.user} size={36} />
                      <div>
                        <p className="text-sm font-semibold text-deep-red">{member.user?.full_name}</p>
                        <p className="text-xs text-almost-black-green/60">{member.user?.role_title || member.role}</p>
                      </div>
                    </div>
                    <span className="text-xs uppercase tracking-wide text-almost-black-green/60">{member.role}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-soft-ivory pt-4">
            {isDirectMessage ? (
              <button
                type="button"
                onClick={() => peer?.user_id && onBlockUser?.(peer.user_id)}
                className="inline-flex items-center gap-2 rounded-xl border border-soft-ivory px-3 py-2 text-sm font-semibold text-deep-red hover:bg-soft-ivory"
              >
                <Ban className="h-4 w-4" /> Block user
              </button>
            ) : (
              <button
                type="button"
                onClick={onAddMembers}
                className="inline-flex items-center gap-2 rounded-xl border border-soft-ivory px-3 py-2 text-sm font-semibold text-deep-red hover:bg-soft-ivory"
              >
                <UserPlus2 className="h-4 w-4" /> Add members
              </button>
            )}
            <button
              type="button"
              onClick={onLeave}
              className="inline-flex items-center gap-2 rounded-xl bg-deep-red/10 px-3 py-2 text-sm font-semibold text-deep-red hover:bg-soft-rose"
            >
              <LogOut className="h-4 w-4" /> Leave conversation
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default ConversationDetailsModal;
