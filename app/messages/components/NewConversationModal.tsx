// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { ArrowRight, BadgeCheck, Check, Loader2, MessageCirclePlus, Plus, Search, UserPlus, Users, X } from 'lucide-react';
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

  const [selected, setSelected] = useState<UserSearchResult[]>([]);
  const [name, setName] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const trimmedQuery = query.trim();
  const canSearch = trimmedQuery.length >= 2;
  const sharedSearchInputClassName =
    'w-full rounded-t-md border-b-2 border-transparent bg-[#f4f3f3] py-4 pl-12 pr-4 text-base text-[#1a1c1c] placeholder:text-[#564240]/70 focus:border-[#6E1D1B] focus:outline-none focus:ring-0';

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
    <Dialog open={open} onClose={onClose} className="relative z-[110]" style={{ fontFamily: 'var(--font-manrope), Manrope, ui-sans-serif, system-ui' }}>
      <div className="fixed inset-0 bg-[rgba(26,28,28,0.4)] backdrop-blur-[4px]" aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <Dialog.Panel className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-[0_16px_48px_rgba(26,28,28,0.12)]">
          <div className="bg-[#f9f9f9] px-5 pt-5 pb-0 sm:px-8 sm:pt-6 sm:pb-0">
          <div className="flex items-center justify-between gap-4">
              <Dialog.Title className="mb-0 pb-0 text-3xl font-semibold leading-tight text-[#6E1D1B] sm:text-[34px]" style={{ fontFamily: 'var(--font-newsreader), Newsreader, Georgia, serif', fontStyle: 'normal' }}>Initiate Communication</Dialog.Title>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-full p-2 text-[#564240]/70 transition-colors hover:bg-[#e2e2e2] hover:text-[#6E1D1B]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          </div>
          <div className="flex justify-center bg-[#f9f9f9] px-5 pb-4 pt-3 sm:px-8">
            <div className="inline-flex space-x-1 rounded-lg border border-[#dcc0bd]/15 bg-[#f4f3f3] p-1">
              {(['direct', 'group', 'friends', 'requests'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={`rounded-md px-5 py-2 text-sm font-semibold transition-colors ${
                    tab === value ? 'bg-white text-[#6E1D1B] shadow-sm' : 'text-[#564240] hover:bg-[#e2e2e2] hover:text-[#6E1D1B]'
                  }`}
                >
                  {value === 'direct' ? 'Direct' : value === 'group' ? 'Group' : value === 'friends' ? 'Friends' : 'Requests'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-white px-5 py-5 sm:px-8 sm:py-6">
            {tab === 'direct' ? (
              <div className="space-y-6">
                    <div className="group relative mb-8">
                      <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-4 h-5 w-5 text-[#564240]/70 group-focus-within:text-[#6E1D1B]" />
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
                        placeholder="Search delegates by name, country, or email..."
                        className={sharedSearchInputClassName}
                        
                      />
                    </div>

                    <h3 className="pl-2 text-xs font-bold uppercase tracking-[0.05em] text-[#564240]/80">Suggested Delegates</h3>
                    {isSearching && canSearch && <p className="rounded-lg bg-[#f9f9f9] p-4 text-sm text-almost-black-green/60">Searching...</p>}
                    {!isSearching && !canSearch && <p className="rounded-lg bg-[#f9f9f9] p-4 text-sm text-almost-black-green/60">Start typing a name or email to search delegates.</p>}
                    {!isSearching && hasSearched && canSearch && !results.length && !error && <p className="rounded-lg bg-[#f9f9f9] p-4 text-sm text-almost-black-green/60">No delegates found.</p>}

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {results.map((user) => {
                      const relationship = relationshipState(user.id);
                      const delegationLabel = getUserDelegationLabel(user);
                      const state = relationship.type;
                      return (
                        <div key={user.id} className="group rounded-lg bg-[#f9f9f9] p-4 transition-colors hover:bg-[#e2e2e2]">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center">
                              <div className="mr-4">
                                <UserAvatar user={user} size={48} />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-base font-semibold text-[#1a1c1c]">{user.full_name}</p>
                                {delegationLabel && <p className="mt-0.5 truncate text-sm text-[#564240]">{delegationLabel}</p>}
                                {!delegationLabel && user.email ? <p className="mt-0.5 truncate text-sm text-[#564240]">{user.email}</p> : null}
                              </div>
                            </div>
                            {state === 'connected' ? (
                              <button
                                type="button"
                                onClick={() => handleStartChat(user)}
                                disabled={openingChatFor === user.id}
                                className="inline-flex items-center gap-1 rounded-lg bg-[#6E1D1B] px-3 py-2 text-xs font-semibold text-white disabled:cursor-wait disabled:opacity-70"
                              >
                                {openingChatFor === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                                Chat
                              </button>
                            ) : state === 'incoming' ? (
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#564240]">Respond in Requests</span>
                            ) : state === 'outgoing' ? (
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#564240]">Pending</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSendRequest(user)}
                                disabled={sendingRequestTo.has(user.id)}
                                className="inline-flex items-center gap-2 rounded-lg border border-soft-ivory bg-white px-3 py-2 text-xs font-semibold text-deep-red disabled:cursor-wait disabled:opacity-70"
                              >
                                {sendingRequestTo.has(user.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                                Connect
                              </button>
                            )}
                          </div>
                          {state === 'connected' ? <ArrowRight className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6E1D1B] opacity-0 transition-opacity group-hover:opacity-100" /> : null}
                        </div>
                      );
                    })}
                    </div>
              </div>
            ) : tab === 'friends' ? (
              <div className="space-y-6">
                <div className="group relative mb-8">
                  <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-4 h-5 w-5 text-[#564240]/70 group-focus-within:text-[#6E1D1B]" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search friends..." className={sharedSearchInputClassName} />
                </div>
                <h3 className="pl-2 text-xs font-bold uppercase tracking-[0.05em] text-[#564240]/80">My Friends</h3>
                {connectedContacts.length === 0 ? (
                  <p className="rounded-lg bg-[#f9f9f9] p-4 text-sm text-almost-black-green/60">You do not have any accepted friends yet.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {connectedContacts
                    .filter((contact) => contact.name.toLowerCase().includes(query.toLowerCase()))
                    .map((contact) => (
                    <div key={contact.userId} className="group flex items-center justify-between gap-3 rounded-lg bg-[#f9f9f9] p-4 transition-colors hover:bg-[#e2e2e2]">
                      <div className="flex min-w-0 items-center">
                        <div className="mr-4"><UserAvatar user={getContactAvatarUser(contact)} size={48} /></div>
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-[#1a1c1c]">{contact.name}</p>
                          {getUserDelegationLabel(contact.user) ? (
                            <p className="mt-0.5 truncate text-sm text-[#564240]">{getUserDelegationLabel(contact.user)}</p>
                          ) : (
                            <p className="mt-0.5 truncate text-sm text-[#564240]">Friend</p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleStartChat({ id: contact.userId, full_name: contact.name })}
                        disabled={openingChatFor === contact.userId}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#6E1D1B] px-3 py-2 text-xs font-semibold text-white disabled:cursor-wait disabled:opacity-70"
                      >
                        {openingChatFor === contact.userId ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCirclePlus className="h-4 w-4" />}
                        Chat
                      </button>
                    </div>
                  ))}
                  </div>
                )}
              </div>
            ) : tab === 'group' ? (
              <div className="space-y-6">
                  <div className="space-y-6">
                    <div className="group relative mb-8">
                      <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-4 h-5 w-5 text-[#564240]/70 group-focus-within:text-[#6E1D1B]" />
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
                        placeholder="Search by name, delegation, or role"
                        className={sharedSearchInputClassName}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="pl-2 text-xs font-bold uppercase tracking-[0.05em] text-[#564240]/80">Group Name</label>
                      <div className="rounded-lg bg-[#f9f9f9] p-4">
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Enter group name..."
                          className="w-full border-none bg-transparent p-0 text-sm focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <h3 className="pl-2 text-xs font-bold uppercase tracking-[0.05em] text-[#564240]/80">Available Delegates</h3>

                      {(isSearching && canSearch) || (!isSearching && hasSearched && canSearch) ? (
                        <div className="mt-2 grid max-h-48 grid-cols-1 gap-4 overflow-y-auto md:grid-cols-2">
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
                                className={`group flex w-full items-center justify-between rounded-lg p-4 text-left text-sm transition-colors ${
                                    isSelected
                                      ? 'bg-[#e2e2e2]'
                                      : 'bg-[#f9f9f9] hover:bg-[#e2e2e2]'
                                  }`}
                                >
                                  <div className="flex min-w-0 items-center gap-2.5">
                                    <UserAvatar user={user} size={48} />
                                    <div className="min-w-0">
                                      <p className="truncate text-base font-semibold text-[#1a1c1c]">{user.full_name}</p>
                                      <p className="mt-0.5 truncate text-sm text-[#564240]">{delegationLabel}</p>
                                    </div>
                                  </div>
                                  {isSelected ? (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-deep-red">
                                      <BadgeCheck className="h-3.5 w-3.5" /> Added
                                    </span>
                                  ) : (
                                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#6E1D1B]">
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

                <div className="space-y-3">
                  <div className="flex items-center gap-2 pl-2">
                    <p className="text-xs font-bold uppercase tracking-[0.05em] text-[#564240]/80">Selected Members</p>
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-semibold text-almost-black-green/70">{selected.length}</span>
                  </div>
                  {selected.length === 0 ? (
                    <p className="rounded-lg bg-[#f9f9f9] p-4 text-sm text-almost-black-green/60">No members selected yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {selected.map((user) => {
                        const delegationLabel = getUserDelegationLabel(user) || user.email || 'No delegation listed';
                        return (
                            <div key={user.id} className="flex items-center justify-between gap-2 rounded-lg bg-[#f9f9f9] p-4 transition-colors hover:bg-[#e2e2e2]">
                              <div className="flex min-w-0 items-center gap-2">
                                <UserAvatar user={user} size={48} />
                              <div className="min-w-0">
                                <p className="truncate text-base font-semibold text-[#1a1c1c]">{user.full_name}</p>
                                <p className="mt-0.5 truncate text-sm text-[#564240]">{delegationLabel}</p>
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

                <div className="flex items-center justify-end gap-4 border-t border-[#dcc0bd]/15 bg-[#f9f9f9] p-8">
                  <button type="button" onClick={onClose} className="rounded-lg border border-[#dcc0bd]/30 bg-white px-4 py-2 text-sm font-semibold text-[#564240]">Cancel</button>
                  <button
                    type="button"
                    onClick={handleCreateGroup}
                    disabled={isCreatingGroup || !name.trim() || selected.length < 2}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#6E1D1B] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#6E1D1B]/35 disabled:text-white/80"
                  >
                    {isCreatingGroup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                    {isCreatingGroup ? 'Creating group...' : 'Create group'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <section className="space-y-4">
                  <h3 className="pl-2 text-xs font-bold uppercase tracking-[0.05em] text-[#564240]/80">Incoming Requests</h3>

                  {incomingRequestsList.length === 0 ? (
                    <p className="rounded-lg bg-[#f9f9f9] p-4 text-sm text-almost-black-green/60">No incoming requests right now.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                          <div key={req.id} className="group flex items-center rounded-lg bg-[#f9f9f9] p-4 transition-colors hover:bg-[#e8e8e8]">
                            <div className="mr-4 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#e2e2e2] text-sm font-semibold text-[#6E1D1B]">
                              {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="truncate text-base font-semibold text-[#1a1c1c]">{displayName}</h4>
                              {metadata ? <p className="mt-0.5 truncate text-sm text-[#564240]">{metadata}</p> : null}
                            </div>
                            <div className="ml-2 flex shrink-0 items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleAcceptRequest(req)}
                                  disabled={respondingTo === req.id}
                                  className="rounded-full p-1 text-[#500608] hover:bg-[#500608]/10 disabled:cursor-wait disabled:opacity-70"
                                  aria-label={`Accept request from ${displayName}`}
                                >
                                  {respondingTo === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeclineRequest(req.id)}
                                  disabled={respondingTo === req.id}
                                  className="rounded-full p-1 text-[#ba1a1a] hover:bg-[#ba1a1a]/10 disabled:cursor-wait disabled:opacity-70"
                                  aria-label={`Decline request from ${displayName}`}
                                >
                                  <X className="h-4 w-4" />
                                </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="space-y-4">
                  <h3 className="pl-2 text-xs font-bold uppercase tracking-[0.05em] text-[#564240]/80">Sent Requests</h3>

                  {sentRequestsList.length === 0 ? (
                    <p className="rounded-lg bg-[#f9f9f9] p-4 text-sm text-almost-black-green/60">No pending sent requests.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {sentRequestsList.map((req) => {
                        const displayName = getRequestDisplayName(req.receiver_id, req.receiver);
                        const metadata = getRequestMetaLine(req.receiver);
                        const initials =
                          displayName
                            .split(' ')
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((part) => part[0]?.toUpperCase())
                            .join('') || '?';
                        return (
                        <div key={req.id} className="flex items-center rounded-lg bg-[#f9f9f9] p-4 transition-colors hover:bg-[#e8e8e8]">
                          <div className="mr-4 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#eee0d5] text-sm font-semibold text-[#2b231d]">
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="truncate text-base font-semibold text-[#1a1c1c]">{displayName}</h4>
                            {metadata ? <p className="mt-0.5 truncate text-sm text-[#564240]">{metadata}</p> : null}
                          </div>
                          <span className="rounded bg-[#e2e2e2] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#564240]">
                            Pending
                          </span>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>

          {error && <p className="mt-2 px-5 pb-5 text-sm text-deep-red/80 sm:px-8 sm:pb-6">{error}</p>}
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default NewConversationModal;
