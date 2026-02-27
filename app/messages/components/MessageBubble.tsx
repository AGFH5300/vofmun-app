// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React, { useEffect } from 'react';
import { MessageWithUser, RoomMember } from '@/lib/chat/types';
import { useSession } from '@/app/context/sessionContext';
import { normalizeMessageMeta } from '@/lib/chat/messageMeta';
import UserAvatar from './UserAvatar';
import { AlertCircle, Check, CheckCheck, CheckCircle2, Clock, Copy, Forward, Info, Pencil, Reply, Smile, Trash2 } from 'lucide-react';

interface Props {
  message: MessageWithUser;
  isOwn: boolean;
  roomMemberIds?: string[];
  roomMembers?: RoomMember[];
  showAuthor?: boolean;
  showAvatar?: boolean;
  presenceDeliveredHint?: boolean;
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

const formatReceiptTime = (value: string | null) => {
  if (!value) return null;

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDay = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate());
  const dayDelta = Math.round((today.getTime() - messageDay.getTime()) / (1000 * 60 * 60 * 24));

  const timeLabel = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  if (dayDelta === 0) return `today ${timeLabel}`;
  if (dayDelta === 1) return `yesterday ${timeLabel}`;
  return `${timestamp.toLocaleDateString([], { day: '2-digit', month: 'short' }).toLowerCase()} ${timeLabel}`;
};

const resolveReceiptStatus = (
  message: MessageWithUser,
  isOwn: boolean,
  currentUserId: string | null,
  roomMemberIds: string[] = [],
  presenceDeliveredHint = false
) => {
  if (!isOwn) return undefined;
  if (message.status === 'pending' || message.status === 'error') return message.status;

  const normalizedCurrentUserId = currentUserId ? String(currentUserId) : null;
  if (!normalizedCurrentUserId) return 'sent';

  const meta = normalizeMessageMeta(message.meta);
  const deliveredReceipts = meta.receipts?.delivered || {};
  const readReceipts = meta.receipts?.read || {};

  const otherParticipants = roomMemberIds
    .map((id) => String(id))
    .filter((id) => id && id !== normalizedCurrentUserId);

  if (otherParticipants.length === 0) return 'sent';

  const isDeliveredForAll = otherParticipants.every(
    (memberId) => Boolean(deliveredReceipts[String(memberId)]) || Boolean(readReceipts[String(memberId)])
  );
  const isReadForAll = otherParticipants.every((memberId) => Boolean(readReceipts[String(memberId)]));

  if (isReadForAll) return 'read';
  if (isDeliveredForAll || presenceDeliveredHint) return 'delivered';
  return 'sent';
};

const MessageBubble: React.FC<Props> = ({
  message,
  isOwn,
  roomMemberIds = [],
  roomMembers: _roomMembers = [],
  showAuthor = true,
  showAvatar = true,
  presenceDeliveredHint = false,
}) => {
  const { user } = useSession();
  const currentUserId =
    ('delegateID' in (user || {}) && user?.delegateID ? user.delegateID : null) ||
    ('chairID' in (user || {}) && user?.chairID ? user.chairID : null) ||
    ('adminID' in (user || {}) && user?.adminID ? user.adminID : null) ||
    ('secretariatID' in (user || {}) && user?.secretariatID ? user.secretariatID : null) ||
    ('id' in (user || {}) && user?.id ? user.id : null);
  const [contextMenuPosition, setContextMenuPosition] = React.useState<{ x: number; y: number } | null>(null);
  const [showInfoSheet, setShowInfoSheet] = React.useState(false);
  const isFailed = message.status === 'error';
  const resolvedStatus = resolveReceiptStatus(
    message,
    isOwn,
    currentUserId ? String(currentUserId) : null,
    roomMemberIds,
    presenceDeliveredHint
  );

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

  const receiptMeta = normalizeMessageMeta(message.meta);
  const resolvedCurrentUserId = currentUserId ? String(currentUserId) : null;
  const participantIds = roomMemberIds.filter((id) => id && id !== resolvedCurrentUserId);

  const hasKnownMembers = _roomMembers.length > 0;

  const deliveredEntries = participantIds
    .map((memberId) => ({
      memberId,
      at: receiptMeta.receipts.delivered[String(memberId)] || receiptMeta.receipts.read[String(memberId)] || null,
    }))
    .filter((entry) => entry.at)
    .sort((a, b) => new Date(String(b.at)).getTime() - new Date(String(a.at)).getTime());

  const readEntries = participantIds
    .map((memberId) => ({
      memberId,
      at: receiptMeta.receipts.read[String(memberId)] || null,
    }))
    .filter((entry) => entry.at)
    .sort((a, b) => new Date(String(b.at)).getTime() - new Date(String(a.at)).getTime());

  const deliveredAt = deliveredEntries[0]?.at ? String(deliveredEntries[0].at) : null;
  const readAt = readEntries[0]?.at ? String(readEntries[0].at) : null;

  const contextActions: Array<{ icon: typeof Reply; label: string } | { divider: true }> = [
    { icon: Reply, label: 'Reply' },
    { icon: Smile, label: 'React' },
    { icon: Forward, label: 'Forward' },
    { icon: Copy, label: 'Copy' },
    ...(isOwn ? [{ icon: Pencil, label: 'Edit' }] : []),
    { icon: Info, label: 'Info' },
    { divider: true },
    ...(isOwn ? [{ icon: Trash2, label: 'Delete' }] : []),
    { icon: CheckCircle2, label: 'Select messages' },
  ];

  return (
    <div className={`flex gap-2 ${isOwn ? 'justify-end' : 'justify-start'} ${showAvatar ? '' : 'px-1'}`}>
      {showAvatar && <UserAvatar user={message.user} size={36} />}
      <div
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
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
          {contextActions.map((entry, index) => {
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
                  if (entry.label === 'Info') {
                    setShowInfoSheet(true);
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
      {showInfoSheet && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 px-4"
          onClick={() => setShowInfoSheet(false)}
        >
          <div
            className="w-full max-w-[640px] rounded-[14px] border border-white/10 bg-[#2f2f2f] text-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="divide-y divide-white/10">
              <div className="flex items-center gap-3 px-5 py-4">
                <CheckCheck className="h-7 w-7 text-[#58c8ff]" />
                <span className="text-3xl font-medium leading-none tracking-tight sm:text-[2.1rem]">Read</span>
                <span className="ml-auto text-sm font-medium text-white/85 sm:text-base">
                  {readAt ? formatReceiptTime(readAt) : '•••'}
                </span>
              </div>
              <div className="flex items-center gap-3 px-5 py-4">
                <CheckCheck className="h-7 w-7 text-white/55" />
                <span className="text-3xl font-medium leading-none tracking-tight text-white/90 sm:text-[2.1rem]">Delivered</span>
                <span className="ml-auto text-sm font-medium text-white/75 sm:text-base">
                  {deliveredAt ? formatReceiptTime(deliveredAt) : hasKnownMembers ? 'pending' : 'sent'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
