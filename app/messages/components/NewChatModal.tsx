'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { Search, Send, UserPlus } from 'lucide-react';
import { UserSearchResult } from '@/lib/chat/types';
import UserAvatar from './UserAvatar';
import { useChat } from '../context/ChatContext';

interface Props {
  open: boolean;
  onClose: () => void;
  onConversationCreated?: (roomId: string) => void;
}

const NewChatModal: React.FC<Props> = ({ open, onClose, onConversationCreated }) => {
  const { searchUsers, createDirectRoom, sendFriendRequest, selectRoom } = useChat();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setError(null);
      setIsSearching(false);
      return;
    }
  }, [open]);

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (trimmedQuery.length < 2) {
        setResults([]);
        setError(null);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      setError(null);
      try {
        const data = await searchUsers(trimmedQuery);
        setResults(data);
      } catch (_err) {
        setError('Something went wrong while searching.');
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [query, searchUsers, trimmedQuery]);

  const handleStartChat = async (user: UserSearchResult) => {
    setError(null);
    const room = await createDirectRoom(user.id);
    if (!room) {
      setError('Unable to start chat.');
      return;
    }
    await selectRoom(room);
    onConversationCreated?.(room.id);
    onClose();
  };

  const handleSendRequest = async (user: UserSearchResult) => {
    setError(null);
    await sendFriendRequest(user.id);
    setError('Connection request sent');
  };

  const emptyState = useMemo(
    () => (
      <div className="rounded-2xl border border-dashed border-soft-ivory bg-warm-light-grey/40 px-4 py-8 text-center text-almost-black-green/70">
        <p className="text-sm">Search for a delegate, chair, or secretariat member to start a chat.</p>
      </div>
    ),
    []
  );

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-start justify-center overflow-y-auto px-4 py-10">
        <Dialog.Panel className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl">
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="text-xl font-semibold text-deep-red">Start a direct message</Dialog.Title>
              <p className="text-sm text-almost-black-green/70">Find admins, chairs, delegates, or secretariat members by name or email.</p>
            </div>
            <button onClick={onClose} className="text-sm text-almost-black-green/60 hover:text-deep-red">Close</button>
          </div>

          <div className="mt-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-almost-black-green/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, role, or email"
                className="w-full rounded-xl border border-soft-ivory bg-warm-light-grey px-10 py-3 text-sm focus:border-deep-red/40 focus:ring-2 focus:ring-deep-red/20"
              />
            </label>
          </div>

          <div className="mt-4 space-y-3">
            {isSearching && <p className="text-sm text-almost-black-green/60">Searching...</p>}
            {!isSearching && trimmedQuery.length < 2 && emptyState}
            {!isSearching && trimmedQuery.length >= 2 && !results.length && !error && (
              <p className="text-sm text-almost-black-green/60">No people found</p>
            )}
            {results.map((user) => (
              <div key={user.id} className="flex items-center justify-between rounded-2xl border border-soft-ivory px-4 py-3">
                <div className="flex items-center gap-3">
                  <UserAvatar user={user} size={40} />
                  <div>
                    <p className="text-sm font-semibold text-deep-red">{user.full_name}</p>
                    <p className="text-xs text-almost-black-green/60">
                      {user.role_title || user.role || 'Participant'}
                      {user.committee ? ` • ${user.committee}` : ''}
                      {user.country ? ` • ${user.country}` : ''}
                    </p>
                    {user.email && <p className="text-xs text-almost-black-green/50">{user.email}</p>}
                  </div>
                </div>
                <div className="flex gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => handleStartChat(user)}
                    className="inline-flex items-center gap-2 rounded-xl bg-deep-red px-3 py-2 font-semibold text-white hover:bg-dark-burgundy"
                  >
                    <Send className="h-4 w-4" /> Message
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendRequest(user)}
                    className="inline-flex items-center gap-2 rounded-xl border border-soft-ivory px-3 py-2 font-semibold text-deep-red hover:bg-soft-ivory"
                  >
                    <UserPlus className="h-4 w-4" /> Connect
                  </button>
                </div>
              </div>
            ))}
            {error && <p className="text-sm text-deep-red/80">{error}</p>}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default NewChatModal;
