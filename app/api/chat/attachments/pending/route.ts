import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';
import { getVerifiedSessionUserFromRequest } from '@/lib/chat/auth';

export async function DELETE(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const sessionUser = await getVerifiedSessionUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestUrl = new URL(request.url);
    const uploadId = String(requestUrl.searchParams.get('upload_id') || '').trim();
    if (!uploadId) {
      return NextResponse.json({ error: 'Upload ID is required' }, { status: 400 });
    }

    const { data: pending, error: pendingError } = await supabaseAdmin
      .from('pending_chat_attachments')
      .select('id, room_id, bucket, path')
      .eq('id', uploadId)
      .eq('created_by', sessionUser.id)
      .is('consumed_at', null)
      .maybeSingle();

    if (pendingError) {
      return NextResponse.json({ error: 'Unable to load pending attachment' }, { status: 500 });
    }
    if (!pending) {
      return NextResponse.json({ error: 'Pending attachment not found' }, { status: 404 });
    }

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('room_members')
      .select('id')
      .eq('room_id', pending.room_id)
      .eq('user_id', sessionUser.id)
      .maybeSingle();
    if (membershipError) {
      return NextResponse.json({ error: 'Unable to verify room access' }, { status: 500 });
    }
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: storageError } = await supabaseAdmin.storage
      .from('chat-attachments')
      .remove([pending.path]);
    if (storageError) {
      console.error('[pending-attachment] storage removal failed', {
        uploadId,
        userId: sessionUser.id,
        message: storageError.message,
      });
      return NextResponse.json({ error: 'Unable to remove attachment' }, { status: 500 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('pending_chat_attachments')
      .delete()
      .eq('id', uploadId)
      .eq('created_by', sessionUser.id)
      .is('consumed_at', null);
    if (deleteError) {
      return NextResponse.json({ error: 'Unable to remove pending upload record' }, { status: 500 });
    }

    return NextResponse.json(
      { success: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[pending-attachment] unexpected error', {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Unable to remove attachment' }, { status: 500 });
  }
}
