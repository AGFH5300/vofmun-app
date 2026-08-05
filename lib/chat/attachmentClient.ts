import { getBrowserAccessToken } from '@/lib/auth/browserAuthFetch';
import type { MessageAttachmentInput } from '@/lib/chat/types';

type JsonRecord = Record<string, unknown>;

const readJson = async (response: Response): Promise<JsonRecord> => {
  const payload = await response.json().catch(() => ({}));
  return payload && typeof payload === 'object' ? (payload as JsonRecord) : {};
};

const requireAccessToken = async (context: string) => {
  const accessToken = await getBrowserAccessToken(context);
  if (!accessToken) throw new Error('Your session has expired. Please sign in again.');
  return accessToken;
};

export const uploadChatAttachment = async (
  roomId: string,
  file: File,
  timeoutMs: number,
): Promise<MessageAttachmentInput> => {
  const accessToken = await requireAccessToken('chat-attachment-upload');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const formData = new FormData();
    formData.append('roomId', roomId);
    formData.append('file', file);

    const response = await fetch('/api/chat/attachments/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
      signal: controller.signal,
    });
    const payload = await readJson(response);
    if (!response.ok) {
      throw new Error(String(payload.error || 'Upload failed'));
    }

    return payload as MessageAttachmentInput;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Upload timed out. Please try again.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
};

export const deletePendingChatAttachment = async (uploadId: string): Promise<void> => {
  if (!uploadId) return;
  const accessToken = await requireAccessToken('chat-attachment-delete');
  const response = await fetch('/api/chat/attachments/pending', {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ upload_id: uploadId }),
  });
  const payload = await readJson(response);
  if (!response.ok && response.status !== 404) {
    throw new Error(String(payload.error || 'Unable to remove attachment'));
  }
};

export const getChatAttachmentSignedUrl = async (
  attachmentId: string,
  options?: { download?: boolean },
): Promise<string> => {
  const accessToken = await requireAccessToken('chat-attachment-link');
  const response = await fetch('/api/chat/attachments/sign', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      attachment_id: attachmentId,
      download: Boolean(options?.download),
    }),
  });
  const payload = await readJson(response);
  if (!response.ok || typeof payload.signed_url !== 'string') {
    throw new Error(String(payload.error || 'Attachment unavailable'));
  }
  return payload.signed_url;
};
