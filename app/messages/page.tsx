"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ParticipantRoute } from '@/components/protectedroute';
import { useSession } from '@/app/context/sessionContext';
import { useMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import {
  Send,
  Users,
  User,
  Crown,
  MessageCircle,
  Search,
  Filter,
  MoreVertical,
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
  const isMobile = useMobile();
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
      <div className="min-h-screen bg-gradient-to-br from-soft-ivory via-white to-warm-light-grey">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-8"
          >
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-deep-red mb-4">
              Messages
            </h1>
            <p className="text-lg font-body text-almost-black-green max-w-3xl mx-auto">
              Communicate with delegates and chairs in your committee
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-6 h-[600px]">
            {/* Conversations Sidebar */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-white rounded-xl shadow-lg border border-cool-grey overflow-hidden"
            >
              <div className="bg-gradient-to-r from-deep-red to-dark-burgundy px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <MessageCircle className="text-white mr-3" size={24} />
                    <h2 className="text-xl font-heading font-bold text-white">
                      Conversations
                    </h2>
                  </div>
                  <button
                    onClick={fetchConversations}
                    className="text-white hover:bg-white/20 p-1 rounded transition-colors"
                    disabled={loading}
                    data-testid="button-refresh-conversations"
                  >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              <div className="p-4">
                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cool-grey" size={18} />
                  <input
                    type="text"
                    placeholder="Search conversations..."
                    className="w-full pl-10 pr-4 py-2 border border-cool-grey rounded-lg focus:outline-none focus:ring-2 focus:ring-deep-red focus:border-transparent"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-conversations"
                  />
                </div>

                {/* Chair-only: View all delegate messages toggle */}
                {userInfo.type === 'chair' && (
                  <div className="mb-4">
                    <button
                      onClick={() => setShowAllMessages(!showAllMessages)}
                      className={`w-full p-3 rounded-lg border transition-colors ${
                        showAllMessages
                          ? 'bg-deep-red text-white border-deep-red'
                          : 'bg-white text-deep-red border-cool-grey hover:bg-pale-aqua'
                      }`}
                      data-testid="button-toggle-all-messages"
                    >
                      <div className="flex items-center justify-center">
                        <Users size={18} className="mr-2" />
                        {showAllMessages ? 'Show My Conversations' : 'View All Delegate Messages'}
                      </div>
                    </button>
                  </div>
                )}

                {/* Conversation List */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredConversations.length > 0 ? (
                    filteredConversations.map((conversation) => (
                      <motion.button
                        key={conversation.participantID}
                        onClick={() => {
                          setSelectedConversation(conversation.participantID);
                          setShowAllMessages(false);
                        }}
                        className={`w-full p-3 rounded-lg text-left transition-colors ${
                          selectedConversation === conversation.participantID && !showAllMessages
                            ? 'bg-deep-red text-white'
                            : 'bg-warm-light-grey hover:bg-pale-aqua text-almost-black-green'
                        }`}
                        data-testid={`button-conversation-${conversation.participantID}`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            {conversation.participantType === 'chair' ? (
                              <Crown size={16} className="mr-2" />
                            ) : (
                              <User size={16} className="mr-2" />
                            )}
                            <div>
                              <p className="font-medium">{conversation.participantName}</p>
                              <p className="text-sm opacity-75 truncate max-w-32">
                                {conversation.lastMessage}
                              </p>
                            </div>
                          </div>
                          {conversation.unreadCount > 0 && (
                            <div className="bg-soft-rose text-dark-burgundy text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
                              {conversation.unreadCount}
                            </div>
                          )}
                        </div>
                      </motion.button>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <MessageCircle className="mx-auto text-cool-grey mb-4" size={48} />
                      <p className="font-body text-cool-grey">No conversations yet</p>
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
              className="lg:col-span-2 bg-white rounded-xl shadow-lg border border-cool-grey overflow-hidden flex flex-col"
            >
              {selectedConversation || showAllMessages ? (
                <>
                  {/* Messages Header */}
                  <div className="bg-gradient-to-r from-deep-red to-dark-burgundy px-6 py-4">
                    <h3 className="text-xl font-heading font-bold text-white">
                      {showAllMessages 
                        ? 'All Delegate Messages (Chair View)'
                        : conversations.find(c => c.participantID === selectedConversation)?.participantName || 'Messages'
                      }
                    </h3>
                  </div>

                  {/* Messages Content */}
                  <div className="flex-1 p-6 overflow-y-auto bg-warm-light-grey">
                    <div className="space-y-4">
                      {messages.length > 0 ? (
                        messages.map((message, index) => (
                          <motion.div
                            key={message.messageID}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.1 }}
                            className={`flex ${
                              message.senderID === userInfo.id ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            <div
                              className={`max-w-xs md:max-w-md p-4 rounded-lg ${
                                message.senderID === userInfo.id
                                  ? 'bg-deep-red text-white'
                                  : 'bg-white text-almost-black-green border border-cool-grey'
                              }`}
                              data-testid={`message-${message.messageID}`}
                            >
                              {showAllMessages && (
                                <div className="text-xs opacity-75 mb-2">
                                  {message.senderName} → {message.receiverName}
                                </div>
                              )}
                              <p className="font-body">{message.content}</p>
                              <p className={`text-xs mt-2 ${
                                message.senderID === userInfo.id ? 'text-white/75' : 'text-cool-grey'
                              }`}>
                                {new Date(message.timestamp).toLocaleString()}
                              </p>
                            </div>
                          </motion.div>
                        ))
                      ) : (
                        <div className="text-center py-8">
                          <MessageCircle className="mx-auto text-cool-grey mb-4" size={48} />
                          <p className="font-body text-cool-grey">
                            {showAllMessages ? 'No delegate messages found' : 'No messages yet. Start the conversation!'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Message Input (only for direct conversations, not chair view all) */}
                  {!showAllMessages && (
                    <div className="p-6 border-t border-cool-grey">
                      <div className="flex space-x-4">
                        <input
                          type="text"
                          placeholder="Type your message..."
                          className="flex-1 px-4 py-3 border border-cool-grey rounded-lg focus:outline-none focus:ring-2 focus:ring-deep-red focus:border-transparent"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                          data-testid="input-new-message"
                        />
                        <button
                          onClick={sendMessage}
                          disabled={!newMessage.trim()}
                          className="bg-deep-red hover:bg-dark-burgundy disabled:bg-cool-grey text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
                          data-testid="button-send-message"
                        >
                          <Send size={18} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center p-6">
                  <div className="text-center">
                    <MessageCircle className="mx-auto text-cool-grey mb-4" size={64} />
                    <h3 className="text-xl font-heading font-bold text-dark-burgundy mb-2">
                      Select a conversation
                    </h3>
                    <p className="font-body text-almost-black-green">
                      Choose a conversation from the sidebar to start messaging
                    </p>
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