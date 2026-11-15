"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ParticipantRoute } from '@/components/protectedroute';
import { useSession } from '@/app/context/sessionContext';
import { toast } from 'sonner';
import {
  Send,
  Users,
  User,
  Crown,
  MessageCircle,
  Search,
  RefreshCw
} from 'lucide-react';

interface Message {
  messageID: string;
  senderID: string;
  senderType: 'delegate' | 'chair';
  senderName: string;
  receiverID: string;
  receiverType: 'delegate' | 'chair';
  receiverName: string;
  content: string;
  timestamp: string;
  read: boolean;
}

interface Conversation {
  participantID: string;
  participantName: string;
  participantType: 'delegate' | 'chair';
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

const Messages = () => {
  const { user: currentUser } = useSession();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAllMessages, setShowAllMessages] = useState(false); // For chair to view all delegate messages

  const getUserInfo = () => {
    if (!currentUser) return { id: '', name: '', type: 'delegate' as const };
    
    if ('delegateID' in currentUser) {
      return {
        id: currentUser.delegateID,
        name: `${currentUser.firstname} ${currentUser.lastname}`,
        type: 'delegate' as const
      };
    } else if ('chairID' in currentUser) {
      return {
        id: currentUser.chairID,
        name: `${currentUser.firstname} ${currentUser.lastname}`,
        type: 'chair' as const
      };
    }
    
    return { id: '', name: '', type: 'delegate' as const };
  };

  const userInfo = getUserInfo();

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/messages/conversations');
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      } else {
        toast.error('Failed to load conversations');
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast.error('Error loading conversations');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMessages = useCallback(async (conversationWith: string) => {
    try {
      const response = await fetch(`/api/messages?conversationWith=${conversationWith}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
        
        // Mark messages as read
        await fetch('/api/messages/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationWith
          })
        });
      } else {
        toast.error('Failed to load messages');
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Error loading messages');
    }
  }, []);

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverID: selectedConversation,
          content: newMessage.trim()
        })
      });

      if (response.ok) {
        setNewMessage('');
        await fetchMessages(selectedConversation);
        await fetchConversations();
        toast.success('Message sent');
      } else {
        toast.error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Error sending message');
    }
  }, [newMessage, selectedConversation, fetchMessages, fetchConversations]);

  const fetchAllDelegateMessages = useCallback(async () => {
    if (userInfo.type !== 'chair') return;
    
    try {
      setLoading(true);
      const response = await fetch('/api/messages/all-delegate-messages');
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      } else {
        toast.error('Failed to load delegate messages');
      }
    } catch (error) {
      console.error('Error fetching delegate messages:', error);
      toast.error('Error loading delegate messages');
    } finally {
      setLoading(false);
    }
  }, [userInfo.type]);

  useEffect(() => {
    if (userInfo.id) {
      fetchConversations();
    }
  }, [fetchConversations]);

  useEffect(() => {
    if (selectedConversation && !showAllMessages) {
      fetchMessages(selectedConversation);
    }
  }, [selectedConversation, fetchMessages, showAllMessages]);

  useEffect(() => {
    if (showAllMessages && userInfo.type === 'chair') {
      fetchAllDelegateMessages();
    }
  }, [showAllMessages, fetchAllDelegateMessages]);

  const filteredConversations = conversations.filter(conv =>
    conv.participantName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ParticipantRoute>
      <div className="page-shell">
        <div className="page-maxwidth space-y-10">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="surface-card is-emphasised text-center px-8 py-10"
          >
            <span className="badge-pill bg-white/15 text-white/80 inline-flex justify-center mx-auto mb-4">
              Real-time messaging
            </span>
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-white mb-3">
              Messages
            </h1>
            <p className="text-white/80 max-w-3xl mx-auto">
              Coordinate strategy, update your chair, and manage crisis responses without leaving the delegate workspace.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-[1.1fr_1.9fr] gap-6 min-h-[600px]">
            {/* Conversations Sidebar */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="surface-card flex flex-col overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-soft-ivory bg-gradient-to-r from-deep-red/95 to-dark-burgundy/90 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                      <MessageCircle size={24} />
                    </span>
                    <div className="text-left">
                      <h2 className="text-lg font-semibold">Conversations</h2>
                      <p className="text-xs uppercase tracking-[0.3em] text-white/70">Stay in sync</p>
                    </div>
                  </div>
                  <button
                    onClick={fetchConversations}
                    className="rounded-full border border-white/30 px-3 py-2 text-xs uppercase tracking-[0.2em] hover:bg-white/10 transition"
                    disabled={loading}
                    data-testid="button-refresh-conversations"
                  >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-deep-red/50" size={18} />
                  <input
                    type="text"
                    placeholder="Search conversations"
                    className="w-full rounded-xl border border-soft-ivory bg-warm-light-grey pl-10 pr-4 py-2.5 text-almost-black-green focus:border-deep-red/60 focus:ring-2 focus:ring-deep-red/25"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-conversations"
                  />
                </div>

                {userInfo.type === 'chair' && (
                  <button
                    onClick={() => setShowAllMessages(!showAllMessages)}
                    className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all border ${showAllMessages ? 'bg-deep-red text-white border-deep-red' : 'bg-soft-ivory text-deep-red border-soft-ivory hover:border-deep-red/50'}`}
                    data-testid="button-toggle-all-messages"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Users size={18} />
                      {showAllMessages ? 'Show My Conversations' : 'View All Delegate Messages'}
                    </div>
                  </button>
                )}

                <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                  {filteredConversations.length > 0 ? (
                    filteredConversations.map((conversation) => {
                      const isActive = selectedConversation === conversation.participantID && !showAllMessages;
                      return (
                        <motion.button
                          key={conversation.participantID}
                          onClick={() => {
                            setSelectedConversation(conversation.participantID);
                            setShowAllMessages(false);
                          }}
                          className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${isActive ? 'bg-soft-ivory border-deep-red text-deep-red' : 'bg-warm-light-grey border-soft-ivory hover:border-deep-red/40 text-almost-black-green'}`}
                          data-testid={`button-conversation-${conversation.participantID}`}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${isActive ? 'bg-deep-red text-white' : 'bg-soft-rose text-deep-red'}`}>
                                {conversation.participantType === 'chair' ? <Crown size={16} /> : <User size={16} />}
                              </span>
                              <div>
                                <p className="font-semibold">{conversation.participantName}</p>
                                <p className="text-xs text-almost-black-green/60 truncate max-w-[160px]">{conversation.lastMessage}</p>
                              </div>
                            </div>
                            {conversation.unreadCount > 0 && (
                              <span className="badge-pill bg-soft-rose text-deep-red/80">
                                {conversation.unreadCount}
                              </span>
                            )}
                          </div>
                        </motion.button>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-almost-black-green/60">
                      <MessageCircle className="mx-auto mb-3 text-deep-red/50" size={40} />
                      <p>No conversations yet</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Messages Area */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="surface-card flex flex-col overflow-hidden"
            >
              {selectedConversation || showAllMessages ? (
                <>
                  <div className="px-6 py-5 border-b border-soft-ivory bg-soft-ivory/70">
                    <h3 className="text-xl font-heading font-semibold text-deep-red">
                      {showAllMessages
                        ? 'All Delegate Messages'
                        : conversations.find(c => c.participantID === selectedConversation)?.participantName || 'Messages'
                      }
                    </h3>
                    {!showAllMessages && (
                      <p className="text-xs text-almost-black-green/60 mt-1 uppercase tracking-[0.3em]">Direct conversation</p>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 bg-warm-light-grey/70">
                    <div className="space-y-4">
                      {messages.length > 0 ? (
                        messages.map((message, index) => {
                          const isSender = message.senderID === userInfo.id;
                          return (
                            <motion.div
                              key={message.messageID}
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.3, delay: index * 0.08 }}
                              className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-xs md:max-w-md rounded-2xl px-5 py-4 shadow-sm ${
                                  isSender
                                    ? 'bg-gradient-to-br from-deep-red to-dark-burgundy text-white'
                                    : 'bg-white text-almost-black-green border border-soft-ivory'
                                }`}
                                data-testid={`message-${message.messageID}`}
                              >
                                {showAllMessages && (
                                  <div className="text-xs uppercase tracking-[0.25em] mb-2 text-white/70">
                                    {message.senderName} → {message.receiverName}
                                  </div>
                                )}
                                <p className="font-body text-sm leading-relaxed">{message.content}</p>
                                <p className={`text-[0.7rem] mt-3 ${isSender ? 'text-white/70' : 'text-almost-black-green/50'}`}>
                                  {new Date(message.timestamp).toLocaleString()}
                                </p>
                              </div>
                            </motion.div>
                          );
                        })
                      ) : (
                        <div className="text-center py-10 text-almost-black-green/60">
                          <MessageCircle className="mx-auto mb-3 text-deep-red/45" size={40} />
                          <p>{showAllMessages ? 'No delegate messages found' : 'No messages yet. Start the conversation!'}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {!showAllMessages && (
                    <div className="border-t border-soft-ivory bg-white px-6 py-5">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="text"
                          placeholder="Type your message..."
                          className="flex-1 rounded-xl border border-soft-ivory bg-warm-light-grey px-4 py-3 text-almost-black-green focus:border-deep-red/60 focus:ring-2 focus:ring-deep-red/25"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                          data-testid="input-new-message"
                        />
                        <button
                          onClick={sendMessage}
                          disabled={!newMessage.trim()}
                          className={`primary-button sm:w-auto w-full ${!newMessage.trim() ? 'opacity-60 cursor-not-allowed' : ''}`}
                          data-testid="button-send-message"
                        >
                          <Send size={18} />
                          <span>Send</span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center p-10 text-center">
                  <div>
                    <MessageCircle className="mx-auto text-deep-red/50 mb-4" size={60} />
                    <h3 className="text-xl font-heading font-semibold text-deep-red mb-2">Select a conversation</h3>
                    <p className="text-sm text-almost-black-green/70">Choose a conversation from the sidebar to start messaging.</p>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </ParticipantRoute>
  );
};

export default Messages;