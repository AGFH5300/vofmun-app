import { NextRequest, NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';
import { getVerifiedSessionUserFromRequest } from '@/lib/chat/auth';

const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const DEFAULT_UPLOADS_PER_HOUR = 20;
const STALE_PENDING_AGE_MS = 24 * 60 * 60 * 1000;

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const MAX_UPLOAD_BYTES = parsePositiveInteger(
  process.env.CHAT_ATTACHMENT_MAX_SIZE_BYTES || process.env.NEXT_PUBLIC_CHAT_ATTACHMENT_MAX_SIZE_BYTES,
  DEFAULT_MAX_UPLOAD_BYTES,
);
const UPLOADS_PER_HOUR = parsePositiveInteger(
  process.env.CHAT_ATTACHMENT_UPLOADS_PER_HOUR,
  DEFAULT_UPLOADS_PER_HOUR,
);

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const ALLOWED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'txt', 'csv', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx',
]);

const sanitizeFileName = (name: string) => {
  const normalized = name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized.slice(0, 120) || 'attachment';
};

const getExtension = (name: string) => {
  const parts = name.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() || '' : '';
};

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const sessionUser = await getVerifiedSessionUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const roomId = String(formData.get('roomId') || '').trim();
    const file = formData.get('file');

    if (!roomId || !(file instanceof File)) {
      return NextResponse.json({ error: 'Room and file are required' }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File must be smaller than ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB` },
        { status: 400 },
      );
    }

    const extension = getExtension(file.name);
    const mimeType = file.type || 'application/octet-stream';
    const allowedMime = ALLOWED_MIME_TYPES.has(mimeType);
    const allowedExtension = ALLOWED_EXTENSIONS.has(extension);
    if (!allowedExtension || (!allowedMime && mimeType !== 'application/octet-stream')) {
      return NextResponse.json({ error: 'This file type is not allowed' }, { status: 400 });
    }

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', sessionUser.id)
      .maybeSingle();
    if (membershipError) {
      return NextResponse.json({ error: 'Unable to verify room access' }, { status: 500 });
    }
    if (!membership) {
      return NextResponse.json({ error: 'Not a room member' }, { status: 403 });
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const [{ count: pendingCount, error: pendingCountError }, { count: sentCount, error: sentCountError }] = await Promise.all([
      supabaseAdmin
        .from('pending_chat_attachments')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', sessionUser.id)
        .gte('created_at', oneHourAgo),
      supabaseAdmin
        .from('message_attachments')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', sessionUser.id)
        .gte('created_at', oneHourAgo),
    ]);
    if (pendingCountError || sentCountError) {
      return NextResponse.json({ error: 'Unable to verify upload allowance' }, { status: 500 });
    }
    if ((pendingCount || 0) + (sentCount || 0) >= UPLOADS_PER_HOUR) {
      return NextResponse.json(
        { error: 'Attachment upload limit reached. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '3600' } },
      );
    }

    const staleCutoff = new Date(Date.now() - STALE_PENDING_AGE_MS).toISOString();
    const { data: staleRows } = await supabaseAdmin
      .from('pending_chat_attachments')
      .select('id, path')
      .eq('created_by', sessionUser.id)
      .is('consumed_at', null)
      .lt('created_at', staleCutoff)
      .limit(50);
    if (staleRows && staleRows.length > 0) {
      const stalePaths = staleRows.map((row) => row.path).filter(Boolean);
      if (stalePaths.length > 0) {
        await supabaseAdmin.storage.from('chat-attachments').remove(stalePaths);
      }
      await supabaseAdmin
        .from('pending_chat_attachments')
        .delete()
        .in('id', staleRows.map((row) => row.id));
    }

    const uploadId = crypto.randomUUID();
    const safeName = sanitizeFileName(file.name);
    const path = `${roomId}/${sessionUser.id}/${uploadId}/${safeName}`;
    const bytes = await file.arrayBuffer();
    const { error: uploadError } = await supabaseAdmin.storage
      .from('chat-attachments')
      .upload(path, Buffer.from(bytes), {
        cacheControl: '3600',
        upsert: false,
        contentType: mimeType,
      });

    if (uploadError) {
      console.error('[attachment-upload] storage upload failed', {
        roomId,
        userId: sessionUser.id,
        message: uploadError.message,
      });
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    const { data: pending, error: pendingError } = await supabaseAdmin
      .from('pending_chat_attachments')
      .insert({
        id: uploadId,
        room_id: roomId,
        bucket: 'chat-attachments',
        path,
        original_name: file.name.slice(0, 255),
        mime_type: mimeType,
        size_bytes: file.size,
        created_by: sessionUser.id,
      })
      .select('*')
      .single();

    if (pendingError || !pending) {
      await supabaseAdmin.storage.from('chat-attachments').remove([path]);
      console.error('[attachment-upload] pending record insert failed', {
        roomId,
        userId: sessionUser.id,
        message: pendingError?.message || null,
      });
      return NextResponse.json({ error: 'Unable to prepare attachment' }, { status: 500 });
    }

    return NextResponse.json(
      {
        upload_id: pending.id,
        room_id: pending.room_id,
        bucket: pending.bucket,
        path: pending.path,
        original_name: pending.original_name,
        mime_type: pending.mime_type,
        size_bytes: pending.size_bytes,
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[attachment-upload] unexpected error', {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
