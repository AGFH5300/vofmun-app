// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Dialog } from "@headlessui/react";
import { BadgeCheck, Check, Search, UserPlus, X } from "lucide-react";
import { FriendRequest, UserSearchResult } from "@/lib/chat/types";
import UserAvatar from "./UserAvatar";
import { useChat } from "../context/ChatContext";

interface Props {
  open: boolean;
  onClose: () => void;
  onConversationCreated?: (roomId: string) => void;
}

const NewChatModal: React.FC<Props> = ({
  open,
  onClose,
  onConversationCreated,
}) => {
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
  } = useChat();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const trimmedQuery = query.trim();
  const canSearch = trimmedQuery.length >= 2;

  useEffect(() => {
    if (open) {
      refreshFriendRequests();
    }
  }, [open, refreshFriendRequests]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setError(null);
      setIsSearching(false);
      setHasSearched(false);
      return;
    }
  }, [open]);

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (!canSearch) {
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
        setError("Something went wrong while searching.");
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [canSearch, query, searchUsers, trimmedQuery]);

  const handleStartChat = async (user: UserSearchResult) => {
    setError(null);
    const room = await openDirectMessageRoomForUser(user.id);
    if (!room) {
      setError("Unable to open a direct message room right now.");
      return;
    }
    onConversationCreated?.(room.id);
    onClose();
  };

  const handleSendRequest = async (user: UserSearchResult) => {
    setError(null);
    const result = await sendFriendRequest(user.id);
    if (!result) {
      setError("Unable to send connection request.");
    }
  };

  const relationshipState = useMemo(
    () => (userId: string) => {
      const normalizedCurrentUserId = String(currentUserId || "");
      const normalizedUserId = String(userId);
      const incomingRequest = friendRequests.find(
        (req) =>
          String(req.sender_id) === normalizedUserId &&
          String(req.receiver_id) === normalizedCurrentUserId &&
          req.status === "pending",
      );
      if (incomingRequest)
        return { type: "incoming", request: incomingRequest } as const;

      const outgoingRequest = friendRequests.find(
        (req) =>
          String(req.sender_id) === normalizedCurrentUserId &&
          String(req.receiver_id) === normalizedUserId &&
          req.status === "pending",
      );
      if (outgoingRequest)
        return { type: "outgoing", request: outgoingRequest } as const;

      const acceptedRequest = friendRequests.find(
        (req) =>
          req.status === "accepted" &&
          ((String(req.sender_id) === normalizedCurrentUserId &&
            String(req.receiver_id) === normalizedUserId) ||
            (String(req.sender_id) === normalizedUserId &&
              String(req.receiver_id) === normalizedCurrentUserId)),
      );
      if (acceptedRequest)
        return { type: "connected", request: acceptedRequest } as const;

      return { type: "none", request: null } as const;
    },
    [currentUserId, friendRequests],
  );

  const emptyState = useMemo(
    () => (
      <div className="rounded-2xl border border-dashed border-soft-ivory bg-warm-light-grey/40 px-4 py-8 text-center text-almost-black-green/70">
        <p className="text-sm">Start typing a name or email to search.</p>
      </div>
    ),
    [],
  );

  const incomingRequestsList = useMemo(
    () =>
      incomingRequests.filter(
        (req) => req.receiver_id === currentUserId && req.status === "pending",
      ),
    [currentUserId, incomingRequests],
  );

  const getRequestDisplayName = (
    requestUserId: string,
    requestUser?: FriendRequest["sender"] | null,
  ) => resolveUserDisplay(requestUserId, requestUser);

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-start justify-center overflow-y-auto px-4 py-10">
        <Dialog.Panel className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl">
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="text-xl font-semibold text-deep-red">
                Start a direct message
              </Dialog.Title>
              <p className="text-sm text-almost-black-green/70">
                Find admins, chairs, delegates, or secretariat members by name
                or email.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-sm text-almost-black-green/60 hover:text-deep-red"
            >
              Close
            </button>
          </div>

          <div className="mt-4">
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
                className="w-full rounded-2xl border border-soft-ivory bg-warm-light-grey px-10 py-3 text-sm text-almost-black-green/90 placeholder:text-almost-black-green/50 focus:border-deep-red/40 focus:ring-2 focus:ring-deep-red/20"
              />
            </label>
          </div>

          <div className="mt-4 space-y-3">
            {incomingRequestsList.length > 0 && (
              <div className="space-y-3 rounded-2xl border border-soft-ivory bg-warm-light-grey/40 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-deep-red">
                    Incoming connection requests
                  </p>
                  <span className="text-xs text-almost-black-green/60">
                    {incomingRequestsList.length} pending
                  </span>
                </div>
                {incomingRequestsList.map((req) => {
                  const sender = req.sender;
                  const displayName = getRequestDisplayName(
                    req.sender_id,
                    sender,
                  );
                  const avatarUser =
                    sender ||
                    ({
                      id: req.sender_id,
                      full_name: displayName,
                      email: req.sender?.email || "",
                    } as UserSearchResult);
                  return (
                    <div
                      key={req.id}
                      className="flex items-center justify-between rounded-2xl border border-soft-ivory bg-white px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <UserAvatar user={avatarUser} size={40} />
                        <div>
                          <p className="text-sm font-semibold text-deep-red">
                            {displayName}
                          </p>
                          <p className="text-xs text-almost-black-green/60">
                            {
                              (sender?.role_title ||
                                sender?.role ||
                                "Participant") as string
                            }
                            {sender?.committee ? ` • ${sender.committee}` : ""}
                            {sender?.country ? ` • ${sender.country}` : ""}
                          </p>
                          <p className="text-xs text-almost-black-green/50">
                            {sender?.email || req.sender_id}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 text-sm">
                        <button
                          type="button"
                          onClick={async () => {
                            await acceptFriendRequest(req.id);
                            onClose();
                          }}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#701e1e] px-3 py-2 font-semibold text-white shadow-sm hover:bg-[#8b2424]"
                        >
                          <Check className="h-4 w-4" /> Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => declineFriendRequest(req.id)}
                          className="inline-flex items-center gap-2 rounded-xl border border-soft-ivory px-3 py-2 font-semibold text-deep-red hover:bg-soft-ivory"
                        >
                          <X className="h-4 w-4" /> Decline
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {isSearching && canSearch && (
              <p className="text-sm text-almost-black-green/60">Searching...</p>
            )}
            {!isSearching && !canSearch && emptyState}
            {!isSearching &&
              hasSearched &&
              canSearch &&
              !results.length &&
              !error && (
                <p className="text-sm text-almost-black-green/60">
                  No people found
                </p>
              )}
            {results.map((user) => {
              const relationship = relationshipState(user.id);
              const state =
                relationship.type !== "none"
                  ? relationship.type
                  : user.is_friend
                    ? "connected"
                    : user.has_pending_request
                      ? "outgoing"
                      : "none";

              return (
                <div
                  key={user.id}
                  className="flex items-center justify-between rounded-2xl border border-soft-ivory bg-white px-4 py-3 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar user={user} size={40} />
                    <div>
                      <p className="text-sm font-semibold text-deep-red">
                        {user.full_name}
                      </p>
                      <p className="text-xs text-almost-black-green/60">
                        {user.role_title || user.role || "Participant"}
                        {user.committee ? ` • ${user.committee}` : ""}
                        {user.country ? ` • ${user.country}` : ""}
                      </p>
                      {user.email && (
                        <p className="text-xs text-almost-black-green/50">
                          {user.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 text-sm">
                    {state === "connected" ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-xl border border-soft-ivory bg-warm-light-grey px-3 py-2 font-bold">
                          <BadgeCheck className="h-4 w-4 text-sky-500" /> In
                          friends
                        </span>
                        <button
                          type="button"
                          onClick={() => handleStartChat(user)}
                          className="inline-flex items-center rounded-xl background-deep-red text-white px-3 py-2 font-semibold shadow-sm hover:bg-[#8b2424]"
                        >
                          Start chat
                        </button>
                      </div>
                    ) : state === "incoming" && relationship.request ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await acceptFriendRequest(relationship.request.id);
                            onClose();
                          }}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#701e1e] px-3 py-2 font-semibold text-white shadow-sm hover:bg-[#8b2424]"
                        >
                          <Check className="h-4 w-4" /> Accept
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            declineFriendRequest(relationship.request.id)
                          }
                          className="inline-flex items-center gap-2 rounded-xl border border-soft-ivory px-3 py-2 font-semibold text-deep-red hover:bg-soft-ivory"
                        >
                          <X className="h-4 w-4" /> Decline
                        </button>
                      </div>
                    ) : state === "outgoing" ? (
                      <button
                        type="button"
                        disabled
                        className="inline-flex items-center gap-2 rounded-xl border border-soft-ivory bg-warm-light-grey px-3 py-2 font-semibold text-almost-black-green/60"
                      >
                        <Check className="h-4 w-4" /> Sent
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendRequest(user)}
                        className="inline-flex items-center gap-2 rounded-xl border border-soft-ivory px-3 py-2 font-semibold text-deep-red hover:border-deep-red/40 hover:bg-soft-ivory"
                      >
                        <UserPlus className="h-4 w-4" /> Connect
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {error && <p className="text-sm text-deep-red/80">{error}</p>}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default NewChatModal;
