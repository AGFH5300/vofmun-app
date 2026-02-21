// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
import { MessageStatus, MessageWithUser } from '@/lib/chat/types';

export type ReceiptMap = Record<string, string>;

export interface MessageMeta {
  receipts: {
    delivered: ReceiptMap;
    read: ReceiptMap;
  };
  reactions: Record<string, string[]>;
  edits: {
    history: Array<{ at: string; from: string; to: string }>;
  };
  deleted: {
    is_deleted: boolean;
    deleted_at: string | null;
    deleted_by: string | null;
    mode: string | null;
  };
}

export const createDefaultMessageMeta = (): MessageMeta => ({
  receipts: {
    delivered: {},
    read: {},
  },
  reactions: {},
  edits: {
    history: [],
  },
  deleted: {
    is_deleted: false,
    deleted_at: null,
    deleted_by: null,
    mode: null,
  },
});

export const normalizeMessageMeta = (meta: unknown): MessageMeta => {
  const base = createDefaultMessageMeta();
  if (!meta || typeof meta !== 'object') return base;

  const source = meta as Record<string, unknown>;
  const receipts = source.receipts && typeof source.receipts === 'object' ? (source.receipts as Record<string, unknown>) : {};
  const edits = source.edits && typeof source.edits === 'object' ? (source.edits as Record<string, unknown>) : {};
  const deleted = source.deleted && typeof source.deleted === 'object' ? (source.deleted as Record<string, unknown>) : {};

  return {
    ...base,
    ...source,
    receipts: {
      delivered: receipts.delivered && typeof receipts.delivered === 'object' ? (receipts.delivered as ReceiptMap) : {},
      read: receipts.read && typeof receipts.read === 'object' ? (receipts.read as ReceiptMap) : {},
    },
    reactions: source.reactions && typeof source.reactions === 'object' ? (source.reactions as Record<string, string[]>) : {},
    edits: {
      history: Array.isArray(edits.history) ? (edits.history as Array<{ at: string; from: string; to: string }>) : [],
    },
    deleted: {
      is_deleted: Boolean(deleted.is_deleted),
      deleted_at: typeof deleted.deleted_at === 'string' || deleted.deleted_at === null ? deleted.deleted_at : null,
      deleted_by: typeof deleted.deleted_by === 'string' || deleted.deleted_by === null ? deleted.deleted_by : null,
      mode: typeof deleted.mode === 'string' || deleted.mode === null ? deleted.mode : null,
    },
  };
};

export const resolveOwnMessageStatus = (
  message: MessageWithUser,
  currentUserId: string | null,
  roomMemberIds: string[]
): MessageStatus => {
  void roomMemberIds;
  if (message.status === 'pending' || message.status === 'error') return message.status;
  if (!currentUserId || String(message.user_id) !== String(currentUserId)) return message.status || 'sent';
  return 'sent';
};
