'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { Check, MessageSquare, Plus, Search, UserPlus, Users, X } from 'lucide-react';
import { UserSearchResult } from '@/lib/chat/types';
import UserAvatar from './UserAvatar';
import { useChat } from '../context/ChatContext';

interface Props {
  open: boolean;
  onClose: () => void;
  initialTab?: 'direct' | 'group';
}

const emojiOptions = ['🗳️', '🕊️', '📜', '⚖️', '🏛️'];

const NewConversationModal: React.FC<Props> = ({ open, onClose, initialTab = 'direct' }) => {
  const {
    searchUsers,
    sendFriendRequest,
    friendRequests,
    currentUserId,
    refreshFriendRequests,
    acceptFriendRequest,
    declineFriendRequest,
    openDirectMessageRoomForUser,
    incomingRequests,
    createGroupRoom,
    selectRoom,
  } = useChat();

  const [tab, setTab] = useState<'direct' | 'group'>(initialTab);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [selected, setSelected] = useState<UserSearchResult[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🗳️');

  const trimmedQuery = query.trim();
  const canSearch = trimmedQuery.length >= 2;

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      refreshFriendRequests();
      return;
    }
    setQuery('');
    setResults([]);
    setError(null);
    setIsSearching(false);
    setHasSearched(false);
    setSelected([]);
    setName('');
    setDescription('');
    setIcon('🗳️');
  }, [initialTab, open, refreshFriendRequests]);

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (!open || !canSearch) {
        setResults([]);
        setError(null);
        setIsSearching(false);
        setHasSearched(false);
        return;
      }

      setIsSearching(true);
      setError(null);
      try {
        const data = await searchUsers(trimmedQuery);
        setResults(data);
        setHasSearched(true);
      } catch {
        setError('Something went wrong while searching.');
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(handler);
  }, [canSearch, open, searchUsers, trimmedQuery]);

  const relationshipState = useMemo(
    () =>
      (userId: string) => {
        const incomingRequest = friendRequests.find(
          (req) => req.sender_id === userId && req.receiver_id === currentUserId && req.status === 'pending'
        );
        if (incomingRequest) return { type: 'incoming', request: incomingRequest } as const;

        const outgoingRequest = friendRequests.find(
          (req) => req.sender_id === currentUserId && req.receiver_id === userId && req.status === 'pending'
        );
        if (outgoingRequest) return { type: 'outgoing', request: outgoingRequest } as const;

        const acceptedRequest = friendRequests.find(
          (req) =>
            req.status === 'accepted' &&
            ((req.sender_id === currentUserId && req.receiver_id === userId) ||
              (req.sender_id === userId && req.receiver_id === currentUserId))
        );
        if (acceptedRequest) return { type: 'connected', request: acceptedRequest } as const;

        return { type: 'none', request: null } as const;
      },
    [currentUserId, friendRequests]
  );

  const incomingRequestsList = useMemo(
    () => incomingRequests.filter((req) => req.receiver_id === currentUserId && req.status === 'pending'),
    [currentUserId, incomingRequests]
  );

  const handleStartChat = async (user: UserSearchResult) => {
    setError(null);
    const room = await openDirectMessageRoomForUser(user.id);
    if (!room) {
      setError('Unable to open a direct message room right now.');
      return;
    }
    onClose();
  };

  const handleSendRequest = async (user: UserSearchResult) => {
    setError(null);
    const result = await sendFriendRequest(user.id);
    if (!result) {
      setError('Unable to send connection request.');
    }
  };

  const toggleSelect = (user: UserSearchResult) => {
    setSelected((prev) => {
      if (prev.find((item) => item.id === user.id)) {
        return prev.filter((item) => item.id !== user.id);
      }
      return [...prev, user];
    });
  };

  const handleCreateGroup = async () => {
    const memberIds = selected.map((u) => u.id);
    const room = await createGroupRoom({ name: name || 'Untitled group', description, icon, memberIds });
    if (!room) return;
    await selectRoom(room);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-start justify-center overflow-y-auto px-4 py-10">
        <Dialog.Panel className="w-full max-w-4xl rounded-3xl bg-white p-6 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-xl font-semibold text-deep-red">New conversation</Dialog.Title>
              <p className="text-sm text-almost-black-green/70">Create direct chats and group rooms in one place.</p>
            </div>
            <button onClick={onClose} className="text-sm text-almost-black-green/60 hover:text-deep-red">Close</button>
          </div>

          <div className="mt-4 inline-flex rounded-xl border border-soft-ivory bg-warm-light-grey p-1">
            <button
              type="button"
              onClick={() => setTab('direct')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === 'direct' ? 'bg-white text-deep-red shadow-sm' : 'text-almost-black-green/70'}`}
            >
              Direct message
            </button>
            <button
              type="button"
              onClick={() => setTab('group')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === 'group' ? 'bg-white text-deep-red shadow-sm' : 'text-almost-black-green/70'}`}
            >
              Group room
            </button>
          </div>

          <div className="mt-4">
            {tab === 'direct' ? (
              <div className="space-y-3">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-almost-black-green/50" />
                  <input
                    value={query}
                    onChange={(e) => {
                      const value = e.target.value;
                      setQuery(value);
                      if (!value.trim()) {
                        setResults([]);
                        setHasSearched(false);
                      }
                    }}
                    placeholder="Search by name or email"
                    className="w-full rounded-2xl border border-soft-ivory bg-warm-light-grey px-10 py-3 text-sm"
                  />
                </label>

                {incomingRequestsList.length > 0 && (
                  <div className="space-y-2 rounded-2xl border border-soft-ivory bg-warm-light-grey/40 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-deep-red">Incoming requests</p>
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#c62828] px-2 text-xs font-semibold text-white">
                        {incomingRequestsList.length}
                      </span>
                    </div>
                    {incomingRequestsList.map((req) => (
                      <div key={req.id} className="flex items-center justify-between rounded-xl border border-soft-ivory bg-white px-3 py-2">
                        <p className="text-sm text-deep-red">{req.sender?.full_name || req.sender_id}</p>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => acceptFriendRequest(req.id)} className="rounded-lg bg-[#701e1e] px-3 py-1 text-xs font-semibold text-white hover:bg-[#8b2424]">Accept</button>
                          <button type="button" onClick={() => declineFriendRequest(req.id)} className="rounded-lg border border-soft-ivory px-3 py-1 text-xs font-semibold text-deep-red">Decline</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {isSearching && canSearch && <p className="text-sm text-almost-black-green/60">Searching...</p>}
                {!isSearching && !canSearch && <p className="text-sm text-almost-black-green/60">Start typing a name or email to search.</p>}
                {!isSearching && hasSearched && canSearch && !results.length && !error && <p className="text-sm text-almost-black-green/60">No people found</p>}

                {results.map((user) => {
                  const relationship = relationshipState(user.id);
                  const state = relationship.type !== 'none' ? relationship.type : user.is_friend ? 'connected' : user.has_pending_request ? 'outgoing' : 'none';
                  return (
                    <div key={user.id} className="flex items-center justify-between rounded-xl border border-soft-ivory bg-white px-3 py-2">
                      <div className="flex items-center gap-3">
                        <UserAvatar user={user} size={36} />
                        <p className="text-sm font-semibold text-deep-red">{user.full_name}</p>
                      </div>
                      {state === 'connected' ? (
                        <button type="button" onClick={() => handleStartChat(user)} className="inline-flex items-center gap-2 rounded-xl bg-deep-red px-3 py-2 text-xs font-semibold text-white"><MessageSquare className="h-4 w-4" />Message</button>
                      ) : state === 'incoming' && relationship.request ? (
                        <div className="flex gap-2">
                          <button type="button" onClick={() => acceptFriendRequest(relationship.request.id)} className="rounded-lg bg-deep-red px-3 py-1 text-xs font-semibold text-white"><Check className="h-3 w-3" /></button>
                          <button type="button" onClick={() => declineFriendRequest(relationship.request.id)} className="rounded-lg border border-soft-ivory px-3 py-1 text-xs font-semibold text-deep-red"><X className="h-3 w-3" /></button>
                        </div>
                      ) : state === 'outgoing' ? (
                        <span className="text-xs font-semibold text-almost-black-green/60">Request sent</span>
                      ) : (
                        <button type="button" onClick={() => handleSendRequest(user)} className="inline-flex items-center gap-2 rounded-xl border border-soft-ivory px-3 py-2 text-xs font-semibold text-deep-red"><UserPlus className="h-4 w-4" />Connect</button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-almost-black-green">Group name</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-soft-ivory bg-warm-light-grey px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-almost-black-green">Icon</label>
                    <div className="mt-1 flex gap-2">
                      {emojiOptions.map((emoji) => (
                        <button key={emoji} type="button" onClick={() => setIcon(emoji)} className={`rounded-full border px-2 py-1 ${icon === emoji ? 'border-deep-red bg-soft-rose/60' : 'border-soft-ivory'}`}>{emoji}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="w-full rounded-xl border border-soft-ivory bg-warm-light-grey px-3 py-2 text-sm" />

                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-almost-black-green/50" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people to add" className="w-full rounded-2xl border border-soft-ivory bg-warm-light-grey px-10 py-3 text-sm" />
                </label>

                <div className="max-h-60 space-y-2 overflow-y-auto">
                  {results.map((user) => {
                    const isSelected = selected.some((item) => item.id === user.id);
                    return (
                      <button key={user.id} type="button" onClick={() => toggleSelect(user)} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 ${isSelected ? 'border-deep-red/50 bg-soft-rose/40' : 'border-soft-ivory bg-white'}`}>
                        <div className="flex items-center gap-3">
                          <UserAvatar user={user} size={34} />
                          <span className="text-sm font-semibold text-deep-red">{user.full_name}</span>
                        </div>
                        <Plus className="h-4 w-4 text-deep-red" />
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-2">
                  {selected.map((user) => (
                    <span key={user.id} className="inline-flex items-center gap-2 rounded-full bg-soft-ivory px-3 py-1 text-xs font-semibold text-deep-red">
                      <UserAvatar user={user} size={20} /> {user.full_name}
                    </span>
                  ))}
                </div>

                <div className="flex justify-end">
                  <button type="button" onClick={handleCreateGroup} className="inline-flex items-center gap-2 rounded-xl bg-deep-red px-4 py-2 text-sm font-semibold text-white"><Users className="h-4 w-4" />Create group</button>
                </div>
              </div>
            )}
          </div>

          {error && <p className="mt-3 text-sm text-deep-red/80">{error}</p>}
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default NewConversationModal;
