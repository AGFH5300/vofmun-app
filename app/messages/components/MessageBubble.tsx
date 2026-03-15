// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React, { useEffect } from 'react';
import { toast } from 'sonner';
import { MessageAttachment, MessageWithUser, RoomMember } from '@/lib/chat/types';
import supabase from '@/lib/supabase';
import { useSession } from '@/app/context/sessionContext';
import { normalizeMessageMeta } from '@/lib/chat/messageMeta';
import UserAvatar from './UserAvatar';
import { AlertCircle, Check, CheckCheck, CheckCircle2, Clock, Copy, Download, FileText, Forward, Info, Pencil, Reply, Smile, Trash2, X } from 'lucide-react';

interface Props {
  message: MessageWithUser;
  isOwn: boolean;
  roomMemberIds?: string[];
  roomMembers?: RoomMember[];
  showAuthor?: boolean;
  showAvatar?: boolean;
  presenceDeliveredHint?: boolean;
  onEditMessage?: (messageId: string, content: string) => Promise<void>;
  onDeleteMessage?: (messageId: string) => Promise<void>;
  onReplyMessage?: (message: MessageWithUser) => void;
  repliedToMessage?: MessageWithUser | null;
  isGroupRoom?: boolean;
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

  const day = String(timestamp.getDate()).padStart(2, '0');
  const month = String(timestamp.getMonth() + 1).padStart(2, '0');
  const year = timestamp.getFullYear();
  const timeLabel = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day}/${month}/${year} ${timeLabel}`;
};




const EMOJI_ONLY_MESSAGE_REGEX = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|\uFE0F|\u200D|\s)+$/u;

const isEmojiOnlyMessage = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /\p{Extended_Pictographic}/u.test(trimmed) && EMOJI_ONLY_MESSAGE_REGEX.test(trimmed);
};

const SIGNED_URL_TTL_SECONDS = 60 * 60;
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

const areStringMapsEqual = (prev: Record<string, string>, next: Record<string, string>) => {
  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);
  if (prevKeys.length !== nextKeys.length) return false;

  return prevKeys.every((key) => prev[key] === next[key]);
};

const formatAttachmentSize = (sizeBytes: number) => {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) return '0 B';
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isImageAttachment = (attachment: MessageAttachment) => String(attachment.mime_type || '').startsWith('image/');

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
  showAuthor = true,
  showAvatar = true,
  presenceDeliveredHint = false,
  onEditMessage,
  onDeleteMessage,
  onReplyMessage,
  repliedToMessage = null,
  roomMembers = [],
  isGroupRoom = false,
}) => {
  const { user } = useSession();
  const currentUserId = user?.id ? String(user.id) : null;
  const [contextMenuPosition, setContextMenuPosition] = React.useState<{ x: number; y: number } | null>(null);
  const bubbleMenuId = React.useMemo(() => `message-menu-${message.id}`, [message.id]);
  const [infoPanelPosition, setInfoPanelPosition] = React.useState<{ x: number; y: number } | null>(null);
  const [showInfoSheet, setShowInfoSheet] = React.useState(false);
  const bubbleRef = React.useRef<HTMLDivElement | null>(null);
  const isFailed = message.status === 'error';
  const resolvedStatus = resolveReceiptStatus(
    message,
    isOwn,
    currentUserId ? String(currentUserId) : null,
    roomMemberIds,
    presenceDeliveredHint
  );

  useEffect(() => {
    if (!contextMenuPosition && !showInfoSheet) return;

    const closeMenu = () => {
      setContextMenuPosition(null);
      setShowInfoSheet(false);
    };
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
  }, [contextMenuPosition, showInfoSheet]);

  useEffect(() => {
    const handleAnotherMenuOpen = (event: Event) => {
      const customEvent = event as CustomEvent<{ id?: string }>;
      if (customEvent.detail?.id !== bubbleMenuId) {
        setContextMenuPosition(null);
        setShowInfoSheet(false);
      }
    };

    window.addEventListener('vofmun-message-menu-opened', handleAnotherMenuOpen);
    return () => window.removeEventListener('vofmun-message-menu-opened', handleAnotherMenuOpen);
  }, [bubbleMenuId]);

  const clampPosition = React.useCallback((x: number, y: number, width: number, height: number) => {
    const spacing = 12;
    const maxX = Math.max(spacing, window.innerWidth - width - spacing);
    const maxY = Math.max(spacing, window.innerHeight - height - spacing);
    return {
      x: Math.min(Math.max(x, spacing), maxX),
      y: Math.min(Math.max(y, spacing), maxY),
    };
  }, []);

  const openInfoPanel = React.useCallback(() => {
    const bubbleRect = bubbleRef.current?.getBoundingClientRect();
    if (!bubbleRect) {
      setInfoPanelPosition(clampPosition(window.innerWidth / 2 - 138, window.innerHeight / 2 - 60, 275, 120));
      setShowInfoSheet(true);
      return;
    }

    const panelWidth = 275;
    const panelHeight = 120;
    const gap = 12;
    const horizontalOffset = isOwn ? bubbleRect.left - panelWidth - gap : bubbleRect.right + gap;
    const verticalOffset = bubbleRect.top;
    setInfoPanelPosition(clampPosition(horizontalOffset, verticalOffset, panelWidth, panelHeight));
    setShowInfoSheet(true);
  }, [clampPosition, isOwn]);

  const timestamp = message.created_at
    ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  const receiptMeta = normalizeMessageMeta(message.meta);
  const resolvedCurrentUserId = currentUserId ? String(currentUserId) : null;
  const participantIds = roomMemberIds.filter((id) => id && id !== resolvedCurrentUserId);

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


  const [attachmentUrls, setAttachmentUrls] = React.useState<Record<string, string>>({});
  const [attachmentErrors, setAttachmentErrors] = React.useState<Record<string, string>>({});
  const [downloadingAttachmentPath, setDownloadingAttachmentPath] = React.useState<string | null>(null);
  const attachments = React.useMemo(() => message.attachments || [], [message.attachments]);
  const attachmentSignature = React.useMemo(
    () => attachments.map((attachment) => `${attachment.id}:${attachment.bucket}:${attachment.path}`).join('|'),
    [attachments]
  );
  const isLargeEmojiMessage = Boolean(message.content) && isEmojiOnlyMessage(message.content) && !/\s/.test(message.content.trim());
  const isDeleted = Boolean(message.deleted_at);
  const canEditMessage = isOwn && !isDeleted && typeof onEditMessage === 'function';
  const canDeleteMessage = isOwn && !isDeleted && typeof onDeleteMessage === 'function';
  const canReplyMessage = typeof onReplyMessage === 'function';
  const canViewInfo = isOwn;
  const [touchStart, setTouchStart] = React.useState<{ x: number; y: number } | null>(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editingText, setEditingText] = React.useState(message.content || '');
  const [isSubmittingEdit, setIsSubmittingEdit] = React.useState(false);
  const [isSubmittingDelete, setIsSubmittingDelete] = React.useState(false);

  useEffect(() => {
    if (!isEditing) {
      setEditingText(message.content || '');
    }
  }, [isEditing, message.content]);

  useEffect(() => {
    if (attachments.length === 0) {
      setAttachmentUrls((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      setAttachmentErrors((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }

    let cancelled = false;
    const hydrateAttachmentUrls = async () => {
      const now = Date.now();
      const nextMap: Record<string, string> = {};
      const nextErrors: Record<string, string> = {};

      await Promise.all(
        attachments.map(async (attachment) => {
          if (!attachment.bucket || !attachment.path) return;

          const cacheKey = `${attachment.bucket}:${attachment.path}`;
          const cached = signedUrlCache.get(cacheKey);
          if (cached && cached.expiresAt > now + 5_000) {
            nextMap[attachment.path] = cached.url;
            return;
          }

          const { data, error } = await supabase.storage
            .from(attachment.bucket)
            .createSignedUrl(attachment.path, SIGNED_URL_TTL_SECONDS);

          if (!error && data?.signedUrl) {
            signedUrlCache.set(cacheKey, {
              url: data.signedUrl,
              expiresAt: now + SIGNED_URL_TTL_SECONDS * 1000,
            });
            nextMap[attachment.path] = data.signedUrl;
            return;
          }

          const message = String(error?.message || 'Attachment unavailable');
          if (error) {
            console.warn('[chat] failed to hydrate attachment URL', {
              attachmentId: attachment.id,
              bucket: attachment.bucket,
              path: attachment.path,
              error,
            });
          }
          nextErrors[attachment.path] = /not found/i.test(message) ? 'Attachment no longer exists.' : 'Attachment unavailable.';
        })
      );

      if (!cancelled) {
        setAttachmentUrls((prev) => (areStringMapsEqual(prev, nextMap) ? prev : nextMap));
        setAttachmentErrors((prev) => (areStringMapsEqual(prev, nextErrors) ? prev : nextErrors));
      }
    };

    void hydrateAttachmentUrls();

    return () => {
      cancelled = true;
    };
  }, [attachmentSignature, attachments]);

  const contextActions: Array<{ icon: typeof Reply; label: string } | { divider: true }> = [
    ...(canReplyMessage ? [{ icon: Reply, label: 'Reply' }] : []),
    { icon: Smile, label: 'React' },
    { icon: Forward, label: 'Forward' },
    { icon: Copy, label: 'Copy' },
    ...(canEditMessage ? [{ icon: Pencil, label: 'Edit' }] : []),
    ...(canViewInfo ? [{ icon: Info, label: 'Info' }] : []),
    { divider: true },
    ...(canDeleteMessage ? [{ icon: Trash2, label: 'Delete' }] : []),
    { icon: CheckCircle2, label: 'Select messages' },
  ];

  const handleAttachmentDownload = async (attachment: MessageAttachment) => {
    if (!attachment.bucket || !attachment.path) return;

    setDownloadingAttachmentPath(attachment.path);
    try {
      const { data, error } = await supabase.storage
        .from(attachment.bucket)
        .createSignedUrl(attachment.path, 60, { download: attachment.original_name || true });

      if (error || !data?.signedUrl) {
        console.error('[chat] failed to create signed download URL', {
          attachmentId: attachment.id,
          bucket: attachment.bucket,
          path: attachment.path,
          error,
        });
        return;
      }

      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloadingAttachmentPath(null);
    }
  };

  return (
    <div className={`flex gap-2 ${isOwn ? 'justify-end' : 'justify-start'} ${showAvatar ? '' : 'px-1'}`}>
      {showAvatar && <UserAvatar user={message.user} size={36} />}
      <div
        ref={bubbleRef}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          window.dispatchEvent(new CustomEvent('vofmun-message-menu-opened', { detail: { id: bubbleMenuId } }));
          const menuWidth = 220;
          const menuHeight = isOwn ? 314 : 264;
          setContextMenuPosition(clampPosition(event.clientX, event.clientY, menuWidth, menuHeight));
        }}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          if (!touch) return;
          setTouchStart({ x: touch.clientX, y: touch.clientY });
        }}
        onTouchEnd={(event) => {
          if (!canReplyMessage || !touchStart) return;
          const touch = event.changedTouches[0];
          if (!touch) return;
          const deltaX = touch.clientX - touchStart.x;
          const deltaY = touch.clientY - touchStart.y;
          if (Math.abs(deltaY) > 40) return;
          const swipeThreshold = 64;
          const shouldReply = isOwn ? deltaX < -swipeThreshold : deltaX > swipeThreshold;
          if (shouldReply) {
            onReplyMessage?.(message);
          }
          setTouchStart(null);
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
          <p className="text-[0.66rem] font-medium uppercase tracking-[0.08em] text-deep-red/85">
            {message.user?.full_name || `${message.user?.first_name || ''} ${message.user?.last_name || ''}`.trim() || message.user?.email || String(message.user_id || 'Participant')}
          </p>
        )}

        {message.reply_to && (
          <div
            className={`mt-2 rounded-lg border-l-2 px-3 py-2 text-xs ${
              isOwn ? (isFailed ? 'border-deep-red/50 bg-deep-red/10 text-deep-red/80' : 'border-deep-red/40 bg-white/70 text-almost-black-green/75') : 'border-deep-red/35 bg-black/5 text-almost-black-green/70'
            }`}
          >
            <p className="font-semibold text-deep-red/90">{repliedToMessage?.user?.full_name || 'Original message'}</p>
            <p className="mt-0.5 line-clamp-2">
              {repliedToMessage?.deleted_at
                ? 'This message was deleted.'
                : repliedToMessage?.content?.trim() || 'Original message unavailable.'}
            </p>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="mt-2 space-y-2">
            {attachments.map((attachment) => {
              const url = attachmentUrls[attachment.path];
              const attachmentError = attachmentErrors[attachment.path];
              const isImage = isImageAttachment(attachment);

              if (isImage) {
                return (
                  <a
                    key={attachment.id || attachment.path}
                    href={url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => {
                      if (!url) {
                        event.preventDefault();
                      }
                    }}
                    className="block overflow-hidden rounded-lg border border-black/10 bg-white/60"
                  >
                    {url ? (
                      <img
                        src={url}
                        alt={attachment.original_name}
                        className="max-h-56 w-full object-cover"
                      />
                    ) : attachmentError ? (
                      <div className="flex h-24 items-center justify-center px-3 text-center text-xs text-deep-red/80">{attachmentError}</div>
                    ) : (
                      <div className="flex h-24 items-center justify-center text-xs text-almost-black-green/60">Loading preview…</div>
                    )}
                  </a>
                );
              }

              return (
                <div
                  key={attachment.id || attachment.path}
                  className="flex items-center gap-3 rounded-xl border border-black/10 bg-white/85 px-3 py-2.5"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#efe3dc] text-deep-red">
                    <FileText className="h-4 w-4 shrink-0" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-almost-black-green">{attachment.original_name}</p>
                    <p className="text-[11px] text-almost-black-green/60">
                      {formatAttachmentSize(Number(attachment.size_bytes || 0))} • {String(attachment.mime_type || 'file').split('/')[1] || String(attachment.mime_type || 'file')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleAttachmentDownload(attachment)}
                    disabled={downloadingAttachmentPath === attachment.path || Boolean(attachmentError)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 text-almost-black-green/70 hover:bg-white"
                    aria-label={`Download ${attachment.original_name}`}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-1 flex items-end justify-between gap-2">
          {isEditing ? (
            <form
              className="w-full"
              onSubmit={async (event) => {
                event.preventDefault();
                const trimmed = editingText.trim();
                if (!trimmed || trimmed === (message.content || '').trim()) {
                  setIsEditing(false);
                  return;
                }

                setIsSubmittingEdit(true);
                try {
                  await onEditMessage?.(String(message.id), trimmed);
                  setIsEditing(false);
                  toast.success('Message updated');
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Failed to edit message');
                } finally {
                  setIsSubmittingEdit(false);
                }
              }}
            >
              <textarea
                value={editingText}
                onChange={(event) => setEditingText(event.target.value)}
                rows={2}
                className="w-full resize-none rounded-lg border border-[#d5c5ba] bg-white/80 px-2 py-1.5 text-[14px] text-almost-black-green outline-none focus:border-[#8b2424]/50"
                disabled={isSubmittingEdit}
              />
              <div className="mt-1 flex items-center gap-2 text-xs">
                <button type="submit" disabled={isSubmittingEdit} className="rounded-md bg-[#701e1e] px-2 py-1 text-white disabled:opacity-60">
                  {isSubmittingEdit ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-black/10 px-2 py-1 text-almost-black-green/75"
                  onClick={() => {
                    setEditingText(message.content || '');
                    setIsEditing(false);
                  }}
                  disabled={isSubmittingEdit}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : message.content ? (
            <p
              className={`whitespace-pre-wrap text-almost-black-green ${
                isDeleted
                  ? 'text-[14px] italic leading-[1.3] text-almost-black-green/55'
                  : isLargeEmojiMessage
                    ? 'text-[40px] leading-none'
                    : 'text-[15px] leading-[1.3]'
              }`}
            >
              {message.content}
              {message.edited_at && !isDeleted ? <span className="ml-1 text-[11px] text-almost-black-green/50">(edited)</span> : null}
            </p>
          ) : (
            <span />
          )}
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
          className="fixed z-50 min-w-[220px] overflow-hidden rounded-2xl border border-[#d8d8d8] bg-[#f8f8f8] py-1 text-[#111b21] shadow-2xl"
          style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
        >
          {contextActions.map((entry, index) => {
            if ('divider' in entry) {
              return <div key={`divider-${index}`} className="my-1 border-t border-[#d9d9d9]" />;
            }

            const Icon = entry.icon;
            return (
              <button
                key={entry.label}
                type="button"
                disabled={isSubmittingDelete}
                onClick={(event) => {
                  event.stopPropagation();
                  if (entry.label === 'Copy') {
                    if (message.content?.trim()) {
                      void navigator.clipboard?.writeText(message.content || '');
                      toast.success('Message copied', {
                        id: 'message-copied-toast',
                        icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
                      });
                    }
                  }
                  if (entry.label === 'Reply') {
                    onReplyMessage?.(message);
                  }
                  if (entry.label === 'Edit') {
                    setIsEditing(true);
                  }
                  if (entry.label === 'Delete') {
                    const shouldDelete = window.confirm('Delete this message?');
                    if (shouldDelete) {
                      setIsSubmittingDelete(true);
                      onDeleteMessage?.(String(message.id))
                        .then(() => {
                          toast.success('Message deleted');
                        })
                        .catch((error) => {
                          toast.error(error instanceof Error ? error.message : 'Failed to delete message');
                        })
                        .finally(() => {
                          setIsSubmittingDelete(false);
                        });
                    }
                  }
                  if (entry.label === 'Info' && canViewInfo) {
                    openInfoPanel();
                  }
                  setContextMenuPosition(null);
                }}
                className="flex w-full items-center gap-3 px-4 py-1.5 text-left text-[0.8rem] font-medium text-[#111b21]/90 hover:bg-[#ececec]"
              >
                <Icon className="h-4 w-4 shrink-0 text-[#111b21]/75" />
                <span>{entry.label}</span>
              </button>
            );
          })}
        </div>
      )}
      {showInfoSheet && canViewInfo && (
        <div
          className="fixed inset-0 z-[60]"
          onClick={() => setShowInfoSheet(false)}
        >
          <div
            className="w-full max-w-[320px] rounded-xl border border-[#d8d8d8] bg-[#f3f3f3] text-[#111b21] shadow-xl"
            style={
              infoPanelPosition
                ? {
                    left: infoPanelPosition.x,
                    top: infoPanelPosition.y,
                    position: 'fixed',
                  }
                : undefined
            }
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#d0d0d0] px-3 py-2">
              <p className="text-sm font-semibold">Message info</p>
              <button type="button" onClick={() => setShowInfoSheet(false)} className="rounded p-1 text-[#111b21]/70 hover:bg-black/5">
                <X className="h-4 w-4" />
              </button>
            </div>
            {isGroupRoom ? (
              <div className="space-y-3 p-3">
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#2f3a40]/80">Read by</p>
                  {readEntries.length > 0 ? (
                    <div className="space-y-1.5">
                      {readEntries.map((entry) => {
                        const member = roomMembers.find((candidate) => String(candidate.user_id) === String(entry.memberId));
                        return (
                          <div key={`read-${entry.memberId}`} className="flex items-center gap-2 rounded-lg bg-white/70 px-2.5 py-2">
                            <UserAvatar user={member?.user} size={26} />
                            <p className="min-w-0 flex-1 truncate text-xs font-medium">{member?.user?.full_name || 'Participant'}</p>
                            <p className="text-[11px] text-[#2f3a40]/75">{formatReceiptTime(String(entry.at)) || '—'}</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-lg bg-white/70 px-2.5 py-2 text-xs text-[#2f3a40]/70">No one has read this yet.</p>
                  )}
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#2f3a40]/80">Delivered to</p>
                  {deliveredEntries.filter((entry) => !readEntries.some((readEntry) => readEntry.memberId === entry.memberId)).length > 0 ? (
                    <div className="space-y-1.5">
                      {deliveredEntries
                        .filter((entry) => !readEntries.some((readEntry) => readEntry.memberId === entry.memberId))
                        .map((entry) => {
                          const member = roomMembers.find((candidate) => String(candidate.user_id) === String(entry.memberId));
                          return (
                            <div key={`delivered-${entry.memberId}`} className="flex items-center gap-2 rounded-lg bg-white/70 px-2.5 py-2">
                              <UserAvatar user={member?.user} size={26} />
                              <p className="min-w-0 flex-1 truncate text-xs font-medium">{member?.user?.full_name || 'Participant'}</p>
                              <p className="text-[11px] text-[#2f3a40]/75">{formatReceiptTime(String(entry.at)) || '—'}</p>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="rounded-lg bg-white/70 px-2.5 py-2 text-xs text-[#2f3a40]/70">No delivered-only receipts yet.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[#d0d0d0]">
                <div className="flex items-center gap-2.5 px-3 py-2.5">
                  <CheckCheck className="h-4 w-4 text-[#58c8ff]" />
                  <span className="text-[0.95rem] font-medium leading-none">Read</span>
                  <span className="ml-auto text-xs font-medium text-[#2f3a40]/85">
                    {readAt ? formatReceiptTime(readAt) : '•••'}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 px-3 py-2.5">
                  <CheckCheck className="h-4 w-4 text-[#707070]" />
                  <span className="text-[0.95rem] font-medium leading-none text-[#111b21]/90">Delivered</span>
                  <span className="ml-auto text-xs font-medium text-[#2f3a40]/80">
                    {deliveredAt ? formatReceiptTime(deliveredAt) : '•••'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default MessageBubble;
