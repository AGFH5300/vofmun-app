// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React, { useEffect } from 'react';
import { MessageWithUser } from '@/lib/chat/types';
import { useSession } from '@/app/context/sessionContext';
import UserAvatar from './UserAvatar';
import { AlertCircle, Check, CheckCheck, CheckCircle2, Clock, Copy, Forward, Info, Pencil, Reply, Smile, Trash2 } from 'lucide-react';

interface Props {
  message: MessageWithUser;
  isOwn: boolean;
  showAuthor?: boolean;
  showAvatar?: boolean;
}

const statusIcon: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3 w-3" />,
  sent: <Check className="h-3 w-3" />,
  delivered: <CheckCheck className="h-3 w-3" />,
  read: (
    <span className="inline-flex items-center text-[#3b82f6]" aria-label="Read">
      <Check className="h-3 w-3" />
      <Check className="-ml-1 h-3 w-3" />
    </span>
  ),
  error: <AlertCircle className="h-3 w-3" />,
};

const statusClass: Record<string, string> = {
  pending: 'text-almost-black-green/40',
  sent: 'text-almost-black-green/50',
  delivered: 'text-almost-black-green/55',
  read: 'text-sky-500',
  error: 'text-deep-red',
};

const isChatDebugEnabled = process.env.NEXT_PUBLIC_CHAT_DEBUG === '1' || process.env.NODE_ENV !== 'production';

const resolveReceiptStatus = (message: MessageWithUser, isOwn: boolean) => {
  if (!isOwn) return undefined;
  if (message.status === 'pending' || message.status === 'error') return message.status;
  return message.status || 'sent';
};

const MessageBubble: React.FC<Props> = ({ message, isOwn, showAuthor = true, showAvatar = true }) => {
  const { user } = useSession();
  const currentUserId =
    ('id' in (user || {}) && user?.id ? user.id : null) ||
    ('delegateID' in (user || {}) && user?.delegateID ? user.delegateID : null) ||
    ('chairID' in (user || {}) && user?.chairID ? user.chairID : null) ||
    ('adminID' in (user || {}) && user?.adminID ? user.adminID : null) ||
    ('secretariatID' in (user || {}) && user?.secretariatID ? user.secretariatID : null);
  const [contextMenuPosition, setContextMenuPosition] = React.useState<{ x: number; y: number } | null>(null);
  const isFailed = message.status === 'error';
  const resolvedStatus = resolveReceiptStatus(message, isOwn);

  useEffect(() => {
    if (!isOwn || !isChatDebugEnabled) return;
    console.warn('[ChatDebug] message_bubble:status_render', {
      messageId: message.id,
      roomId: message.room_id,
      rawStatus: message.status || null,
      resolvedStatus: resolvedStatus || null,
      currentUserId: currentUserId ? String(currentUserId) : null,
      hasStatusIcon: Boolean(resolvedStatus && statusIcon[resolvedStatus]),
      createdAt: message.created_at || null,
    });
  }, [isOwn, message.created_at, message.id, message.room_id, message.status, resolvedStatus]);

  useEffect(() => {
    if (!contextMenuPosition) return;

    const closeMenu = () => setContextMenuPosition(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };

    window.addEventListener('click', closeMenu);
    window.addEventListener('contextmenu', closeMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('contextmenu', closeMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenuPosition]);

  const timestamp = message.created_at
    ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className={`flex gap-2 ${isOwn ? 'justify-end' : 'justify-start'} ${showAvatar ? '' : 'px-1'}`}>
      {showAvatar && <UserAvatar user={message.user} size={36} />}
      <div
        onContextMenu={(event) => {
          if (!isOwn) return;
          event.preventDefault();
          setContextMenuPosition({ x: event.clientX, y: event.clientY });
        }}
        className={`group relative max-w-[82%] border px-3 py-2 shadow-sm md:max-w-[74%] ${
          isOwn
            ? isFailed
              ? 'rounded-[8px] border-deep-red/30 bg-soft-rose/30 text-deep-red'
              : 'rounded-[8px] border-[#dcc8bd] bg-[#efe3dc] text-almost-black-green'
            : 'rounded-[8px] border-soft-ivory bg-white text-almost-black-green'
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

        <div className="mt-1 flex items-end justify-between gap-2">
          <p className="whitespace-pre-wrap text-[15px] leading-[1.3] text-almost-black-green">{message.content}</p>
          <div className="shrink-0 self-end pb-0.5 text-[0.72rem]">
            <div className="flex items-center justify-end gap-0.5">
              <span className="text-almost-black-green/55">{timestamp}</span>
              {resolvedStatus && <span className={statusClass[resolvedStatus] || 'text-almost-black-green/50'}>{statusIcon[resolvedStatus]}</span>}
            </div>
          </div>
        </div>
      </div>
      {contextMenuPosition && (
        <div
          className="fixed z-50 min-w-[250px] overflow-hidden rounded-xl border border-white/10 bg-[#141414] py-1 text-white shadow-2xl"
          style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
        >
          {[
            { icon: Reply, label: 'Reply' },
            { icon: Smile, label: 'React' },
            { icon: Forward, label: 'Forward' },
            { icon: Copy, label: 'Copy' },
            { icon: Pencil, label: 'Edit' },
            { icon: Info, label: 'Info' },
            { divider: true },
            { icon: Trash2, label: 'Delete' },
            { divider: true },
            { icon: CheckCircle2, label: 'Select messages' },
          ].map((entry, index) => {
            if ('divider' in entry) {
              return <div key={`divider-${index}`} className="my-1 border-t border-white/20" />;
            }

            const Icon = entry.icon;
            return (
              <button
                key={entry.label}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  if (entry.label === 'Copy') {
                    void navigator.clipboard?.writeText(message.content || '');
                  }
                  setContextMenuPosition(null);
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-[1.05rem] text-white/90 hover:bg-white/10"
              >
                <Icon className="h-4 w-4 text-white/80" />
                <span>{entry.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
