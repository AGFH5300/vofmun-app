// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';
import { getSessionUserFromRequest } from '@/lib/chat/auth';
import { fetchProfilesByIds } from '@/app/api/rooms/_lib/rooms';
import { MessageAttachmentInput, MessageWithUser } from '@/lib/chat/types';
import { createDefaultMessageMeta } from '@/lib/chat/messageMeta';
import { assertNoLegacyChatIdentityDev } from '@/lib/chat/auth';

const sanitizeAttachmentName = (name: string) => {
  const normalized = name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized.slice(0, 120) || 'file';
};

const isAllowedAttachmentPath = (roomId: string, path: string) => {
  const segments = String(path || '').split('/').filter(Boolean);
  if (segments.length < 3) return false;
  return segments[0] === roomId;
};

export async function GET(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const sessionUser = getSessionUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { roomId } = await params;

    const { data: membershipRows, error: membershipError } = await supabaseAdmin
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', sessionUser.id)
      .limit(1);

    if (membershipError) {
      console.error('[api rooms messages] failed membership check', {
        roomId,
        userId: sessionUser.id,
        error: membershipError,
      });
      return NextResponse.json({ error: 'Failed to validate room membership' }, { status: 500 });
    }

    if (!membershipRows || membershipRows.length === 0) {
      return NextResponse.json({ error: 'Not a room member' }, { status: 403 });
    }

    const { data: messages } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    const messageIds = (messages || []).map((message) => String(message.id));
    let attachments: Record<string, unknown>[] = [];

    if (messageIds.length > 0) {
      const { data: attachmentRows } = await supabaseAdmin
        .from('message_attachments')
        .select('*')
        .eq('room_id', roomId)
        .in('message_id', messageIds)
        .order('created_at', { ascending: true });
      attachments = (attachmentRows as Record<string, unknown>[] | null) || [];
    }

    const attachmentMap = attachments.reduce<Record<string, Record<string, unknown>[]>>((acc, attachment) => {
      const key = String(attachment.message_id || '');
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push(attachment);
      return acc;
    }, {});

    const profiles = await fetchProfilesByIds((messages || []).map((msg) => msg.user_id));
    const formatted = (messages || []).map(
      (msg) => ({ ...msg, user: profiles[msg.user_id], attachments: attachmentMap[String(msg.id)] || [] } as MessageWithUser)
    );

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('[api rooms messages] failed to load messages', error);
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const sessionUser = getSessionUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { roomId } = await params;
    const parsedBody = (await request.json().catch(() => ({}))) as {
      content?: string;
      reply_to?: string | null;
      attachments?: MessageAttachmentInput[];
    };
    const { content, reply_to, attachments = [] } = parsedBody;

    console.debug('[api rooms messages] parsed request body', {
      roomId,
      userId: sessionUser.id,
      hasContent: typeof content === 'string',
      hasReplyTo: typeof reply_to !== 'undefined',
      hasAttachmentsArray: Array.isArray(attachments),
      attachmentKeys: Array.isArray(attachments) ? attachments.map((attachment) => Object.keys(attachment || {})) : [],
    });

    const trimmedContent = content?.trim() || '';
    const normalizedAttachments = Array.isArray(attachments) ? attachments : [];

    console.debug('[api rooms messages] message payload lengths', {
      roomId,
      userId: sessionUser.id,
      contentLength: trimmedContent.length,
      attachmentsLength: normalizedAttachments.length,
    });

    assertNoLegacyChatIdentityDev(sessionUser.id, 'messages:insert:user_id');

    if (!trimmedContent && normalizedAttachments.length === 0) {
      console.warn('[api rooms messages] validation failed', {
        roomId,
        userId: sessionUser.id,
        reason: 'both content and attachments are empty',
      });
      return NextResponse.json({ error: 'Message content or attachments are required' }, { status: 400 });
    }

    const hasInvalidAttachment = normalizedAttachments.some((attachment) => {
      if (!attachment || typeof attachment !== 'object') return true;
      if (String(attachment.room_id || '') !== roomId) return true;
      if (!attachment.bucket || !attachment.path || !attachment.original_name || !attachment.mime_type) return true;
      if (!Number.isFinite(Number(attachment.size_bytes)) || Number(attachment.size_bytes) <= 0) return true;
      return !isAllowedAttachmentPath(roomId, String(attachment.path || ''));
    });

    if (hasInvalidAttachment) {
      console.warn('[api rooms messages] validation failed', {
        roomId,
        userId: sessionUser.id,
        reason: 'invalid attachment payload shape',
      });
      return NextResponse.json({ error: 'Invalid attachment payload' }, { status: 400 });
    }

    const { data: membershipRows, error: membershipError } = await supabaseAdmin
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', sessionUser.id)
      .limit(1);

    if (membershipError) {
      console.error('[api rooms messages] failed membership check before insert', {
        roomId,
        userId: sessionUser.id,
        error: membershipError,
      });
      return NextResponse.json({ error: 'Failed to validate room membership' }, { status: 500 });
    }

    if (!membershipRows || membershipRows.length === 0) {
      return NextResponse.json({ error: 'Not a room member' }, { status: 403 });
    }

    const { data: inserted, error } = await supabaseAdmin
      .from('messages')
      .insert({
        room_id: roomId,
        user_id: sessionUser.id,
        content: trimmedContent,
        reply_to: reply_to || null,
        meta: createDefaultMessageMeta(),
      })
      .select('*')
      .single();

    if (error || !inserted) {
      console.error('[api rooms messages] insert failed', {
        roomId,
        userId: sessionUser.id,
        error,
      });
      return NextResponse.json({ error: 'Failed to send message', details: error?.message || null }, { status: 500 });
    }

    console.debug('[api rooms messages] created message', {
      roomId,
      userId: sessionUser.id,
      messageId: inserted.id,
    });

    if (normalizedAttachments.length > 0) {
      const attachmentRows = normalizedAttachments.map((attachment) => ({
        message_id: inserted.id,
        room_id: roomId,
        bucket: String(attachment.bucket || 'chat-attachments'),
        path: String(attachment.path || ''),
        original_name: sanitizeAttachmentName(String(attachment.original_name || 'file')),
        mime_type: attachment.mime_type || null,
        size_bytes: Number(attachment.size_bytes || 0),
        created_by: sessionUser.id,
      }));

      const { error: attachmentError } = await supabaseAdmin.from('message_attachments').insert(attachmentRows);
      console.debug('[api rooms messages] attachment insert result', {
        roomId,
        userId: sessionUser.id,
        messageId: inserted.id,
        attempted: attachmentRows.length,
        success: !attachmentError,
        error: attachmentError?.message || null,
      });
      if (attachmentError) {
        console.error('[api rooms messages] attachment insert failed', {
          roomId,
          userId: sessionUser.id,
          messageId: inserted.id,
          error: attachmentError,
        });
        await supabaseAdmin.from('message_attachments').delete().eq('message_id', inserted.id);
        await supabaseAdmin.from('messages').delete().eq('id', inserted.id);
        return NextResponse.json({ error: 'Failed to save attachments' }, { status: 500 });
      }
    }

    try {
      const profiles = await fetchProfilesByIds([inserted.user_id]);
      const { data: attachmentRows } = await supabaseAdmin
        .from('message_attachments')
        .select('*')
        .eq('message_id', inserted.id)
        .order('created_at', { ascending: true });

      const payload: MessageWithUser = { ...inserted, user: profiles[inserted.user_id], attachments: attachmentRows || [] };
      return NextResponse.json(payload);
    } catch (profileError) {
      console.error('[api rooms messages] profile enrichment failed after insert', {
        roomId,
        userId: sessionUser.id,
        insertedMessageId: inserted.id,
        error: profileError,
      });
      return NextResponse.json(inserted);
    }
  } catch (error) {
    console.error('[api rooms messages] failed to send message', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
