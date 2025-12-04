'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ParticipantRoute } from '@/components/protectedroute';
import { ChatProvider, useChat } from './context/ChatContext';
import MessageBubble from './components/MessageBubble';
import TypingIndicator from './components/TypingIndicator';
import UserAvatar from './components/UserAvatar';
import { MessageCircle, RefreshCw, Search, Send } from 'lucide-react';
import { RoomWithDetails } from '@/lib/chat/types';
import supabase from '@/lib/supabase';

const ChatShell: React.FC = () => {
  const { rooms, activeRoom, messages, selectRoom, refreshRooms, sendMessage, sendTyping, typingUsers, onlineUsers, isConnecting } = useChat();
  const [composer, setComposer] = useState('');
  const [search, setSearch] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const filteredRooms = useMemo(() => {
    if (!search.trim()) return rooms;
    const q = search.toLowerCase();
    return rooms.filter((room) => room.name.toLowerCase().includes(q));
  }, [rooms, search]);

  const activeMessages = activeRoom ? messages[activeRoom.id] || [] : [];
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-soft-ivory to-warm-light-grey/60">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6 flex flex-col gap-2">
          <p className="text-[0.7rem] uppercase tracking-[0.3em] text-deep-red/80">Real-time coordination</p>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-heading font-semibold text-deep-red">Messages</h1>
            {isConnecting && <span className="text-xs text-almost-black-green/60">Connecting...</span>}
          </div>
          <p className="text-sm text-almost-black-green/80">
            Coordinate directly with delegates and chairs. Conversations refresh automatically so you never miss an update.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px,1fr]">
          <aside className="rounded-3xl bg-white shadow-sm ring-1 ring-soft-ivory/80">
            <div className="flex items-center justify-between border-b border-soft-ivory px-4 py-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-almost-black-green/60">Conversations</p>
                <p className="text-sm font-semibold text-deep-red">Stay in sync</p>
              </div>
              <button
                type="button"
                onClick={refreshRooms}
                className="inline-flex items-center gap-2 rounded-xl bg-soft-ivory px-3 py-2 text-xs font-semibold text-deep-red hover:bg-soft-rose/50"
              >
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
            <div className="px-4 py-3">
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
            <div className="h-[540px] overflow-y-auto px-2 pb-4">
              {filteredRooms.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-almost-black-green/60">
                  <MessageCircle className="text-deep-red/40" size={40} />
                  <p className="font-semibold text-deep-red">No conversations found</p>
                  <p className="text-sm">Create a direct message to get started.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {filteredRooms.map((room) => {
                    const last = room.lastMessage;
                    const isActive = activeRoom?.id === room.id;
                    const hasOnline = room.members.some((m) => onlineUsers.has(m.user_id));
                    return (
                      <li key={room.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectRoom(room)}
                          className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                            isActive
                              ? 'border-deep-red/40 bg-soft-rose/30 shadow-sm'
                              : 'border-transparent hover:border-soft-ivory hover:bg-soft-ivory'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`h-2 w-2 rounded-full ${hasOnline ? 'bg-emerald-500' : 'bg-soft-ivory'}`} />
                              <p className="text-sm font-semibold text-deep-red">{room.name}</p>
                            </div>
                            {last?.created_at && (
                              <span className="text-[0.7rem] uppercase tracking-tight text-almost-black-green/50">
                                {new Date(last.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 line-clamp-1 text-xs text-almost-black-green/70">
                            {last?.content || 'No messages yet'}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          <section className="rounded-3xl bg-white shadow-sm ring-1 ring-soft-ivory/80">
            <header className="flex items-center justify-between border-b border-soft-ivory px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-almost-black-green/60">Messages</p>
                <h2 className="text-xl font-heading font-semibold text-deep-red">
                  {activeRoom ? activeRoom.name : 'Select a conversation'}
                </h2>
              </div>
              {activeRoom && (
                <div className="flex items-center -space-x-2">
                  {activeRoom.members.map((member) => (
                    <div key={member.id} className="border border-white rounded-full">
                      <UserAvatar user={member.user} size={32} />
                    </div>
                  ))}
                </div>
              )}
            </header>

            <div className="flex h-[620px] flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto bg-warm-light-grey/50 px-6 py-4">
                {activeRoom ? (
                  activeMessages.length > 0 ? (
                    activeMessages.map((msg) => <MessageBubble key={msg.id} message={msg} isOwn={msg.user_id === currentUserId} />)
                  ) : (
                    <div className="flex h-full items-center justify-center text-center text-almost-black-green/60">
                      <div className="space-y-2">
                        <MessageCircle className="mx-auto text-deep-red/40" size={44} />
                        <p className="font-semibold text-deep-red">No messages yet</p>
                        <p className="text-sm">Start the conversation with a quick hello.</p>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex h-full items-center justify-center text-center text-almost-black-green/60">
                    <div className="space-y-2">
                      <MessageCircle className="mx-auto text-deep-red/40" size={48} />
                      <p className="font-semibold text-deep-red">Select a conversation</p>
                      <p className="text-sm">Choose a room from the left to view messages.</p>
                    </div>
                  </div>
                )}
              </div>

              {activeRoom && (
                <div className="border-t border-soft-ivory px-6 py-3">
                  <TypingIndicator names={roomTypingNames} />
                  <div className="mt-3 flex items-center gap-3">
                    <input
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
                      placeholder="Type your message..."
                      className="flex-1 rounded-xl border border-soft-ivory bg-warm-light-grey px-4 py-3 text-sm focus:border-deep-red/60 focus:ring-2 focus:ring-deep-red/20"
                    />
                    <button
                      type="button"
                      onClick={handleSend}
                      className="inline-flex items-center gap-2 rounded-xl bg-deep-red px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-dark-burgundy"
                    >
                      <Send size={16} /> Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
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
