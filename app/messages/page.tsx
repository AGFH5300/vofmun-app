"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ParticipantRoute } from "@/components/protectedroute";
import { ChatProvider, useChat } from "./context/ChatContext";
import MessageBubble from "./components/MessageBubble";
import TypingIndicator from "./components/TypingIndicator";
import UserAvatar from "./components/UserAvatar";
import ConversationList from "./components/ConversationList";
import NewConversationModal from "./components/NewConversationModal";
import ConversationDetailsModal from "./components/ConversationDetailsModal";
import {
  ChevronDown,
  MessageSquare,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  SendHorizontal,
  Users,
} from "lucide-react";
import { RoomWithDetails, UserSearchResult } from "@/lib/chat/types";

const formatDateLabel = (dateString: string) => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const formatLastSeenLabel = (lastSeen?: string | null) => {
  if (!lastSeen) return "Offline";
  const timestamp = new Date(lastSeen);
  if (Number.isNaN(timestamp.getTime())) return "Offline";

  const now = new Date();
  const sameDay = now.toDateString() === timestamp.toDateString();
  if (sameDay) {
    return `Last seen today at ${timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (yesterday.toDateString() === timestamp.toDateString()) {
    return `Last seen yesterday at ${timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  return `Last seen ${timestamp.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const ChatShell: React.FC = () => {
  const {
    rooms,
    activeRoom,
    messages,
    selectRoom,
    refreshRooms,
    refreshRoomMessages,
    sendMessage,
    sendTyping,
    typingUsers,
    onlineUsers,
    friendRequests,
    incomingRequests,
    acceptFriendRequest,
    declineFriendRequest,
    togglePin,
    currentUserId,
  } = useChat();

  const [composer, setComposer] = useState("");
  const [search, setSearch] = useState("");
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [conversationTab, setConversationTab] = useState<"direct" | "group">("direct");
  const [sidebarWidth, setSidebarWidth] = useState(360);
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const filteredRooms = useMemo(() => {
    if (!search.trim()) return rooms;
    const q = search.toLowerCase();

    return rooms.filter((room) => {
      const peer =
        room.room_type === "dm"
          ? room.members.find((member) => member.user_id !== currentUserId)?.user
          : null;

      const searchable = [
        room.name,
        peer?.full_name,
        peer?.firstname,
        peer?.lastname,
        peer?.role_title,
        peer?.role,
        peer?.committee,
        peer?.country,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(q);
    });
  }, [rooms, search, currentUserId]);

  const activeMessages = useMemo(
    () => (activeRoom ? messages[activeRoom.id] || [] : []),
    [activeRoom, messages],
  );

  useEffect(() => {
    if (!activeRoom || !messagesContainerRef.current) return;
    const container = messagesContainerRef.current;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const shouldSnapToBottom = distanceFromBottom < 160;

    if (shouldSnapToBottom) {
      container.scrollTop = container.scrollHeight;
    }
  }, [activeMessages.length, activeRoom?.id]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const onScroll = () => {
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      setShowScrollToBottom(distanceFromBottom > 120);
    };

    onScroll();
    container.addEventListener("scroll", onScroll);
    return () => container.removeEventListener("scroll", onScroll);
  }, [activeRoom?.id, activeMessages.length]);

  const handleScrollToBottom = () => {
    messagesContainerRef.current?.scrollTo({
      top: messagesContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    if (!activeRoom?.id) return;

    const interval = window.setInterval(() => {
      refreshRoomMessages(activeRoom.id);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [activeRoom?.id, refreshRoomMessages]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      refreshRooms();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [refreshRooms]);

  const roomTypingNames = useMemo(() => {
    if (!activeRoom) return [] as string[];
    const activeTyping = Array.from(typingUsers[activeRoom.id] || []);
    return activeTyping
      .map(
        (userId) =>
          activeRoom.members.find((m) => m.user_id === userId)?.user?.full_name,
      )
      .filter(Boolean) as string[];
  }, [activeRoom, typingUsers]);

  const handleSend = async () => {
    if (!activeRoom || !composer.trim()) return;
    await sendMessage(activeRoom.id, composer);
    setComposer("");
  };

  const handleSelectRoom = async (room: RoomWithDetails) => {
    await selectRoom(room);
  };

  const timeline = useMemo(() => {
    const sequence: Array<
      { type: "date"; label: string } | { type: "message"; id: string }
    > = [];
    let lastDate: string | null = null;
    activeMessages.forEach((msg) => {
      const dateLabel = msg.created_at ? formatDateLabel(msg.created_at) : "";
      if (dateLabel && dateLabel !== lastDate) {
        sequence.push({ type: "date", label: dateLabel });
        lastDate = dateLabel;
      }
      sequence.push({ type: "message", id: msg.id });
    });
    return sequence;
  }, [activeMessages]);

  const activeTypingDisplay = roomTypingNames.length ? (
    <TypingIndicator names={roomTypingNames} />
  ) : null;

  const activeDmPeer = useMemo(() => {
    if (!activeRoom || activeRoom.room_type !== "dm") return null;
    const me = activeRoom.members.find(
      (member) => member.user_id === currentUserId || member.user?.id === currentUserId,
    );
    return (
      activeRoom.members.find((member) => member.user_id !== me?.user_id) ||
      activeRoom.members.find((member) => member.user_id !== currentUserId) ||
      activeRoom.members[0] ||
      null
    );
  }, [activeRoom, currentUserId]);

  const activeRoomTitle = activeRoom
    ? activeRoom.room_type === "dm"
      ? activeDmPeer?.user?.full_name ||
        `${activeDmPeer?.user?.firstname || ""} ${activeDmPeer?.user?.lastname || ""}`.trim() ||
        activeRoom.name
      : activeRoom.name
    : "Select a conversation";

  const headerSubtitle = activeRoom
    ? activeRoom.room_type === "dm"
      ? onlineUsers.has(activeDmPeer?.user_id || "")
        ? "Online now"
        : formatLastSeenLabel(activeDmPeer?.user?.last_seen)
      : `${activeRoom.members.length} participants`
    : "Choose a conversation to start";

  useEffect(() => {
    if (!isDraggingDivider) return;

    const onMove = (event: MouseEvent) => {
      const next = Math.min(560, Math.max(280, event.clientX - 24));
      setSidebarWidth(next);
    };

    const onUp = () => setIsDraggingDivider(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDraggingDivider]);

  const outgoingRequests = useMemo(
    () =>
      friendRequests.filter(
        (req) => req.sender_id === currentUserId && req.status === "pending",
      ),
    [currentUserId, friendRequests],
  );

  return (
    <div className="page-shell">
      <div className="page-maxwidth space-y-6">
        <section className="surface-card is-emphasised overflow-hidden p-7 md:p-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <span className="badge-pill bg-white/10 text-white">
                Delegate Messaging
              </span>
              <h1 className="!mb-0 text-3xl font-bold text-white md:text-5xl">
                Messaging Hub
              </h1>
              <p className="text-sm text-white/80 md:text-base">
                Keep committee, bloc, and one-on-one communication in one place.
                This redesigned workspace mirrors the look and feel of your main
                dashboard pages while still showing connection requests,
                conversation threads, and live activity.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setConversationTab("direct");
                  setShowNewConversation(true);
                }}
                className="rounded-xl border border-white/40 bg-white/10 px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                New direct chat
              </button>
              <button
                type="button"
                onClick={() => {
                  setConversationTab("group");
                  setShowNewConversation(true);
                }}
                className="rounded-xl border border-white/40 bg-white/10 px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                New group room
              </button>
              <button
                type="button"
                onClick={refreshRooms}
                className="rounded-xl border border-white/40 bg-white/10 px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white backdrop-blur-sm transition hover:bg-white/20 sm:col-span-2"
              >
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" /> Refresh conversations
                </span>
              </button>
            </div>
          </div>
        </section>

        <section className="surface-card flex h-[calc(100vh-190px)] min-h-[640px] min-w-0 overflow-hidden">
          <aside className="flex h-full flex-col overflow-hidden border-r border-soft-ivory" style={{ width: `${sidebarWidth}px` }}>
            <div className="border-b border-soft-ivory px-5 py-4">
              <p className="text-xs uppercase tracking-[0.28em] text-almost-black-green/60">
                Conversations
              </p>
              <p className="text-lg font-semibold text-deep-red">
                {rooms.length} total conversation{rooms.length>1?"s":""}
              </p>
            </div>

            <div className="border-b border-soft-ivory px-5 py-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-almost-black-green/50" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full border-0 bg-transparent py-2.5 pl-12 pr-3 text-sm focus:outline-none"
                  style={{ paddingLeft:"30px" }}
                  placeholder="Search conversations"
                />
              </div>
            </div>

            <div className="border-b border-soft-ivory px-5 py-3">
              <button
                type="button"
                onClick={() => {
                  setConversationTab("direct");
                  setShowNewConversation(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-soft-ivory bg-warm-light-grey px-3 py-2 text-xs font-semibold !text-deep-red shadow-sm hover:border-deep-red/30 hover:bg-soft-ivory"
              >
                <Plus className="h-4 w-4" /> New conversation
              </button>
            </div>

            {incomingRequests.length > 0 && (
              <div className="m-3 space-y-3 rounded-2xl border border-soft-ivory bg-warm-light-grey/70 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.22em] text-almost-black-green/60">
                    Connection requests
                  </p>
                  <span className="rounded-full bg-deep-red/10 px-2 py-1 text-[0.7rem] font-semibold text-deep-red">
                    {incomingRequests.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {incomingRequests.map((req) => {
                    const sender = req.sender;
                    const displayName =
                      sender?.full_name ||
                      `${sender?.firstname || ""} ${sender?.lastname || ""}`.trim() ||
                      req.sender_id;
                    const roleLine = `${sender?.role_title || sender?.role || "Participant"}${sender?.committee ? ` • ${sender.committee}` : ""}${sender?.country ? ` • ${sender.country}` : ""}`;
                    const avatarUser =
                      sender ||
                      ({
                        id: req.sender_id,
                        full_name: displayName,
                        email: sender?.email || "",
                      } as UserSearchResult);

                    const handleAccept = async () => {
                      setRespondingId(req.id);
                      try {
                        await acceptFriendRequest(req.id);
                      } finally {
                        setRespondingId(null);
                      }
                    };

                    const handleDecline = async () => {
                      setRespondingId(req.id);
                      try {
                        await declineFriendRequest(req.id);
                      } finally {
                        setRespondingId(null);
                      }
                    };

                    return (
                      <div
                        key={req.id}
                        className="rounded-2xl border border-soft-ivory bg-white p-3"
                      >
                        <div className="flex items-start gap-3">
                          <UserAvatar user={avatarUser} size={40} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-deep-red">
                              {displayName}
                            </p>
                            <p className="text-xs text-almost-black-green/60">
                              {roleLine}
                            </p>
                            {sender?.email && (
                              <p className="truncate text-xs text-almost-black-green/50">
                                {sender.email}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2 text-xs font-semibold">
                          <button
                            type="button"
                            onClick={handleDecline}
                            disabled={respondingId === req.id}
                            className="flex-1 rounded-xl border border-soft-ivory px-3 py-2 text-deep-red hover:bg-soft-ivory disabled:opacity-60"
                          >
                            Decline
                          </button>
                          <button
                            type="button"
                            onClick={handleAccept}
                            disabled={respondingId === req.id}
                            className="flex-1 rounded-xl bg-[#701e1e] px-3 py-2 text-white shadow-sm hover:bg-[#8b2424] disabled:opacity-60"
                          >
                            Accept
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
              <ConversationList
                rooms={filteredRooms}
                activeRoomId={activeRoom?.id}
                onSelect={handleSelectRoom}
                onTogglePin={togglePin}
                currentUserId={currentUserId}
                onlineUsers={onlineUsers}
                onNewChat={() => {
                  setConversationTab("direct");
                  setShowNewConversation(true);
                }}
                onNewGroup={() => {
                  setConversationTab("group");
                  setShowNewConversation(true);
                }}
              />
            </div>
          </aside>

          <div
            role="separator"
            aria-orientation="vertical"
            onMouseDown={() => setIsDraggingDivider(true)}
            className="hidden w-2 cursor-col-resize bg-soft-ivory/80 transition hover:bg-deep-red/20 lg:block"
          />

          <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <header className="border-b border-soft-ivory px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="!mb-1 text-2xl font-semibold text-deep-red">
                    {activeRoomTitle}
                  </h3>
                  <p
                    className={`text-sm ${
                      activeRoom?.room_type === "dm" && onlineUsers.has(activeDmPeer?.user_id || "")
                        ? "font-medium text-emerald-600"
                        : "text-almost-black-green/70"
                    }`}
                  >
                    {headerSubtitle}
                  </p>
                </div>
                {activeRoom ? (
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {activeRoom.members.map((member) => (
                        <div
                          key={member.id}
                          className="rounded-full border border-white bg-white"
                        >
                          <UserAvatar user={member.user} size={34} />
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDetails(true)}
                      className="rounded-xl border border-soft-ivory p-2 text-almost-black-green/60 hover:text-deep-red"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 rounded-xl border border-soft-ivory bg-warm-light-grey px-3 py-2 text-xs uppercase tracking-[0.12em] text-almost-black-green/60">
                    <MessageSquare className="h-4 w-4" /> Waiting for selection
                  </div>
                )}
              </div>
            </header>

            {(incomingRequests.length > 0 || outgoingRequests.length > 0) && (
              <div className="border-b border-soft-ivory bg-warm-light-grey/35 px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-almost-black-green/60">
                    Friend requests
                  </p>
                  <span className="rounded-full bg-deep-red/10 px-2 py-1 text-[0.7rem] font-semibold text-deep-red">
                    {incomingRequests.length} incoming • {outgoingRequests.length} sent
                  </span>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {incomingRequests.slice(0, 2).map((req) => {
                    const senderName =
                      req.sender?.full_name ||
                      `${req.sender?.firstname || ""} ${req.sender?.lastname || ""}`.trim() ||
                      req.sender_id;

                    return (
                      <div
                        key={req.id}
                        className="rounded-2xl border border-soft-ivory bg-white px-3 py-2"
                      >
                        <p className="text-sm font-semibold text-deep-red">{senderName}</p>
                        <p className="text-xs text-almost-black-green/65">
                          Sent you a connection request.
                        </p>
                      </div>
                    );
                  })}
                  {outgoingRequests.slice(0, 2).map((req) => {
                    const recipientName =
                      req.receiver?.full_name ||
                      `${req.receiver?.firstname || ""} ${req.receiver?.lastname || ""}`.trim() ||
                      req.receiver_id;

                    return (
                      <div
                        key={req.id}
                        className="rounded-2xl border border-soft-ivory bg-white px-3 py-2"
                      >
                        <p className="text-sm font-semibold text-deep-red">{recipientName}</p>
                        <p className="text-xs text-almost-black-green/65">
                          Awaiting response to your connection request.
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="relative flex min-h-0 flex-1 flex-col bg-gradient-to-b from-white via-warm-light-grey/40 to-white">
              <div
                ref={messagesContainerRef}
                className="flex-1 space-y-4 overflow-y-auto px-6 py-5"
              >
                {activeRoom ? (
                  activeMessages.length > 0 ? (
                    timeline.map((item) => {
                      if (item.type === "date") {
                        return (
                          <div
                            key={`date-${item.label}`}
                            className="flex justify-center"
                          >
                            <span className="rounded-full border border-soft-ivory bg-white px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-almost-black-green/60 shadow-sm">
                              {item.label}
                            </span>
                          </div>
                        );
                      }
                      const message = activeMessages.find(
                        (msg) => msg.id === item.id,
                      );
                      if (!message) return null;
                      const isOwn =
                        (currentUserId != null &&
                          String(currentUserId) === String(message.user_id)) ||
                        (currentUserId != null &&
                          String(currentUserId) === String(message.user?.id || ""));
                      return (
                        <MessageBubble
                          key={item.id}
                          message={message}
                          isOwn={isOwn}
                          showAuthor={activeRoom.room_type !== "dm"}
                        />
                      );
                    })
                  ) : (
                    <div className="flex h-full items-center justify-center text-center text-almost-black-green/60">
                      <div className="space-y-2 rounded-2xl border border-dashed border-soft-ivory bg-white/80 px-6 py-5">
                        <Users className="mx-auto text-deep-red/40" size={44} />
                        <p className="font-semibold text-deep-red">No messages yet</p>
                        <p className="text-sm">Break the ice with a quick hello.</p>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex h-full items-center justify-center text-center text-almost-black-green/60">
                    <div className="space-y-2 rounded-2xl border border-dashed border-soft-ivory bg-white/80 px-6 py-5">
                      <Users className="mx-auto text-deep-red/40" size={44} />
                      <p className="font-semibold text-deep-red">
                        Select a conversation
                      </p>
                      <p className="text-sm">
                        Choose a room from the left to view messages.
                      </p>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {activeRoom && (
                <>
                {showScrollToBottom && (
                  <button
                    type="button"
                    onClick={handleScrollToBottom}
                    className="absolute bottom-24 right-6 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-soft-ivory bg-white text-deep-red shadow-md transition hover:bg-soft-ivory"
                    aria-label="Scroll to latest message"
                  >
                    <ChevronDown className="h-5 w-5" />
                  </button>
                )}
                <div className="sticky bottom-0 border-t border-soft-ivory bg-white px-6 py-4">
                  {activeTypingDisplay}
                  <div className="mt-3 flex items-end gap-3">
                    <div className="flex flex-1 items-center rounded-2xl border border-soft-ivory bg-warm-light-grey px-3 transition focus-within:border-deep-red/40 focus-within:ring-2 focus-within:ring-deep-red/20">
                      <textarea
                        value={composer}
                        onChange={(event) => setComposer(event.target.value)}
                        onFocus={() => sendTyping(activeRoom.id, true)}
                        onBlur={() => sendTyping(activeRoom.id, false)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            handleSend();
                          }
                        }}
                        placeholder="Type your message"
                        rows={1}
                        className="max-h-32 min-h-[48px] flex-1 resize-none border-0 bg-transparent py-3 text-sm text-almost-black-green placeholder:text-almost-black-green/45 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSend}
                      className="primary-button !rounded-xl !px-4 !py-3 !text-xs"
                    >
                      <SendHorizontal className="h-4 w-4" /> Send
                    </button>
                  </div>
                </div>
                </>
              )}
            </div>
          </section>
        </section>

        <NewConversationModal
          open={showNewConversation}
          initialTab={conversationTab}
          onClose={() => setShowNewConversation(false)}
        />
        <ConversationDetailsModal
          room={activeRoom}
          open={showDetails}
          onClose={() => setShowDetails(false)}
          currentUserId={currentUserId}
        />
      </div>
    </div>
  );
};

const MessagesPage = () => (
  <ParticipantRoute>
    <ChatProvider>
      <ChatShell />
    </ChatProvider>
  </ParticipantRoute>
);

export default MessagesPage;
