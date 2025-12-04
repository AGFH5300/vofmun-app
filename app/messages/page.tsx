'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ParticipantRoute } from '@/components/protectedroute';
import { ChatProvider, useChat } from './context/ChatContext';
import MessageBubble from './components/MessageBubble';
import TypingIndicator from './components/TypingIndicator';
import UserAvatar from './components/UserAvatar';
import ConversationList from './components/ConversationList';
import NewChatModal from './components/NewChatModal';
import NewGroupModal from './components/NewGroupModal';
import FriendRequestsModal from './components/FriendRequestsModal';
import ConversationDetailsModal from './components/ConversationDetailsModal';
import { File, MoreVertical, Paperclip, RefreshCw, Search, Smile, Users } from 'lucide-react';
import { RoomWithDetails } from '@/lib/chat/types';
import supabase from '@/lib/supabase';

const formatDateLabel = (dateString: string) => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const ChatShell: React.FC = () => {
  const {
    rooms,
    activeRoom,
    messages,
    selectRoom,
    refreshRooms,
    sendMessage,
    sendTyping,
    typingUsers,
    onlineUsers,
    isConnecting,
    friendRequests,
    togglePin,
    currentUserId,
  } = useChat();

  const [composer, setComposer] = useState('');
  const [search, setSearch] = useState('');
  const [currentUserIdState, setCurrentUserIdState] = useState<string | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserIdState(data.user?.id ?? null));
  }, []);

  const filteredRooms = useMemo(() => {
    if (!search.trim()) return rooms;
    const q = search.toLowerCase();
    return rooms.filter((room) => room.name.toLowerCase().includes(q));
  }, [rooms, search]);

  const activeMessages = useMemo(() => (activeRoom ? messages[activeRoom.id] || [] : []), [activeRoom, messages]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeMessages.length, activeRoom?.id]);

  const roomTypingNames = useMemo(() => {
    if (!activeRoom) return [] as string[];
    const activeTyping = Array.from(typingUsers[activeRoom.id] || []);
    return activeTyping
      .map((userId) => activeRoom.members.find((m) => m.user_id === userId)?.user?.full_name)
      .filter(Boolean) as string[];
  }, [activeRoom, typingUsers]);

  const handleSend = async () => {
    if (!activeRoom || !composer.trim()) return;
    await sendMessage(activeRoom.id, composer);
    setComposer('');
  };

  const handleSelectRoom = async (room: RoomWithDetails) => {
    await selectRoom(room);
  };

  const timeline = useMemo(() => {
    const sequence: Array<{ type: 'date'; label: string } | { type: 'message'; id: string }> = [];
    let lastDate: string | null = null;
    activeMessages.forEach((msg) => {
      const dateLabel = msg.created_at ? formatDateLabel(msg.created_at) : '';
      if (dateLabel && dateLabel !== lastDate) {
        sequence.push({ type: 'date', label: dateLabel });
        lastDate = dateLabel;
      }
      sequence.push({ type: 'message', id: msg.id });
    });
    return sequence;
  }, [activeMessages]);

  const activeTypingDisplay = roomTypingNames.length ? <TypingIndicator names={roomTypingNames} /> : null;
  const pendingRequests = friendRequests.filter(
    (req) => req.status === 'pending' && req.receiver_id === (currentUserId || currentUserIdState)
  ).length;

  const headerSubtitle = activeRoom
    ? activeRoom.room_type === 'dm'
      ? activeRoom.members.find((m) => m.user_id !== (currentUserId || currentUserIdState))?.user?.committee || 'Delegate'
      : `${activeRoom.members.length} participants`
    : 'Choose a conversation to start';

  return (
    <div className="min-h-screen bg-gradient-to-br from-soft-ivory to-warm-light-grey/60">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6 flex flex-col gap-2">
          <p className="text-[0.7rem] uppercase tracking-[0.3em] text-deep-red/80">Real-time coordination</p>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-heading font-semibold text-deep-red">Messages</h1>
            {isConnecting && <span className="text-xs text-almost-black-green/60">Connecting…</span>}
          </div>
          <p className="text-sm text-almost-black-green/80">
            Coordinate with delegates, chairs, and secretariat. Presence, typing, and unread updates keep you in the loop.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px,1fr]">
          <aside className="flex h-[720px] flex-col rounded-3xl bg-white shadow-sm ring-1 ring-soft-ivory/80">
            <div className="flex items-center justify-between border-b border-soft-ivory px-4 py-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-almost-black-green/60">Conversations</p>
                <p className="text-sm font-semibold text-deep-red">Stay in sync</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRequests(true)}
                  className="relative rounded-xl border border-soft-ivory px-3 py-2 text-xs font-semibold text-deep-red hover:bg-soft-ivory"
                >
                  Requests
                  {pendingRequests > 0 && (
                    <span className="absolute -right-2 -top-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-deep-red px-1 text-[0.7rem] font-semibold text-white">
                      {pendingRequests}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={refreshRooms}
                  className="inline-flex items-center gap-2 rounded-xl bg-soft-ivory px-3 py-2 text-xs font-semibold text-deep-red hover:bg-soft-rose/50"
                >
                  <RefreshCw size={14} />
                  Refresh
                </button>
              </div>
            </div>
            <div className="border-b border-soft-ivory px-4 py-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-almost-black-green/40" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full rounded-xl border border-soft-ivory bg-warm-light-grey px-9 py-2 text-sm focus:border-deep-red/40 focus:ring-2 focus:ring-deep-red/20"
                  placeholder="Search conversations"
                />
              </label>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-4">
              <ConversationList
                rooms={filteredRooms}
                activeRoomId={activeRoom?.id}
                onSelect={handleSelectRoom}
                onTogglePin={togglePin}
                currentUserId={currentUserIdState || currentUserId}
                onlineUsers={onlineUsers}
                onNewChat={() => setShowNewChat(true)}
                onNewGroup={() => setShowNewGroup(true)}
              />
            </div>
          </aside>

          <section className="flex h-[720px] flex-col rounded-3xl bg-white shadow-sm ring-1 ring-soft-ivory/80">
            <header className="flex items-center justify-between border-b border-soft-ivory px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-almost-black-green/60">Messages</p>
                <h2 className="text-xl font-heading font-semibold text-deep-red">
                  {activeRoom ? activeRoom.name : 'Select a conversation'}
                </h2>
                <p className="text-sm text-almost-black-green/60">{headerSubtitle}</p>
              </div>
              {activeRoom ? (
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {activeRoom.members.map((member) => (
                      <div key={member.id} className="rounded-full border border-white">
                        <UserAvatar user={member.user} size={36} />
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
                <div className="text-sm text-almost-black-green/60">Choose a chat to begin</div>
              )}
            </header>

            <div className="flex flex-1 flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto bg-warm-light-grey/40 px-6 py-4">
                {activeRoom ? (
                  activeMessages.length > 0 ? (
                    timeline.map((item) => {
                      if (item.type === 'date') {
                        return (
                          <div key={`date-${item.label}`} className="sticky top-2 z-10 flex justify-center">
                            <span className="rounded-full bg-white px-3 py-1 text-[0.75rem] text-almost-black-green/60 shadow-sm">
                              {item.label}
                            </span>
                          </div>
                        );
                      }
                      const message = activeMessages.find((msg) => msg.id === item.id);
                      if (!message) return null;
                      const isOwn = (currentUserId || currentUserIdState) === message.user_id;
                      return (
                        <MessageBubble
                          key={item.id}
                          message={message}
                          isOwn={isOwn}
                          showAuthor={activeRoom.room_type !== 'dm'}
                        />
                      );
                    })
                  ) : (
                    <div className="flex h-full items-center justify-center text-center text-almost-black-green/60">
                      <div className="space-y-2">
                        <Users className="mx-auto text-deep-red/40" size={44} />
                        <p className="font-semibold text-deep-red">No messages yet</p>
                        <p className="text-sm">Break the ice with a quick hello.</p>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex h-full items-center justify-center text-center text-almost-black-green/60">
                    <div className="space-y-2">
                      <Users className="mx-auto text-deep-red/40" size={48} />
                      <p className="font-semibold text-deep-red">Select a conversation</p>
                      <p className="text-sm">Choose a room from the left to view messages.</p>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {activeRoom && (
                <div className="border-t border-soft-ivory px-6 py-3">
                  {activeTypingDisplay}
                  <div className="mt-3 flex items-end gap-3">
                    <div className="flex flex-1 items-center rounded-2xl border border-soft-ivory bg-warm-light-grey px-3">
                      <button type="button" className="rounded-full p-2 text-almost-black-green/60 hover:text-deep-red">
                        <Smile className="h-5 w-5" />
                      </button>
                      <textarea
                        value={composer}
                        onChange={(event) => setComposer(event.target.value)}
                        onFocus={() => sendTyping(activeRoom.id, true)}
                        onBlur={() => sendTyping(activeRoom.id, false)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            handleSend();
                          }
                        }}
                        placeholder="Message the room"
                        rows={1}
                        className="max-h-32 min-h-[48px] flex-1 resize-none bg-transparent py-3 text-sm focus:outline-none"
                      />
                      <button type="button" className="rounded-full p-2 text-almost-black-green/60 hover:text-deep-red">
                        <Paperclip className="h-5 w-5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleSend}
                      className="inline-flex items-center gap-2 rounded-xl bg-deep-red px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-dark-burgundy"
                    >
                      <File className="h-4 w-4" /> Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <NewChatModal open={showNewChat} onClose={() => setShowNewChat(false)} onConversationCreated={() => setShowNewChat(false)} />
      <NewGroupModal open={showNewGroup} onClose={() => setShowNewGroup(false)} onCreated={() => setShowNewGroup(false)} />
      <FriendRequestsModal open={showRequests} onClose={() => setShowRequests(false)} />
      <ConversationDetailsModal room={activeRoom} open={showDetails} onClose={() => setShowDetails(false)} />
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
