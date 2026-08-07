import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';
import { getVerifiedSessionUserFromRequest } from '@/lib/chat/auth';

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const sessionUser = await getVerifiedSessionUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestUrl = new URL(request.url);
    const attachmentId = String(requestUrl.searchParams.get('attachment_id') || '').trim();
    const shouldDownload = ['1', 'true'].includes(
      String(requestUrl.searchParams.get('download') || '').toLowerCase(),
    );
    if (!attachmentId) {
      return NextResponse.json({ error: 'Attachment ID is required' }, { status: 400 });
    }

    const { data: attachment, error: attachmentError } = await supabaseAdmin
      .from('message_attachments')
      .select('id, room_id, bucket, path, original_name')
      .eq('id', attachmentId)
      .maybeSingle();

    if (attachmentError) {
      console.error('[attachment-sign] failed to load attachment', {
        attachmentId,
        userId: sessionUser.id,
        message: attachmentError.message,
      });
      return NextResponse.json({ error: 'Unable to load attachment' }, { status: 500 });
    }
    if (!attachment || attachment.bucket !== 'chat-attachments') {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('room_members')
      .select('id')
      .eq('room_id', attachment.room_id)
      .eq('user_id', sessionUser.id)
      .maybeSingle();

    if (membershipError) {
      return NextResponse.json({ error: 'Unable to verify room access' }, { status: 500 });
    }
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const expiresIn = shouldDownload ? 5 * 60 : 60 * 60;
    const options = shouldDownload
      ? { download: attachment.original_name || true }
      : undefined;
    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from('chat-attachments')
      .createSignedUrl(attachment.path, expiresIn, options);

    if (signedError || !signed?.signedUrl) {
      console.error('[attachment-sign] failed to sign attachment', {
        attachmentId,
        roomId: attachment.room_id,
        userId: sessionUser.id,
        message: signedError?.message || null,
      });
      return NextResponse.json({ error: 'Attachment unavailable' }, { status: 404 });
    }

    return NextResponse.json(
      { signed_url: signed.signedUrl, expires_in: expiresIn },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[attachment-sign] unexpected error', {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Unable to prepare attachment' }, { status: 500 });
  }
}
