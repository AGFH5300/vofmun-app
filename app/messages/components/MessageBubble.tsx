'use client';

import React from 'react';
import { MessageWithUser } from '@/lib/chat/types';
import UserAvatar from './UserAvatar';
import { AlertCircle, Check, CheckCheck, Clock } from 'lucide-react';

interface Props {
  message: MessageWithUser;
  isOwn: boolean;
  showAuthor?: boolean;
}

const statusIcon: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3 w-3" />,
  sent: <Check className="h-3 w-3" />,
  delivered: <CheckCheck className="h-3 w-3" />,
  read: <CheckCheck className="h-3 w-3 text-sky-500" />,
  error: <AlertCircle className="h-3 w-3" />,
};

const statusClass: Record<string, string> = {
  pending: 'text-almost-black-green/40',
  sent: 'text-almost-black-green/50',
  delivered: 'text-almost-black-green/50',
  read: 'text-sky-500',
  error: 'text-deep-red',
};

const MessageBubble: React.FC<Props> = ({ message, isOwn, showAuthor = true }) => {
  const isFailed = message.status === 'error';
  const timestamp = message.created_at
    ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      <UserAvatar user={message.user} size={36} />
      <div
        className={`group relative max-w-xl rounded-2xl border px-4 py-3 shadow-sm ${
          isOwn
            ? isFailed
              ? 'border-deep-red/30 bg-soft-rose/30 text-deep-red'
              : 'border-[#dcc8bd] bg-[#efe3dc] text-almost-black-green'
            : 'border-soft-ivory bg-white text-almost-black-green'
        }`}
      >
        {showAuthor && (
          <p className="text-[0.66rem] font-medium uppercase tracking-[0.08em] text-deep-red/85">{message.user?.full_name ?? 'Unknown user'}</p>
        )}

        {message.reply_to && (
          <div
            className={`mt-2 rounded-lg px-3 py-2 text-xs ${
              isOwn ? (isFailed ? 'bg-deep-red/10 text-deep-red/80' : 'bg-white/70 text-almost-black-green/75') : 'bg-black/5 text-almost-black-green/70'
            }`}
          >
            Replying to a previous message
          </div>
        )}

        <div className="mt-2 flex items-end justify-between gap-3">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-almost-black-green">{message.content}</p>
          <div className="shrink-0 self-end pb-0.5 text-[0.72rem]">
            <div className="flex items-center justify-end gap-1">
              <span className="text-almost-black-green/55">{timestamp}</span>
              {message.status && <span className={statusClass[message.status] || 'text-almost-black-green/50'}>{statusIcon[message.status]}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
