// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { BadgeCheck, Check, Loader2, MessageCirclePlus, Plus, Search, UserPlus, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { FriendRequest, UserSearchResult } from '@/lib/chat/types';
import { getUserDelegationLabel } from '@/lib/chat/delegation';
import UserAvatar from './UserAvatar';
import { useChat } from '../context/ChatContext';

interface Props {
  open: boolean;
  onClose: () => void;
  initialTab?: 'direct' | 'group' | 'friends';
}

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
    resolveUserDisplay,
    createGroupRoom,
    selectRoom,
  } = useChat();

  const [tab, setTab] = useState<'direct' | 'group' | 'friends'>(initialTab);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [sendingRequestTo, setSendingRequestTo] = useState<string | null>(null);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [openingChatFor, setOpeningChatFor] = useState<string | null>(null);
  const [acceptedConnection, setAcceptedConnection] = useState<{ userId: string; name: string } | null>(null);

  const [selected, setSelected] = useState<UserSearchResult[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const trimmedQuery = query.trim();
  const canSearch = trimmedQuery.length >= 2;

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      void refreshFriendRequests();
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
    setSendingRequestTo(null);
    setRespondingTo(null);
    setOpeningChatFor(null);
    setAcceptedConnection(null);
  }, [initialTab, open, refreshFriendRequests]);

  useEffect(() => {
    const handler = setTimeout(async () => {
      const shouldSearchInCurrentTab = tab === 'group' || tab === 'direct';
      if (!open || !shouldSearchInCurrentTab || !canSearch) {
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
  }, [canSearch, open, searchUsers, tab, trimmedQuery]);

  const relationshipState = useMemo(
    () =>
      (userId: string) => {
        const normalizedCurrentUserId = String(currentUserId || '');
        const normalizedUserId = String(userId);
        const incomingRequest = friendRequests.find(
          (req) => String(req.sender_id) === normalizedUserId && String(req.receiver_id) === normalizedCurrentUserId && req.status === 'pending'
        );
        if (incomingRequest) return { type: 'incoming', request: incomingRequest } as const;

        const outgoingRequest = friendRequests.find(
          (req) => String(req.sender_id) === normalizedCurrentUserId && String(req.receiver_id) === normalizedUserId && req.status === 'pending'
        );
        if (outgoingRequest) return { type: 'outgoing', request: outgoingRequest } as const;

        const acceptedRequest = friendRequests.find(
          (req) =>
            req.status === 'accepted' &&
            ((String(req.sender_id) === normalizedCurrentUserId && String(req.receiver_id) === normalizedUserId) ||
              (String(req.sender_id) === normalizedUserId && String(req.receiver_id) === normalizedCurrentUserId))
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

  const connectedContacts = useMemo(() => {
    const currentId = String(currentUserId || '');
    const byUser = new Map<string, { userId: string; name: string; user?: FriendRequest['sender'] | null }>();

    friendRequests
      .filter((req) => req.status === 'accepted')
      .forEach((req) => {
        const senderId = String(req.sender_id);
        const receiverId = String(req.receiver_id);
        const isSenderCurrentUser = senderId === currentId;
        const peerId = isSenderCurrentUser ? receiverId : senderId;
        if (!peerId || peerId === currentId || byUser.has(peerId)) return;

        const peerUser = isSenderCurrentUser ? req.receiver : req.sender;
        byUser.set(peerId, {
          userId: peerId,
          name: resolveUserDisplay(peerId, peerUser),
          user: peerUser,
        });
      });

    return Array.from(byUser.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [currentUserId, friendRequests, resolveUserDisplay]);

  const getRequestDisplayName = (requestUserId: string, requestUser?: FriendRequest['sender'] | null) =>
    resolveUserDisplay(requestUserId, requestUser);

  const handleStartChat = async (user: { id: string; full_name?: string; name?: string }) => {
    setError(null);
    setOpeningChatFor(user.id);
    const room = await openDirectMessageRoomForUser(user.id);
    setOpeningChatFor(null);
    if (!room) {
      setError('Unable to open a direct message room right now.');
      return;
    }
    onClose();
  };

  const handleSendRequest = async (user: UserSearchResult) => {
    setError(null);
    setSendingRequestTo(user.id);
    const result = await sendFriendRequest(user.id);
    setSendingRequestTo(null);
    if (!result) {
      setError('Unable to send connection request.');
      return;
    }
    toast.success(`Request sent to ${user.full_name}.`);
  };

  const handleAcceptRequest = async (request: FriendRequest) => {
    const requestId = request.id;
    setError(null);
    setRespondingTo(requestId);
    await acceptFriendRequest(requestId);
    setRespondingTo(null);

    const senderId = String(request.sender_id);
    const senderName = getRequestDisplayName(senderId, request.sender);
    setAcceptedConnection({ userId: senderId, name: senderName });
    toast.success(`You are now connected with ${senderName}.`);
  };

  const handleDeclineRequest = async (requestId: string) => {
    setRespondingTo(requestId);
    await declineFriendRequest(requestId);
    setRespondingTo(null);
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
    const room = await createGroupRoom({ name: name || 'Untitled group', description, memberIds });
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
              <p className="text-sm text-almost-black-green/70">Search delegates, connect, and open chats.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-2 text-almost-black-green/60 hover:bg-warm-light-grey">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 space-y-4">
            <div className="inline-flex rounded-xl border border-soft-ivory bg-warm-light-grey/40 p-1">
              <button
                type="button"
                onClick={() => setTab('direct')}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab === 'direct' ? 'bg-white text-deep-red shadow-sm' : 'text-almost-black-green/70'}`}
              >
                Direct
              </button>
              <button
                type="button"
                onClick={() => setTab('group')}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab === 'group' ? 'bg-white text-deep-red shadow-sm' : 'text-almost-black-green/70'}`}
              >
                Group
              </button>
              <button
                type="button"
                onClick={() => setTab('friends')}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab === 'friends' ? 'bg-white text-deep-red shadow-sm' : 'text-almost-black-green/70'}`}
              >
                Friends
              </button>
            </div>

            {tab === 'direct' ? (
              <div className="space-y-4">
                    <div className="relative">
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
                        style={{ paddingLeft: '30px' }}
                      />
                    </div>

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
                            <p className="text-sm text-deep-red">{getRequestDisplayName(req.sender_id, req.sender)}</p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleAcceptRequest(req)}
                                disabled={respondingTo === req.id}
                                className="inline-flex items-center gap-1 rounded-lg bg-[#701e1e] px-3 py-1 text-xs font-semibold text-white hover:bg-[#8b2424] disabled:cursor-wait disabled:opacity-70"
                              >
                                {respondingTo === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                Accept
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeclineRequest(req.id)}
                                disabled={respondingTo === req.id}
                                className="rounded-lg border border-soft-ivory px-3 py-1 text-xs font-semibold text-deep-red disabled:cursor-wait disabled:opacity-70"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {acceptedConnection && (
                      <div className="rounded-2xl border border-[#c8e6c9] bg-[#edf7ed] p-3">
                        <p className="text-sm font-semibold text-[#245b2a]">You and {acceptedConnection.name} are now connected.</p>
                        <p className="mt-1 text-xs text-[#245b2a]/80">Start a chat with your new friend now.</p>
                        <button
                          type="button"
                          onClick={() => handleStartChat({ id: acceptedConnection.userId, full_name: acceptedConnection.name })}
                          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[#245b2a] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1f4d24]"
                        >
                          <MessageCirclePlus className="h-4 w-4" /> Start chat
                        </button>
                      </div>
                    )}

                    {isSearching && canSearch && <p className="text-sm text-almost-black-green/60">Searching...</p>}
                    {!isSearching && !canSearch && <p className="text-sm text-almost-black-green/60">Start typing a name or email to search.</p>}
                    {!isSearching && hasSearched && canSearch && !results.length && !error && <p className="text-sm text-almost-black-green/60">No people found</p>}

                    {results.map((user) => {
                      const relationship = relationshipState(user.id);
                      const delegationLabel = getUserDelegationLabel(user);
                      const state = relationship.type;
                      return (
                        <div key={user.id} className="flex items-center justify-between rounded-xl border border-soft-ivory bg-white px-3 py-2">
                          <div className="flex items-center gap-3">
                            <UserAvatar user={user} size={36} />
                            <div>
                              <p className="text-sm font-semibold text-deep-red">{user.full_name}</p>
                              {delegationLabel && <p className="text-xs text-almost-black-green/60">{delegationLabel}</p>}
                            </div>
                          </div>
                          {state === 'connected' ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-xl bg-soft-ivory px-3 py-2 text-xs font-semibold text-deep-red">
                                <BadgeCheck className="h-4 w-4 text-sky-500" /> In friends
                              </span>
                              <button
                                type="button"
                                onClick={() => handleStartChat(user)}
                                disabled={openingChatFor === user.id}
                                className="inline-flex items-center rounded-xl background-deep-red px-3 py-2 text-xs font-semibold text-white hover:bg-deep-red/90 disabled:cursor-wait disabled:opacity-70"
                              >
                                {openingChatFor === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Start chat'}
                              </button>
                            </div>
                          ) : state === 'incoming' && relationship.request ? (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleAcceptRequest(relationship.request)}
                                disabled={respondingTo === relationship.request.id}
                                className="inline-flex items-center gap-1 rounded-lg bg-deep-red px-3 py-1 text-xs font-semibold text-white disabled:cursor-wait disabled:opacity-70"
                              >
                                {respondingTo === relationship.request.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3 w-3" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeclineRequest(relationship.request.id)}
                                disabled={respondingTo === relationship.request.id}
                                className="rounded-lg border border-soft-ivory px-3 py-1 text-xs font-semibold text-deep-red disabled:cursor-wait disabled:opacity-70"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : state === 'outgoing' ? (
                            <span className="text-xs font-semibold text-almost-black-green/60">Request sent</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSendRequest(user)}
                              disabled={sendingRequestTo === user.id}
                              className="inline-flex items-center gap-2 rounded-xl border border-soft-ivory px-3 py-2 text-xs font-semibold text-deep-red disabled:cursor-wait disabled:opacity-70"
                            >
                              {sendingRequestTo === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                              Connect
                            </button>
                          )}
                        </div>
                      );
                    })}
              </div>
            ) : tab === 'friends' ? (
              <div className="space-y-2 rounded-2xl border border-soft-ivory bg-warm-light-grey/35 p-3">
                <p className="text-sm font-semibold text-deep-red">Friends</p>
                {connectedContacts.length === 0 ? (
                  <p className="text-sm text-almost-black-green/60">You do not have any accepted friends yet.</p>
                ) : (
                  connectedContacts.map((contact) => (
                    <div key={contact.userId} className="flex items-center justify-between gap-3 rounded-2xl border border-soft-ivory bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(17,27,33,0.06)]">
                      <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar user={{ id: contact.userId, full_name: contact.name, ...(contact.user || {}) }} size={36} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-deep-red">{contact.name}</p>
                          {getUserDelegationLabel(contact.user) ? (
                            <p className="truncate text-xs text-almost-black-green/60">{getUserDelegationLabel(contact.user)}</p>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleStartChat({ id: contact.userId, full_name: contact.name })}
                        disabled={openingChatFor === contact.userId}
                        className="inline-flex items-center gap-2 rounded-xl background-deep-red px-3 py-2 text-xs font-semibold text-white hover:bg-deep-red/90 disabled:cursor-wait disabled:opacity-70"
                      >
                        {openingChatFor === contact.userId ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCirclePlus className="h-4 w-4" />}
                        Start chat
                      </button>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-almost-black-green">Group name</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-soft-ivory bg-warm-light-grey px-3 py-2 text-sm" />
                  </div>
                </div>

                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="w-full rounded-xl border border-soft-ivory bg-warm-light-grey px-3 py-2 text-sm" />
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-almost-black-green/50" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people to add" className="w-full rounded-2xl border border-soft-ivory bg-warm-light-grey px-10 py-3 text-sm" style={{ paddingLeft: '30px' }} />
                </div>

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
