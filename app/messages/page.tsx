"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ParticipantRoute } from "@/components/protectedroute";
import { useSession } from "@/app/context/sessionContext";
import { toast } from "sonner";
import {
  Crown,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  User
} from "lucide-react";
import type { UserType } from "@/db/types";
import supabase from "@/lib/supabase";

interface Message {
  messageID: string;
  senderID: string;
  senderType: "delegate" | "chair";
  senderName: string;
  receiverID: string;
  receiverType: "delegate" | "chair";
  receiverName: string;
  content: string;
  timestamp: string;
  read: boolean;
}

interface ConversationSummary {
  participantID: string;
  participantName: string;
  participantType: "delegate" | "chair";
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

interface UserIdentity {
  id: string;
  name: string;
  type: "delegate" | "chair" | "admin";
}

const POLL_INTERVAL = 15_000;

const getUserIdentity = (user: UserType | null): UserIdentity => {
  if (!user) {
    return { id: "", name: "", type: "delegate" };
  }

  if ("delegateID" in user) {
    return {
      id: user.delegateID,
      name: `${user.firstname} ${user.lastname}`,
      type: "delegate"
    };
  }

  if ("chairID" in user) {
    return {
      id: user.chairID,
      name: `${user.firstname} ${user.lastname}`,
      type: "chair"
    };
  }

  if ("adminID" in user) {
    return {
      id: user.adminID,
      name: `${user.firstname} ${user.lastname}`,
      type: "admin"
    };
  }

  return { id: "", name: "", type: "delegate" };
};

const MessagesPage = () => {
  const { user } = useSession();
  const identity = useMemo(() => getUserIdentity(user), [user]);

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [showAllDelegateMessages, setShowAllDelegateMessages] = useState(false);
  const [composerValue, setComposerValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isFetchingConversations, setIsFetchingConversations] = useState(false);
  const [isFetchingMessages, setIsFetchingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [committeeID, setCommitteeID] = useState<string | null>(null);
  const pollingHandle = useRef<NodeJS.Timeout | null>(null);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) {
      return conversations;
    }

    const query = searchQuery.toLowerCase();
    return conversations.filter((conversation) =>
      conversation.participantName.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  const activeConversationDetails = useMemo(
    () => conversations.find((conversation) => conversation.participantID === activeConversation) || null,
    [conversations, activeConversation]
  );

  const stopPolling = useCallback(() => {
    if (pollingHandle.current) {
      clearInterval(pollingHandle.current);
      pollingHandle.current = null;
    }
  }, []);

  const createConversationKey = useCallback((userA: string, userB: string) => {
    return userA < userB ? `${userA}::${userB}` : `${userB}::${userA}`;
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!identity.id) {
      return;
    }

    setIsFetchingConversations(true);
    setErrorMessage(null);

    try {
      let committee = committeeID;

      if (!committee) {
        if (identity.type === "delegate") {
          const { data, error } = await supabase
            .from("Delegation")
            .select("committeeID")
            .eq("delegateID", identity.id)
            .single();

          if (error) {
            throw new Error("Unable to load conversations");
          }

          committee = data?.committeeID ?? null;
        } else if (identity.type === "chair") {
          const { data, error } = await supabase
            .from("Committee-Chair")
            .select("committeeID")
            .eq("chairID", identity.id)
            .single();

          if (error) {
            throw new Error("Unable to load conversations");
          }

          committee = data?.committeeID ?? null;
        }
      }

      if (!committee) {
        throw new Error("User committee not found");
      }

      setCommitteeID(committee);

      interface DelegateRecord {
        delegateID: string;
        Delegate: { firstname: string; lastname: string } | null;
      }

      interface ChairRecord {
        chairID: string;
        Chair: { firstname: string; lastname: string } | null;
      }

      const conversationPartners: ConversationSummary[] = [];

      const { data: delegates, error: delegatesError } = await supabase
        .from("Delegation")
        .select(
          `
        delegateID,
        Delegate:delegateID (
          firstname,
          lastname
        )
      `
        )
        .eq("committeeID", committee);

      if (delegatesError) {
        throw new Error("Unable to load conversations");
      }

      if (delegates) {
        for (const delegate of (delegates as DelegateRecord[]).filter(
          (record) => record.delegateID !== identity.id
        )) {
          const delegateName = delegate.Delegate
            ? `${delegate.Delegate.firstname} ${delegate.Delegate.lastname}`
            : "Delegate";
          conversationPartners.push({
            participantID: delegate.delegateID,
            participantName: delegateName,
            participantType: "delegate",
            lastMessage: "",
            lastMessageTime: "",
            unreadCount: 0
          });
        }
      }

      const { data: chairs, error: chairsError } = await supabase
        .from("Committee-Chair")
        .select(
          `
        chairID,
        Chair:chairID (
          firstname,
          lastname
        )
      `
        )
        .eq("committeeID", committee);

      if (chairsError) {
        throw new Error("Unable to load conversations");
      }

      if (chairs) {
        for (const chair of (chairs as ChairRecord[]).filter(
          (record) => record.chairID !== identity.id
        )) {
          const chairName = chair.Chair
            ? `${chair.Chair.firstname} ${chair.Chair.lastname}`
            : "Chair";
          conversationPartners.push({
            participantID: chair.chairID,
            participantName: chairName,
            participantType: "chair",
            lastMessage: "",
            lastMessageTime: "",
            unreadCount: 0
          });
        }
      }

      if (conversationPartners.length === 0) {
        setConversations([]);
        return;
      }

      const conversationKeys = conversationPartners.map((partner) =>
        createConversationKey(identity.id, partner.participantID)
      );

      const lastMessageMap = new Map<string, { content: string; timestamp: string }>();
      const unreadCountMap = new Map<string, number>();

      const { data: lastMessages, error: lastMessagesError } = await supabase
        .from("Message")
        .select("conversationKey, content, timestamp")
        .in("conversationKey", conversationKeys)
        .order("timestamp", { ascending: false });

      if (lastMessagesError) {
        throw new Error("Unable to load conversations");
      }

      if (lastMessages) {
        for (const message of lastMessages) {
          if (!message.conversationKey) continue;
          if (!lastMessageMap.has(message.conversationKey)) {
            lastMessageMap.set(message.conversationKey, {
              content: message.content ?? "No messages yet",
              timestamp: message.timestamp ?? new Date().toISOString()
            });
          }
        }
      }

      const { data: unreadMessages, error: unreadMessagesError } = await supabase
        .from("Message")
        .select("conversationKey")
        .eq("receiverID", identity.id)
        .eq("read", false)
        .in("conversationKey", conversationKeys);

      if (unreadMessagesError) {
        throw new Error("Unable to load conversations");
      }

      if (unreadMessages) {
        for (const message of unreadMessages) {
          if (!message.conversationKey) continue;
          unreadCountMap.set(
            message.conversationKey,
            (unreadCountMap.get(message.conversationKey) || 0) + 1
          );
        }
      }

      const conversationsWithDetails = conversationPartners.map((partner) => {
        const conversationKey = createConversationKey(identity.id, partner.participantID);
        const lastMessage = lastMessageMap.get(conversationKey);
        return {
          ...partner,
          lastMessage: lastMessage?.content || "No messages yet",
          lastMessageTime: lastMessage?.timestamp || new Date().toISOString(),
          unreadCount: unreadCountMap.get(conversationKey) || 0
        } satisfies ConversationSummary;
      });

      conversationsWithDetails.sort((a, b) =>
        new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
      );

      setConversations(conversationsWithDetails);
    } catch (error) {
      console.error("Error fetching conversations", error);
      const message = error instanceof Error ? error.message : "Unable to load conversations";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsFetchingConversations(false);
    }
  }, [identity.id, identity.type, committeeID, createConversationKey]);

  const fetchMessages = useCallback(
    async (participantID: string) => {
      if (!identity.id || !participantID) {
        return;
      }

      setIsFetchingMessages(true);
      setErrorMessage(null);

      try {
        const conversationKey = createConversationKey(identity.id, participantID);

        const { data, error: messagesError } = await supabase
          .from("Message")
          .select("*")
          .eq("conversationKey", conversationKey)
          .order("timestamp", { ascending: true });

        if (messagesError) {
          throw new Error("Unable to load messages");
        }

        setMessages((data as Message[]) || []);

        const { error: markReadError } = await supabase
          .from("Message")
          .update({ read: true })
          .eq("conversationKey", conversationKey)
          .eq("receiverID", identity.id)
          .eq("read", false);

        if (markReadError) {
          console.error("Error marking messages as read", markReadError);
        }
      } catch (error) {
        console.error("Error fetching messages", error);
        const message = error instanceof Error ? error.message : "Unable to load messages";
        setErrorMessage(message);
        toast.error(message);
      } finally {
        setIsFetchingMessages(false);
      }
    },
    [identity.id, createConversationKey]
  );

  const fetchAllDelegateMessages = useCallback(async () => {
    if (identity.type !== "chair") {
      return;
    }

    setIsFetchingMessages(true);
    setErrorMessage(null);

    try {
      let committee = committeeID;

      if (!committee) {
        const { data, error } = await supabase
          .from("Committee-Chair")
          .select("committeeID")
          .eq("chairID", identity.id)
          .single();

        if (error) {
          throw new Error("Unable to load delegate messages");
        }

        committee = data?.committeeID ?? null;
        setCommitteeID(committee ?? null);
      }

      if (!committee) {
        throw new Error("Unable to load delegate messages");
      }

      const { data: delegations, error: delegationsError } = await supabase
        .from("Delegation")
        .select("delegateID")
        .eq("committeeID", committee);

      if (delegationsError) {
        throw new Error("Unable to load delegate messages");
      }

      const delegateIDs = (delegations || [])
        .map((delegation) => delegation.delegateID)
        .filter((id): id is string => Boolean(id));

      if (delegateIDs.length === 0) {
        setMessages([]);
        return;
      }

      const { data, error: delegateMessagesError } = await supabase
        .from("Message")
        .select("*")
        .eq("senderType", "delegate")
        .eq("receiverType", "delegate")
        .in("senderID", delegateIDs)
        .in("receiverID", delegateIDs)
        .order("timestamp", { ascending: true });

      if (delegateMessagesError) {
        throw new Error("Unable to load delegate messages");
      }

      setMessages((data as Message[]) || []);
    } catch (error) {
      console.error("Error fetching delegate messages", error);
      const message = error instanceof Error ? error.message : "Unable to load delegate messages";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsFetchingMessages(false);
    }
  }, [identity.type, identity.id, committeeID]);

  const refreshCurrentView = useCallback(async () => {
    await fetchConversations();

    if (showAllDelegateMessages && identity.type === "chair") {
      await fetchAllDelegateMessages();
      return;
    }

    if (activeConversation) {
      await fetchMessages(activeConversation);
    }
  }, [fetchAllDelegateMessages, fetchConversations, fetchMessages, activeConversation, showAllDelegateMessages, identity.type]);

  const handleSelectConversation = useCallback((participantID: string) => {
    setShowAllDelegateMessages(false);
    setActiveConversation(participantID);
    setComposerValue("");
  }, []);

  const handleToggleAllDelegateMessages = useCallback(async () => {
    if (identity.type !== "chair") {
      return;
    }

    const nextState = !showAllDelegateMessages;
    setShowAllDelegateMessages(nextState);
    setActiveConversation(null);
    setComposerValue("");

    if (!nextState) {
      await fetchConversations();
    }
  }, [identity.type, showAllDelegateMessages, fetchConversations]);

  const handleSendMessage = useCallback(async () => {
    if (!composerValue.trim() || !activeConversation) {
      return;
    }

    setIsSendingMessage(true);
    setErrorMessage(null);

    try {
      if (identity.type === "admin") {
        throw new Error("Admins cannot send messages");
      }

      const conversationDetails = conversations.find(
        (conversation) => conversation.participantID === activeConversation
      );

      const receiverType = conversationDetails?.participantType ?? "delegate";
      const receiverName = conversationDetails?.participantName ?? "";

      let committee = committeeID;

      if (!committee) {
        if (identity.type === "delegate") {
          const { data } = await supabase
            .from("Delegation")
            .select("committeeID")
            .eq("delegateID", identity.id)
            .single();
          committee = data?.committeeID ?? null;
        } else if (identity.type === "chair") {
          const { data } = await supabase
            .from("Committee-Chair")
            .select("committeeID")
            .eq("chairID", identity.id)
            .single();
          committee = data?.committeeID ?? null;
        }

        setCommitteeID(committee ?? null);
      }

      if (!committee) {
        throw new Error("Unable to determine committee for message");
      }

      const { error } = await supabase
        .from("Message")
        .insert({
          senderID: identity.id,
          senderType: identity.type === "delegate" ? "delegate" : "chair",
          senderName: identity.name,
          receiverID: activeConversation,
          receiverType,
          receiverName,
          content: composerValue.trim(),
          timestamp: new Date().toISOString(),
          read: false,
          committeeID: committee
        });

      if (error) {
        throw new Error("Unable to send message");
      }

      setComposerValue("");
      toast.success("Message sent");
      await Promise.all([fetchMessages(activeConversation), fetchConversations()]);
    } catch (error) {
      console.error("Error sending message", error);
      const message = error instanceof Error ? error.message : "Unable to send message";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsSendingMessage(false);
    }
  }, [
    activeConversation,
    composerValue,
    fetchConversations,
    fetchMessages,
    identity,
    conversations,
    committeeID
  ]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (showAllDelegateMessages) {
      if (identity.type === "chair") {
        fetchAllDelegateMessages();
      }
      return;
    }

    if (activeConversation) {
      fetchMessages(activeConversation);
    } else {
      setMessages([]);
    }
  }, [activeConversation, showAllDelegateMessages, identity.type, fetchMessages, fetchAllDelegateMessages]);

  useEffect(() => {
    if (!identity.id) {
      return;
    }

    stopPolling();

    pollingHandle.current = setInterval(() => {
      refreshCurrentView().catch((error) => {
        console.error("Polling error", error);
      });
    }, POLL_INTERVAL);

    return () => {
      stopPolling();
    };
  }, [identity.id, refreshCurrentView, stopPolling]);

  const allowMessageSend =
    Boolean(composerValue.trim()) &&
    !isSendingMessage &&
    Boolean(activeConversation) &&
    identity.type !== "admin";

  return (
    <ParticipantRoute>
      <div className="page-shell">
        <div className="page-maxwidth space-y-8">
          <section className="surface-card px-8 py-10 text-center">
            <p className="badge-pill bg-deep-red/10 text-deep-red inline-flex items-center justify-center mx-auto mb-4">
              Real-time coordination
            </p>
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-deep-red mb-3">Messages</h1>
            <p className="text-base text-almost-black-green/80 max-w-2xl mx-auto">
              Coordinate directly with delegates and chairs in your committee. Conversations refresh automatically so you never miss an important update.
            </p>
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(280px,340px)_1fr]">
            <aside className="surface-card flex flex-col overflow-hidden" aria-label="Conversation list">
              <header className="border-b border-soft-ivory bg-soft-ivory/70 px-6 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 text-left">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-deep-red/10 text-deep-red">
                      <MessageCircle size={22} strokeWidth={2} />
                    </span>
                    <div>
                      <h2 className="text-lg font-semibold text-deep-red">Conversations</h2>
                      <p className="text-xs uppercase tracking-[0.3em] text-almost-black-green/50">Stay in sync</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => refreshCurrentView()}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-deep-red/20 text-deep-red hover:bg-deep-red/10 transition"
                    disabled={isFetchingConversations}
                    data-testid="button-refresh-conversations"
                    aria-label="Refresh conversations"
                  >
                    {isFetchingConversations ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                  </button>
                </div>
              </header>

              <div className="p-5 space-y-4 border-b border-soft-ivory/80">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-deep-red/40" size={18} />
                  <input
                    type="text"
                    placeholder="Search conversations"
                    className="w-full rounded-xl border border-soft-ivory bg-warm-light-grey pl-10 pr-4 py-2.5 text-sm text-almost-black-green focus:border-deep-red/60 focus:outline-none focus:ring-2 focus:ring-deep-red/20"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    data-testid="input-search-conversations"
                  />
                </div>

                {identity.type === "chair" && (
                  <button
                    type="button"
                    onClick={handleToggleAllDelegateMessages}
                    className={`w-full rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                      showAllDelegateMessages
                        ? "bg-deep-red text-white border-deep-red shadow-sm"
                        : "bg-soft-ivory text-deep-red border-soft-ivory hover:border-deep-red/40"
                    }`}
                    data-testid="button-toggle-all-messages"
                  >
                    {showAllDelegateMessages ? "Show My Conversations" : "View All Delegate Messages"}
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-3" data-testid="conversation-list">
                {isFetchingConversations && conversations.length === 0 ? (
                  <div className="flex items-center justify-center py-12 text-almost-black-green/50 text-sm">
                    <Loader2 className="mr-2 animate-spin" size={18} /> Loading conversations...
                  </div>
                ) : filteredConversations.length > 0 ? (
                  filteredConversations.map((conversation) => {
                    const isActive = !showAllDelegateMessages && activeConversation === conversation.participantID;
                    return (
                      <button
                        key={conversation.participantID}
                        type="button"
                        onClick={() => handleSelectConversation(conversation.participantID)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-red ${
                          isActive
                            ? "bg-soft-ivory border-deep-red text-deep-red shadow-sm"
                            : "bg-warm-light-grey border-transparent text-almost-black-green hover:border-deep-red/30"
                        }`}
                        data-testid={`button-conversation-${conversation.participantID}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span className={`mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl ${
                              conversation.participantType === "chair"
                                ? "bg-deep-red text-white"
                                : "bg-soft-rose text-deep-red"
                            }`}>
                              {conversation.participantType === "chair" ? <Crown size={16} /> : <User size={16} />}
                            </span>
                            <div className="space-y-1">
                              <p className="font-semibold leading-tight">{conversation.participantName}</p>
                              <p className="text-xs text-almost-black-green/60 line-clamp-2">{conversation.lastMessage || "No messages yet"}</p>
                            </div>
                          </div>
                          {conversation.unreadCount > 0 && (
                            <span className="badge-pill bg-deep-red/15 text-deep-red text-xs">
                              {conversation.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-[0.7rem] uppercase tracking-[0.2em] text-almost-black-green/40">
                          {new Date(conversation.lastMessageTime).toLocaleString()}
                        </p>
                      </button>
                    );
                  })
                ) : (
                  <div className="text-center py-12 text-almost-black-green/60 text-sm">
                    <MessageCircle className="mx-auto mb-3 text-deep-red/40" size={36} />
                    <p>No conversations found</p>
                  </div>
                )}
              </div>
            </aside>

            <section className="surface-card flex flex-col min-h-[520px]" aria-live="polite">
              <header className="border-b border-soft-ivory/80 bg-soft-ivory/60 px-6 py-5">
                <div className="flex flex-col gap-1">
                  <h2 className="text-xl font-heading font-semibold text-deep-red">
                    {showAllDelegateMessages
                      ? "All delegate messages"
                      : activeConversationDetails?.participantName ?? "Select a conversation"}
                  </h2>
                  <p className="text-xs uppercase tracking-[0.3em] text-almost-black-green/50">
                    {showAllDelegateMessages
                      ? "Visible to chairs in your committee"
                      : activeConversationDetails
                      ? `Direct messages with ${activeConversationDetails.participantType === "chair" ? "Chair" : "Delegate"}`
                      : "Choose a conversation from the left"}
                  </p>
                </div>
              </header>

              {errorMessage && (
                <div className="mx-6 mt-4 rounded-lg border border-soft-rose/60 bg-soft-rose/20 px-4 py-3 text-sm text-deep-red">
                  {errorMessage}
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-6 py-6 bg-warm-light-grey/60" data-testid="message-thread">
                {isFetchingMessages && messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-almost-black-green/50 text-sm">
                    <Loader2 className="mr-2 animate-spin" size={18} /> Loading messages...
                  </div>
                ) : messages.length > 0 ? (
                  <div className="space-y-4">
                    {messages.map((message) => {
                      const isSender = message.senderID === identity.id;
                      return (
                        <article
                          key={message.messageID}
                          className={`flex ${isSender ? "justify-end" : "justify-start"}`}
                          data-testid={`message-${message.messageID}`}
                        >
                          <div
                            className={`max-w-xs md:max-w-md rounded-2xl px-5 py-4 shadow-sm ${
                              isSender
                                ? "bg-gradient-to-br from-deep-red to-dark-burgundy text-white"
                                : "bg-white text-almost-black-green border border-soft-ivory"
                            }`}
                          >
                            {showAllDelegateMessages && (
                              <p className={`text-[0.65rem] uppercase tracking-[0.25em] mb-2 ${
                                isSender ? "text-white/70" : "text-almost-black-green/50"
                              }`}>
                                {message.senderName} → {message.receiverName}
                              </p>
                            )}
                            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
                            <p className={`mt-3 text-[0.7rem] ${
                              isSender ? "text-white/70" : "text-almost-black-green/45"
                            }`}>
                              {new Date(message.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-center text-almost-black-green/60">
                    <div className="max-w-sm space-y-2">
                      <MessageCircle className="mx-auto text-deep-red/40" size={48} />
                      <h3 className="text-lg font-semibold text-deep-red">
                        {showAllDelegateMessages ? "No delegate conversations yet" : "Start the conversation"}
                      </h3>
                      <p className="text-sm">
                        {showAllDelegateMessages
                          ? "Delegate-to-delegate messages will appear here for chairs."
                          : "Select a participant to view the thread and send them a message."}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {!showAllDelegateMessages && activeConversation && (
                <footer className="border-t border-soft-ivory bg-white px-6 py-5" data-testid="message-composer">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      type="text"
                      placeholder="Type your message..."
                      className="flex-1 rounded-xl border border-soft-ivory bg-warm-light-grey px-4 py-3 text-sm text-almost-black-green focus:border-deep-red/60 focus:outline-none focus:ring-2 focus:ring-deep-red/20"
                      value={composerValue}
                      onChange={(event) => setComposerValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          if (allowMessageSend) {
                            handleSendMessage();
                          }
                        }
                      }}
                      data-testid="input-new-message"
                    />
                    <button
                      type="button"
                      onClick={handleSendMessage}
                      disabled={!allowMessageSend}
                      className={`primary-button sm:w-auto w-full justify-center ${
                        allowMessageSend ? "" : "opacity-60 cursor-not-allowed"
                      }`}
                      data-testid="button-send-message"
                    >
                      {isSendingMessage ? <Loader2 className="mr-2 animate-spin" size={18} /> : <Send size={18} className="mr-2" />}
                      Send
                    </button>
                  </div>
                </footer>
              )}
            </section>
          </section>
        </div>
      </div>
    </ParticipantRoute>
  );
};

export default MessagesPage;
