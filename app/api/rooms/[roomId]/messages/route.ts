// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';
import { getVerifiedSessionUserFromRequest, assertNoLegacyChatIdentityDev } from '@/lib/chat/auth';
import { fetchProfilesByIds } from '@/app/api/rooms/_lib/rooms';
import { MessageAttachment, MessageAttachmentInput, MessageWithUser } from '@/lib/chat/types';
import { createDefaultMessageMeta } from '@/lib/chat/messageMeta';
import { Json } from '@/db/supabase-database.types';

const MAX_MESSAGE_LENGTH = 5000;
const MAX_ATTACHMENTS_PER_MESSAGE = 10;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const resetPendingUploads = async (uploadIds: string[], userId: string) => {
  if (!supabaseAdmin || uploadIds.length === 0) return;
  await supabaseAdmin
    .from('pending_chat_attachments')
    .update({ consumed_at: null })
    .in('id', uploadIds)
    .eq('created_by', userId);
};

export async function GET(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const sessionUser = await getVerifiedSessionUserFromRequest(request);
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

    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });
    if (messagesError) throw messagesError;

    const messageRows = (messages || []).filter(
      (message): message is typeof message & { user_id: string; room_id: string } =>
        Boolean(message.user_id && message.room_id),
    );
    const messageIds = messageRows.map((message) => String(message.id));
    let attachments: MessageAttachment[] = [];

    if (messageIds.length > 0) {
      const { data: attachmentRows, error: attachmentError } = await supabaseAdmin
        .from('message_attachments')
        .select('*')
        .eq('room_id', roomId)
        .in('message_id', messageIds)
        .order('created_at', { ascending: true });
      if (attachmentError) throw attachmentError;
      attachments = (attachmentRows || []) as MessageAttachment[];
    }

    const attachmentMap = attachments.reduce<Record<string, MessageAttachment[]>>((acc, attachment) => {
      const key = String(attachment.message_id || '');
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push(attachment);
      return acc;
    }, {});

    const profiles = await fetchProfilesByIds(messageRows.map((message) => message.user_id));
    const formatted = messageRows.map(
      (message) => ({
        ...message,
        user: profiles[message.user_id],
        attachments: attachmentMap[String(message.id)] || [],
      } as MessageWithUser),
    );

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('[api rooms messages] failed to load messages', error);
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  let claimedUploadIds: string[] = [];
  let sessionUserId: string | null = null;

  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const sessionUser = await getVerifiedSessionUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    sessionUserId = sessionUser.id;
    assertNoLegacyChatIdentityDev(sessionUser.id, 'messages:insert:user_id');

    const { roomId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      content?: string;
      reply_to?: string | null;
      attachments?: MessageAttachmentInput[];
    };
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    const replyTo = body.reply_to ? String(body.reply_to) : null;

    if (!content && attachments.length === 0) {
      return NextResponse.json({ error: 'Message content or attachments are required' }, { status: 400 });
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters` }, { status: 400 });
    }
    if (attachments.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      return NextResponse.json({ error: `A message can include at most ${MAX_ATTACHMENTS_PER_MESSAGE} attachments` }, { status: 400 });
    }

    const { data: membershipRows, error: membershipError } = await supabaseAdmin
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', sessionUser.id)
      .limit(1);
    if (membershipError) throw membershipError;
    if (!membershipRows || membershipRows.length === 0) {
      return NextResponse.json({ error: 'Not a room member' }, { status: 403 });
    }

    if (replyTo) {
      const { data: replyMessage, error: replyError } = await supabaseAdmin
        .from('messages')
        .select('id')
        .eq('id', replyTo)
        .eq('room_id', roomId)
        .maybeSingle();
      if (replyError) throw replyError;
      if (!replyMessage) {
        return NextResponse.json({ error: 'Reply target is not in this room' }, { status: 400 });
      }
    }

    let trustedPending: Array<{
      id: string;
      room_id: string;
      bucket: string;
      path: string;
      original_name: string;
      mime_type: string;
      size_bytes: number;
    }> = [];

    if (attachments.length > 0) {
      const uploadIds = attachments.map((attachment) => String(attachment.upload_id || '').trim());
      if (uploadIds.some((uploadId) => !UUID_RE.test(uploadId)) || new Set(uploadIds).size !== uploadIds.length) {
        return NextResponse.json({ error: 'Attachments must reference unique verified uploads' }, { status: 400 });
      }

      const { data: pendingRows, error: pendingError } = await supabaseAdmin
        .from('pending_chat_attachments')
        .select('id, room_id, bucket, path, original_name, mime_type, size_bytes')
        .in('id', uploadIds)
        .eq('created_by', sessionUser.id)
        .eq('room_id', roomId)
        .is('consumed_at', null);
      if (pendingError) throw pendingError;
      if (!pendingRows || pendingRows.length !== uploadIds.length) {
        return NextResponse.json({ error: 'One or more attachments are invalid or already used' }, { status: 409 });
      }

      trustedPending = pendingRows.map((row) => ({
        id: row.id,
        room_id: row.room_id,
        bucket: row.bucket,
        path: row.path,
        original_name: row.original_name,
        mime_type: row.mime_type || 'application/octet-stream',
        size_bytes: Number(row.size_bytes),
      }));
      if (
        trustedPending.some(
          (row) =>
            row.bucket !== 'chat-attachments' ||
            row.size_bytes <= 0 ||
            row.size_bytes > MAX_ATTACHMENT_BYTES ||
            !row.path.startsWith(`${roomId}/${sessionUser.id}/`),
        )
      ) {
        return NextResponse.json({ error: 'Attachment metadata is invalid' }, { status: 400 });
      }

      const { data: claimedRows, error: claimError } = await supabaseAdmin
        .from('pending_chat_attachments')
        .update({ consumed_at: new Date().toISOString() })
        .in('id', uploadIds)
        .eq('created_by', sessionUser.id)
        .eq('room_id', roomId)
        .is('consumed_at', null)
        .select('id');
      if (claimError) throw claimError;
      if (!claimedRows || claimedRows.length !== uploadIds.length) {
        await resetPendingUploads(uploadIds, sessionUser.id);
        return NextResponse.json({ error: 'One or more attachments are already being used' }, { status: 409 });
      }
      claimedUploadIds = uploadIds;
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('messages')
      .insert({
        room_id: roomId,
        user_id: sessionUser.id,
        content,
        message_type: 'text',
        reply_to: replyTo,
        meta: createDefaultMessageMeta() as unknown as Json,
      })
      .select('*')
      .single();
    if (insertError || !inserted) {
      await resetPendingUploads(claimedUploadIds, sessionUser.id);
      throw insertError || new Error('Message insert returned no row');
    }

    if (trustedPending.length > 0) {
      const attachmentRows = trustedPending.map((attachment) => ({
        message_id: inserted.id,
        room_id: roomId,
        bucket: attachment.bucket,
        path: attachment.path,
        original_name: attachment.original_name,
        mime_type: attachment.mime_type,
        size_bytes: attachment.size_bytes,
        created_by: sessionUser.id,
      }));
      const { error: attachmentError } = await supabaseAdmin.from('message_attachments').insert(attachmentRows);
      if (attachmentError) {
        await supabaseAdmin.from('messages').delete().eq('id', inserted.id);
        await resetPendingUploads(claimedUploadIds, sessionUser.id);
        throw attachmentError;
      }
      await supabaseAdmin
        .from('pending_chat_attachments')
        .delete()
        .in('id', claimedUploadIds)
        .eq('created_by', sessionUser.id);
      claimedUploadIds = [];
    }

    const insertedUserId = inserted.user_id;
    const insertedRoomId = inserted.room_id;
    if (!insertedUserId || !insertedRoomId) {
      return NextResponse.json(inserted, { status: 201 });
    }

    const profiles = await fetchProfilesByIds([insertedUserId]);
    const { data: attachmentRows, error: attachmentLoadError } = await supabaseAdmin
      .from('message_attachments')
      .select('*')
      .eq('message_id', inserted.id)
      .order('created_at', { ascending: true });
    if (attachmentLoadError) throw attachmentLoadError;

    const normalizedMeta =
      inserted.meta && typeof inserted.meta === 'object' && !Array.isArray(inserted.meta)
        ? (inserted.meta as Record<string, unknown>)
        : null;
    const payload: MessageWithUser = {
      ...inserted,
      room_id: insertedRoomId,
      user_id: insertedUserId,
      meta: normalizedMeta,
      user: profiles[insertedUserId],
      attachments: (attachmentRows || []) as MessageAttachment[],
    };
    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    if (sessionUserId && claimedUploadIds.length > 0) {
      await resetPendingUploads(claimedUploadIds, sessionUserId);
    }
    console.error('[api rooms messages] failed to send message', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
