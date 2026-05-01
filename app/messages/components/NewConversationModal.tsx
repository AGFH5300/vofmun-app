// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { BadgeCheck, Clock3, Inbox, Loader2, MessageCirclePlus, Plus, Search, UserPlus, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { FriendRequest, User, UserSearchResult } from '@/lib/chat/types';
import { getUserDelegationLabel } from '@/lib/chat/delegation';
import UserAvatar from './UserAvatar';
import { useChat } from '../context/ChatContext';
import { useModalLayerLock } from '../hooks/useModalLayerLock';

interface Props {
  open: boolean;
  onClose: () => void;
  initialTab?: 'direct' | 'group' | 'friends' | 'requests';
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

  const [tab, setTab] = useState<'direct' | 'group' | 'friends' | 'requests'>(initialTab);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [sendingRequestTo, setSendingRequestTo] = useState<Set<string>>(() => new Set());
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [openingChatFor, setOpeningChatFor] = useState<string | null>(null);
  const [acceptedConnection, setAcceptedConnection] = useState<{ userId: string; name: string } | null>(null);

  const [selected, setSelected] = useState<UserSearchResult[]>([]);
  const [name, setName] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const trimmedQuery = query.trim();
  const canSearch = trimmedQuery.length >= 2;
  const sharedSearchInputClassName = 'w-full rounded-2xl border border-soft-ivory bg-warm-light-grey px-10 py-3 text-sm';

  useModalLayerLock(open);

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
    setSendingRequestTo(new Set());
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

  const sentRequestsList = useMemo(
    () =>
      friendRequests.filter(
        (req) => String(req.sender_id) === String(currentUserId || '') && req.status === 'pending'
      ),
    [currentUserId, friendRequests]
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

  const getRequestMetaLine = (requestUser?: FriendRequest['sender'] | null) => {
    if (!requestUser) return null;
    const delegationLabel = getUserDelegationLabel(requestUser);
    return delegationLabel || requestUser.email || null;
  };

  const getContactAvatarUser = (contact: { userId: string; name: string; user?: FriendRequest['sender'] | null }): User => ({
    id: contact.userId,
    email: contact.user?.email ?? '',
    full_name: contact.name,
    ...contact.user,
  });

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
    setSendingRequestTo((prev) => {
      const next = new Set(prev);
      next.add(user.id);
      return next;
    });

    try {
      const result = await sendFriendRequest(user.id);
      if (!result) {
        setError('Unable to send connection request.');
        return;
      }
      toast.success(`Request sent to ${user.full_name}.`);
    } finally {
      setSendingRequestTo((prev) => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
    }
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
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please provide a group name.');
      return;
    }

    const memberIds = selected.map((u) => u.id);
    if (memberIds.length < 2) {
      setError('Please select at least 2 participants for a group chat.');
      return;
    }

    setIsCreatingGroup(true);
    const room = await createGroupRoom({ name: trimmedName, memberIds });
    setIsCreatingGroup(false);
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
              <Dialog.Title className="text-base font-semibold">New conversation</Dialog.Title>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-soft-ivory/80 bg-white text-almost-black-green/60 transition hover:border-soft-ivory hover:bg-warm-light-grey hover:text-deep-red"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="inline-flex rounded-xl border border-soft-ivory bg-warm-light-grey/40 p-1.5 shadow-[0_4px_10px_rgba(17,27,33,0.04)]">
                <button
                  type="button"
                  onClick={() => setTab('direct')}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold hover:bg-gray-100 ${tab === 'direct' ? 'bg-white text-deep-red shadow-sm' : 'text-almost-black-green/70'}`}
                  style={{color: "var(--deep-red)"}}
                >
                  Direct
                </button>
                <button
                  type="button"
                  onClick={() => setTab('group')}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold hover:bg-gray-100 ${tab === 'group' ? 'bg-white text-deep-red shadow-sm' : 'text-almost-black-green/70'}`}
                  style={{color: "var(--deep-red)"}} 
                >
                  Group
                </button>
                <button
                  type="button"
                  onClick={() => setTab('friends')}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold hover:bg-gray-100 ${tab === 'friends' ? 'bg-white text-deep-red shadow-sm' : 'text-almost-black-green/70'}`}
                  style={{color: "var(--deep-red)"}}
                >
                  Friends
                </button>
                <button
                  type="button"
                  onClick={() => setTab('requests')}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold hover:bg-gray-100 ${tab === 'requests' ? 'bg-white text-deep-red shadow-sm' : 'text-almost-black-green/70'}`}
                  style={{color: "var(--deep-red)"}}
                >
                  Requests
                </button>
              </div>
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
                        className={sharedSearchInputClassName}
                        style={{ paddingLeft: '30px' }}
                      />
                    </div>

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
                          ) : state === 'incoming' ? (
                            <span className="rounded-full border border-soft-ivory bg-warm-light-grey/60 px-3 py-1 text-xs font-semibold text-almost-black-green/65">
                              Respond in Requests
                            </span>
                          ) : state === 'outgoing' ? (
                            <span className="text-xs font-semibold text-almost-black-green/60">Request sent</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSendRequest(user)}
                              disabled={sendingRequestTo.has(user.id)}
                              className="inline-flex items-center gap-2 rounded-xl border border-soft-ivory px-3 py-2 text-xs font-semibold text-deep-red disabled:cursor-wait disabled:opacity-70"
                            >
                              {sendingRequestTo.has(user.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                              Connect
                            </button>
                          )}
                        </div>
                      );
                    })}
              </div>
            ) : tab === 'friends' ? (
              <div className="space-y-2 rounded-2xl bg-warm-light-grey/35">
                {connectedContacts.length === 0 ? (
                  <p className="text-sm text-almost-black-green/60">You do not have any accepted friends yet.</p>
                ) : (
                  connectedContacts.map((contact) => (
                    <div key={contact.userId} className="flex items-center justify-between gap-3 rounded-2xl border border-soft-ivory bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(17,27,33,0.06)]">
                      <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar user={getContactAvatarUser(contact)} size={36} />
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
            ) : tab === 'group' ? (
              <div className="mx-auto w-full max-w-2xl space-y-3">
                <div className="rounded-2xl border border-soft-ivory bg-white p-4 shadow-[0_8px_24px_rgba(38,22,22,0.05)]">
                  <h3 className="text-sm font-semibold text-deep-red">Create a group conversation</h3>
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.12em] text-almost-black-green/70">Group name</label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Security Council Drafting"
                        className="mt-1 w-full rounded-xl border border-soft-ivory bg-warm-light-grey px-3 py-2.5 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.12em] text-almost-black-green/70">Add people</label>
                      <div className="relative mt-2">
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
                          className={sharedSearchInputClassName}
                          style={{ paddingLeft: '30px' }}
                        />
                      </div>

                      {(isSearching && canSearch) || (!isSearching && hasSearched && canSearch) ? (
                        <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-soft-ivory bg-warm-light-grey/20 p-2">
                          {isSearching ? (
                            <div className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 text-xs text-almost-black-green/60">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Searching delegates...
                            </div>
                          ) : null}

                          {!isSearching && hasSearched && canSearch && !results.length && !error ? (
                            <p className="rounded-lg bg-white px-2.5 py-2 text-xs text-almost-black-green/60">No delegates found.</p>
                          ) : null}

                          {!isSearching &&
                            results.map((user) => {
                              const isSelected = selected.some((item) => item.id === user.id);
                              const delegationLabel = getUserDelegationLabel(user) || user.email || 'No delegation listed';
                              return (
                                <button
                                  key={user.id}
                                  type="button"
                                  onClick={() => toggleSelect(user)}
                                  className={`group flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-sm transition ${
                                    isSelected
                                      ? 'border-deep-red/40 bg-soft-rose/40'
                                      : 'border-soft-ivory bg-white hover:border-deep-red/30 hover:bg-soft-rose/20'
                                  }`}
                                >
                                  <div className="flex min-w-0 items-center gap-2.5">
                                    <UserAvatar user={user} size={32} />
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-deep-red">{user.full_name}</p>
                                      <p className="truncate text-xs text-almost-black-green/60">{delegationLabel}</p>
                                    </div>
                                  </div>
                                  {isSelected ? (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-deep-red">
                                      <BadgeCheck className="h-3.5 w-3.5" /> Added
                                    </span>
                                  ) : (
                                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-soft-ivory bg-white text-deep-red transition group-hover:scale-105 group-hover:border-deep-red/40 group-hover:bg-soft-rose/35">
                                      <Plus className="h-3.5 w-3.5" />
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 rounded-2xl border border-soft-ivory bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-almost-black-green/60">Selected members ({selected.length})</p>
                  {selected.length === 0 ? (
                    <p className="text-xs text-almost-black-green/60">No members selected yet.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {selected.map((user) => {
                        const delegationLabel = getUserDelegationLabel(user) || user.email || 'No delegation listed';
                        return (
                          <div key={user.id} className="flex items-center justify-between gap-2 rounded-xl border border-soft-ivory bg-warm-light-grey/35 px-2.5 py-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <UserAvatar user={user} size={28} />
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-deep-red">{user.full_name}</p>
                                <p className="truncate text-[11px] text-almost-black-green/60">{delegationLabel}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleSelect(user)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-soft-ivory bg-white/95 text-almost-black-green/60 transition hover:border-deep-red/30 hover:bg-soft-rose/35 hover:text-deep-red"
                              aria-label={`Remove ${user.full_name}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-soft-ivory bg-warm-light-grey/35 p-3">
                  <p className="text-xs text-almost-black-green/65">Group requires a name and at least 2 other members.</p>
                  <button
                    type="button"
                    onClick={handleCreateGroup}
                    disabled={isCreatingGroup || !name.trim() || selected.length < 2}
                    className="inline-flex items-center gap-2 rounded-xl bg-deep-red px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-deep-red/90 disabled:cursor-not-allowed disabled:bg-deep-red/35 disabled:text-white/80 disabled:shadow-none background-deep-red"
                  >
                    {isCreatingGroup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                    {isCreatingGroup ? 'Creating group...' : 'Create group'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <section className="rounded-2xl border border-soft-ivory bg-white p-4 shadow-[0_8px_24px_rgba(38,22,22,0.05)]">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-deep-red">Incoming requests</h3>
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#c62828] px-2 text-xs font-semibold text-white">
                      {incomingRequestsList.length}
                    </span>
                  </div>

                  {incomingRequestsList.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-xl border border-dashed border-soft-ivory bg-warm-light-grey/30 px-3 py-3 text-sm text-almost-black-green/65">
                      <Inbox className="h-4 w-4 text-almost-black-green/50" />
                      <p>No incoming requests right now.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {incomingRequestsList.map((req) => {
                        const displayName = getRequestDisplayName(req.sender_id, req.sender);
                        const metadata = getRequestMetaLine(req.sender);
                        const initials =
                          displayName
                            .split(' ')
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((part) => part[0]?.toUpperCase())
                            .join('') || '?';

                        return (
                          <div key={req.id} className="rounded-xl border border-soft-ivory bg-warm-light-grey/20 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex items-center gap-3">
                                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-soft-ivory bg-white text-xs font-semibold text-deep-red">
                                  {initials}
                                </span>
                                <div className="min-w-0 space-y-0.5">
                                  <p className="truncate text-sm font-semibold text-deep-red">{displayName}</p>
                                  {metadata ? <p className="truncate text-xs text-almost-black-green/60">{metadata}</p> : null}
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleAcceptRequest(req)}
                                  disabled={respondingTo === req.id}
                                  className="inline-flex items-center gap-1 rounded-lg bg-[#701e1e] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#8b2424] disabled:cursor-wait disabled:opacity-70"
                                >
                                  {respondingTo === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeclineRequest(req.id)}
                                  disabled={respondingTo === req.id}
                                  className="rounded-lg border border-soft-ivory bg-white px-3 py-1.5 text-xs font-semibold text-almost-black-green/70 hover:border-deep-red/30 hover:text-deep-red disabled:cursor-wait disabled:opacity-70"
                                >
                                  Decline
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-soft-ivory/90 bg-warm-light-grey/35 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-almost-black-green/65">Sent requests</h3>
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-soft-ivory bg-white px-1.5 text-[11px] font-semibold text-almost-black-green/70">
                      {sentRequestsList.length}
                    </span>
                  </div>

                  {sentRequestsList.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-lg px-1 py-2 text-xs text-almost-black-green/60">
                      <Clock3 className="h-3.5 w-3.5" />
                      <p>No pending sent requests.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sentRequestsList.map((req) => (
                        <div key={req.id} className="flex items-center justify-between rounded-lg border border-soft-ivory/80 bg-white/80 px-3 py-2">
                          <p className="truncate text-sm text-deep-red">{getRequestDisplayName(req.receiver_id, req.receiver)}</p>
                          <span className="rounded-full bg-soft-ivory px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-almost-black-green/60">
                            Awaiting response
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
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
