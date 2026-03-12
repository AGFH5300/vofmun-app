// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { BadgeCheck, Check, Clock3, Inbox, Loader2, MessageCirclePlus, Plus, Search, UserPlus, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { FriendRequest, UserSearchResult } from '@/lib/chat/types';
import { getUserDelegationLabel } from '@/lib/chat/delegation';
import UserAvatar from './UserAvatar';
import { useChat } from '../context/ChatContext';

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
  const [description, setDescription] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

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
    console.debug('[GroupCreateDebug] create_group_payload', {
      name: trimmedName,
      memberIds,
      memberCount: memberIds.length,
    });
    const room = await createGroupRoom({ name: trimmedName, description: description.trim(), memberIds });
    setIsCreatingGroup(false);
    console.debug('[GroupCreateDebug] create_group_result', {
      roomId: room?.id || null,
      roomType: room?.room_type || null,
      selectedMemberIds: memberIds,
    });
    if (!room) return;
    await selectRoom(room);
    onClose();
  };

  const tabOptions: Array<{ key: typeof tab; label: string }> = [
    { key: 'direct', label: 'Direct' },
    { key: 'group', label: 'Group' },
    { key: 'friends', label: 'Friends' },
    { key: 'requests', label: 'Requests' },
  ];

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, tabKey: typeof tab) => {
    const currentIndex = tabOptions.findIndex((option) => option.key === tabKey);
    if (currentIndex < 0) return;

    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (currentIndex + direction + tabOptions.length) % tabOptions.length;
      const nextTab = tabOptions[nextIndex];
      setTab(nextTab.key);
      document.getElementById(`new-conversation-tab-${nextTab.key}`)?.focus();
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const nextTab = event.key === 'Home' ? tabOptions[0] : tabOptions[tabOptions.length - 1];
      setTab(nextTab.key);
      document.getElementById(`new-conversation-tab-${nextTab.key}`)?.focus();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-deep-red/38" aria-hidden="true" />
      <div className="fixed inset-0 flex items-start justify-center overflow-y-auto px-4 py-10 md:items-center md:px-8">
        <Dialog.Panel className="w-full max-w-3xl rounded-[2rem] border border-soft-rose bg-white p-6 shadow-[0_34px_80px_rgba(77,20,20,0.26),0_14px_36px_rgba(77,20,20,0.14)] transition-all duration-300 md:p-8">
          <div className="flex items-start justify-between gap-5">
            <div className="space-y-1.5">
              <Dialog.Title className="font-serif text-3xl font-semibold text-deep-red">New conversation</Dialog.Title>
              <p className="text-sm text-almost-black-green/80">Search delegates, connect, and open chats.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-soft-rose bg-pure-white text-almost-black-green/70 transition-colors hover:bg-soft-rose/55 hover:text-deep-red"
              aria-label="Close new conversation modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-6 space-y-5">
            <div className="inline-flex rounded-full border border-soft-rose bg-primary-peach/80 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]" role="tablist" aria-label="Conversation tabs">
              {tabOptions.map((option) => {
                const active = tab === option.key;
                return (
                  <button
                    id={`new-conversation-tab-${option.key}`}
                    key={option.key}
                    type="button"
                    role="tab"
                    aria-controls={`new-conversation-panel-${option.key}`}
                    aria-selected={active}
                    tabIndex={active ? 0 : -1}
                    onClick={() => setTab(option.key)}
                    onKeyDown={(event) => handleTabKeyDown(event, option.key)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                      active
                        ? 'border border-soft-rose bg-pure-white text-deep-red shadow-[0_4px_14px_rgba(112,30,30,0.14)]'
                        : 'text-almost-black-green/80 hover:text-deep-red'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {tab === 'direct' ? (
              <div id="new-conversation-panel-direct" role="tabpanel" aria-labelledby="new-conversation-tab-direct" className="space-y-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-almost-black-green/60" />
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
                    className="w-full rounded-2xl border border-soft-rose bg-pure-white py-3 pl-10 pr-4 text-sm text-deep-red placeholder:text-almost-black-green/60 focus:border-deep-red/55 focus:outline-none focus:ring-2 focus:ring-deep-red/20"
                  />
                </div>

                {acceptedConnection && (
                  <div className="rounded-2xl border border-soft-rose bg-primary-peach/75 p-3.5">
                    <p className="text-sm font-semibold text-deep-red">You and {acceptedConnection.name} are now connected.</p>
                    <p className="mt-1 text-xs text-almost-black-green/80">Start a chat with your new friend now.</p>
                    <button
                      type="button"
                      onClick={() => handleStartChat({ id: acceptedConnection.userId, full_name: acceptedConnection.name })}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl bg-deep-red px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-dark-burgundy"
                    >
                      <MessageCirclePlus className="h-4 w-4" /> Start chat
                    </button>
                  </div>
                )}

                {isSearching && canSearch && <p className="text-sm text-almost-black-green/65">Searching...</p>}
                {!isSearching && !canSearch && (
                  <div className="rounded-2xl border border-dashed border-soft-rose bg-pure-white px-4 py-8 text-center">
                    <p className="text-sm text-almost-black-green/75">Start typing a name or email to search.</p>
                  </div>
                )}
                {!isSearching && hasSearched && canSearch && !results.length && !error && <p className="text-sm text-almost-black-green/75">No people found.</p>}

                <div className="space-y-2">
                  {results.map((user) => {
                    const relationship = relationshipState(user.id);
                    const delegationLabel = getUserDelegationLabel(user);
                    const state = relationship.type;
                    return (
                      <div
                        key={user.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-soft-rose bg-pure-white px-3.5 py-2.5 transition-colors hover:border-deep-red/30"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <UserAvatar user={user} size={36} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-deep-red">{user.full_name}</p>
                            {delegationLabel && <p className="truncate text-xs text-almost-black-green/75">{delegationLabel}</p>}
                          </div>
                        </div>

                        {state === 'connected' ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary-peach px-3 py-1.5 text-xs font-semibold text-deep-red">
                              <BadgeCheck className="h-3.5 w-3.5 text-rich-gold" /> In friends
                            </span>
                            <button
                              type="button"
                              onClick={() => handleStartChat(user)}
                              disabled={openingChatFor === user.id}
                              className="inline-flex items-center rounded-xl bg-deep-red px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-dark-burgundy disabled:cursor-wait disabled:opacity-70"
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
                              className="inline-flex items-center gap-1 rounded-lg bg-deep-red px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-dark-burgundy disabled:cursor-wait disabled:opacity-70"
                            >
                              {respondingTo === relationship.request.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3 w-3" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeclineRequest(relationship.request.id)}
                              disabled={respondingTo === relationship.request.id}
                              className="rounded-lg border border-soft-rose bg-pure-white px-2.5 py-1.5 text-xs font-semibold text-deep-red transition-colors hover:border-deep-red/40 disabled:cursor-wait disabled:opacity-70"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : state === 'outgoing' ? (
                          <span className="text-xs font-semibold text-almost-black-green/75">Request sent</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSendRequest(user)}
                            disabled={sendingRequestTo.has(user.id)}
                            className="inline-flex items-center gap-2 rounded-xl border border-soft-rose bg-pure-white px-3 py-1.5 text-xs font-semibold text-deep-red transition-colors hover:border-deep-red/45 disabled:cursor-wait disabled:opacity-70"
                          >
                            {sendingRequestTo.has(user.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                            Connect
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : tab === 'friends' ? (
              <div id="new-conversation-panel-friends" role="tabpanel" aria-labelledby="new-conversation-tab-friends" className="space-y-2.5">
                {connectedContacts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-soft-rose bg-pure-white px-4 py-8 text-center text-sm text-almost-black-green/75">
                    You do not have any accepted friends yet.
                  </div>
                ) : (
                  connectedContacts.map((contact) => (
                    <div
                      key={contact.userId}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-soft-rose bg-pure-white px-3.5 py-2.5 transition-colors hover:border-deep-red/30"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar user={{ id: contact.userId, full_name: contact.name, ...(contact.user || {}) }} size={36} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-deep-red">{contact.name}</p>
                          {getUserDelegationLabel(contact.user) ? (
                            <p className="truncate text-xs text-almost-black-green/75">{getUserDelegationLabel(contact.user)}</p>
                          ) : (
                            <p className="truncate text-xs text-almost-black-green/65">Connected contact</p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleStartChat({ id: contact.userId, full_name: contact.name })}
                        disabled={openingChatFor === contact.userId}
                        className="inline-flex items-center gap-2 rounded-xl bg-deep-red px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-dark-burgundy disabled:cursor-wait disabled:opacity-70"
                      >
                        {openingChatFor === contact.userId ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCirclePlus className="h-4 w-4" />}
                        Start chat
                      </button>
                    </div>
                  ))
                )}
              </div>
            ) : tab === 'group' ? (
              <div id="new-conversation-panel-group" role="tabpanel" aria-labelledby="new-conversation-tab-group" className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-almost-black-green">Group name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-2xl border border-soft-rose bg-pure-white px-4 py-2.5 text-sm text-deep-red focus:border-deep-red/55 focus:outline-none focus:ring-2 focus:ring-deep-red/20"
                  />
                </div>

                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description (optional)"
                  className="min-h-24 w-full rounded-2xl border border-soft-rose bg-pure-white px-4 py-2.5 text-sm text-deep-red placeholder:text-almost-black-green/60 focus:border-deep-red/55 focus:outline-none focus:ring-2 focus:ring-deep-red/20"
                />

                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-almost-black-green/60" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search people to add"
                    className="w-full rounded-2xl border border-soft-rose bg-pure-white py-3 pl-10 pr-4 text-sm text-deep-red placeholder:text-almost-black-green/60 focus:border-deep-red/55 focus:outline-none focus:ring-2 focus:ring-deep-red/20"
                  />
                </div>

                <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                  {results.map((user) => {
                    const isSelected = selected.some((item) => item.id === user.id);
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => toggleSelect(user)}
                        className={`flex w-full items-center justify-between rounded-2xl border px-3.5 py-2.5 text-left transition-colors ${
                          isSelected ? 'border-deep-red/45 bg-soft-rose/60' : 'border-soft-rose bg-pure-white hover:border-deep-red/30'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <UserAvatar user={user} size={34} />
                          <span className="truncate text-sm font-semibold text-deep-red">{user.full_name}</span>
                        </div>
                        <Plus className={`h-4 w-4 ${isSelected ? 'rotate-45 text-deep-red' : 'text-almost-black-green/80'} transition-transform`} />
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-2">
                  {selected.length === 0 ? (
                    <p className="rounded-full border border-dashed border-soft-rose px-3 py-1 text-xs text-almost-black-green/75">No members selected yet.</p>
                  ) : (
                    selected.map((user) => (
                      <span key={user.id} className="inline-flex items-center gap-2 rounded-full border border-soft-rose bg-primary-peach/85 px-3 py-1 text-xs font-semibold text-deep-red">
                        {user.full_name}
                        <button type="button" onClick={() => toggleSelect(user)} className="rounded-full bg-pure-white p-0.5 text-deep-red">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleCreateGroup}
                  disabled={isCreatingGroup}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-deep-red px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-dark-burgundy disabled:cursor-wait disabled:opacity-70"
                >
                  {isCreatingGroup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                  {isCreatingGroup ? 'Creating group...' : 'Create group'}
                </button>
              </div>
            ) : (
              <div id="new-conversation-panel-requests" role="tabpanel" aria-labelledby="new-conversation-tab-requests" className="space-y-5">
                <section className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-deep-red">Incoming requests</h3>
                    <span className="inline-flex min-w-6 items-center justify-center rounded-full border border-soft-rose bg-pure-white px-2 py-0.5 text-xs font-semibold text-deep-red">
                      {incomingRequestsList.length}
                    </span>
                  </div>

                  {incomingRequestsList.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-2xl border border-dashed border-soft-rose bg-pure-white px-4 py-3 text-sm text-almost-black-green/75">
                      <Inbox className="h-4 w-4 text-almost-black-green/60" />
                      <p>No incoming requests right now.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
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
                          <div
                            key={req.id}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-soft-rose bg-pure-white px-3.5 py-2.5 transition-colors hover:border-deep-red/30"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-soft-rose bg-primary-peach/80 text-xs font-semibold text-deep-red">
                                {initials}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-deep-red">{displayName}</p>
                                {metadata ? <p className="truncate text-xs text-almost-black-green/75">{metadata}</p> : null}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleAcceptRequest(req)}
                                disabled={respondingTo === req.id}
                                className="inline-flex items-center gap-1 rounded-lg bg-deep-red px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-dark-burgundy disabled:cursor-wait disabled:opacity-70"
                              >
                                {respondingTo === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                Accept
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeclineRequest(req.id)}
                                disabled={respondingTo === req.id}
                                className="rounded-lg border border-soft-rose bg-pure-white px-3 py-1.5 text-xs font-semibold text-almost-black-green/85 transition-colors hover:border-deep-red/45 hover:text-deep-red disabled:cursor-wait disabled:opacity-70"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-deep-red">Sent requests</h3>
                    <span className="inline-flex min-w-6 items-center justify-center rounded-full border border-soft-rose bg-pure-white px-2 py-0.5 text-xs font-semibold text-deep-red">
                      {sentRequestsList.length}
                    </span>
                  </div>

                  {sentRequestsList.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-2xl border border-dashed border-soft-rose bg-pure-white px-4 py-3 text-sm text-almost-black-green/75">
                      <Clock3 className="h-4 w-4 text-almost-black-green/60" />
                      <p>No pending sent requests.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sentRequestsList.map((req) => (
                        <div key={req.id} className="flex items-center justify-between rounded-2xl border border-soft-rose bg-pure-white px-3.5 py-2.5">
                          <p className="truncate text-sm font-semibold text-deep-red">{getRequestDisplayName(req.receiver_id, req.receiver)}</p>
                          <span className="rounded-full border border-soft-rose bg-primary-peach/80 px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-almost-black-green/80">
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

          {error && <p className="mt-4 text-sm text-deep-red/80">{error}</p>}
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default NewConversationModal;
