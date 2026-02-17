'use client';

import React from 'react';
import { MessageWithUser } from '@/lib/chat/types';
import UserAvatar from './UserAvatar';
import { Check, Clock, AlertCircle } from 'lucide-react';

interface Props {
  message: MessageWithUser;
  isOwn: boolean;
  showAuthor?: boolean;
}

const statusCopy: Record<string, string> = {
  pending: 'Sending...',
  sent: 'Sent',
  delivered: 'Delivered',
  error: 'Error',
};

const statusIcon: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3 w-3" />,
  sent: <Check className="h-3 w-3" />,
  delivered: <Check className="h-3 w-3" />,
  error: <AlertCircle className="h-3 w-3" />,
};

const MessageBubble: React.FC<Props> = ({ message, isOwn, showAuthor = true }) => {
  const timestamp = message.created_at
    ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className={`flex gap-3 ${isOwn ? 'flex-row-reverse text-right' : 'flex-row'}`}>
      <UserAvatar user={message.user} size={36} />
      <div
        className={`group relative max-w-xl rounded-2xl px-4 py-3 shadow-sm ${
          isOwn ? 'bg-deep-red text-white' : 'bg-white border border-soft-ivory text-almost-black-green'
        }`}
      >
        <div className={`flex items-center justify-between gap-3 text-xs font-semibold ${isOwn ? 'text-white' : 'text-deep-red'}`}>
          {showAuthor && <span>{message.user?.full_name ?? 'Unknown user'}</span>}
          <span className={`text-[0.7rem] ${isOwn ? 'text-white/70' : 'text-almost-black-green/60'}`}>{timestamp}</span>
        </div>
        {message.reply_to && (
          <div className={`mt-2 rounded-lg px-3 py-2 text-xs ${isOwn ? 'bg-white/10 text-white/80' : 'bg-black/5 text-almost-black-green/70'}`}>
            Replying to a previous message
          </div>
        )}
        <p className={`mt-2 whitespace-pre-wrap text-sm leading-relaxed ${isOwn ? 'text-white' : 'text-almost-black-green'}`}>{message.content}</p>
        {message.status && (
          <div
            className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.7rem] uppercase tracking-tight ${
              isOwn ? 'bg-white/20 text-white' : 'bg-soft-ivory text-almost-black-green/70'
            }`}
          >
            {statusIcon[message.status]}
            <span>{statusCopy[message.status]}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
