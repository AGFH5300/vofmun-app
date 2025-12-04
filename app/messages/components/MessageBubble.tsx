'use client';

import React from 'react';
import { MessageWithUser } from '@/lib/chat/types';
import UserAvatar from './UserAvatar';
import { Check, Clock, AlertCircle } from 'lucide-react';

interface Props {
  message: MessageWithUser;
  isOwn: boolean;
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

const MessageBubble: React.FC<Props> = ({ message, isOwn }) => {
  return (
    <div className={`flex gap-3 ${isOwn ? 'flex-row-reverse text-right' : 'flex-row'}`}>
      <UserAvatar user={message.user} size={40} />
      <div className={`max-w-xl rounded-2xl px-4 py-3 shadow-sm ${isOwn ? 'bg-deep-red text-white' : 'bg-white border border-soft-ivory text-almost-black-green'}`}>
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span>{message.user?.full_name ?? 'Unknown user'}</span>
          <span className="text-almost-black-green/50 dark:text-white/70">
            {message.created_at ? new Date(message.created_at).toLocaleTimeString() : ''}
          </span>
        </div>
        {message.reply_to && (
          <div className="mt-2 rounded-lg bg-black/5 px-3 py-2 text-xs text-almost-black-green/70 dark:bg-white/10 dark:text-white/80">
            Replying to {message.reply_to}
          </div>
        )}
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        {message.status && (
          <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-1 text-[0.7rem] uppercase tracking-tight text-white">
            {statusIcon[message.status]}
            <span>{statusCopy[message.status]}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
