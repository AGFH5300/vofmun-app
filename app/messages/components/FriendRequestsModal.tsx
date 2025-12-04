'use client';

import React, { useMemo } from 'react';
import { Dialog } from '@headlessui/react';
import { Check, HandHeart, X } from 'lucide-react';
import { FriendRequest } from '@/lib/chat/types';
import UserAvatar from './UserAvatar';
import { useChat } from '../context/ChatContext';

interface Props {
  open: boolean;
  onClose: () => void;
}

const FriendRequestsModal: React.FC<Props> = ({ open, onClose }) => {
  const { friendRequests, currentUserId, respondToFriendRequest } = useChat();

  const { incoming, outgoing } = useMemo(() => {
    const incomingReq = friendRequests.filter((req) => req.receiver_id === currentUserId);
    const outgoingReq = friendRequests.filter((req) => req.sender_id === currentUserId);
    return { incoming: incomingReq, outgoing: outgoingReq };
  }, [currentUserId, friendRequests]);

  const handleRespond = async (id: string, action: 'accept' | 'reject') => {
    await respondToFriendRequest(id, action);
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-start justify-center overflow-y-auto px-4 py-10">
        <Dialog.Panel className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-xl">
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="text-xl font-semibold text-deep-red">Connection requests</Dialog.Title>
              <p className="text-sm text-almost-black-green/70">Approve delegates and chairs who want to message you.</p>
            </div>
            <button onClick={onClose} className="text-sm text-almost-black-green/60 hover:text-deep-red">Close</button>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-almost-black-green/60">Incoming</p>
              <div className="mt-2 space-y-3">
                {incoming.length === 0 && <p className="text-sm text-almost-black-green/60">No pending requests.</p>}
                {incoming.map((req) => (
                  <div key={req.id} className="flex items-center justify-between rounded-2xl border border-soft-ivory px-4 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar user={req.sender} size={40} />
                      <div>
                        <p className="text-sm font-semibold text-deep-red">{req.sender?.full_name}</p>
                        <p className="text-xs text-almost-black-green/60">wants to connect</p>
                      </div>
                    </div>
                    <div className="flex gap-2 text-sm">
                      <button
                        onClick={() => handleRespond(req.id, 'reject')}
                        className="inline-flex items-center gap-2 rounded-xl border border-soft-ivory px-3 py-2 font-semibold text-deep-red hover:bg-soft-ivory"
                      >
                        <X className="h-4 w-4" /> Decline
                      </button>
                      <button
                        onClick={() => handleRespond(req.id, 'accept')}
                        className="inline-flex items-center gap-2 rounded-xl bg-deep-red px-3 py-2 font-semibold text-white hover:bg-dark-burgundy"
                      >
                        <Check className="h-4 w-4" /> Accept
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-almost-black-green/60">Outgoing</p>
              <div className="mt-2 space-y-3">
                {outgoing.length === 0 && <p className="text-sm text-almost-black-green/60">You haven’t sent any requests yet.</p>}
                {outgoing.map((req) => (
                  <div key={req.id} className="flex items-center justify-between rounded-2xl border border-soft-ivory px-4 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar user={req.receiver} size={40} />
                      <div>
                        <p className="text-sm font-semibold text-deep-red">{req.receiver?.full_name}</p>
                        <p className="text-xs text-almost-black-green/60">{req.status === 'pending' ? 'Pending' : req.status}</p>
                      </div>
                    </div>
                    <HandHeart className="h-4 w-4 text-deep-red" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default FriendRequestsModal;
