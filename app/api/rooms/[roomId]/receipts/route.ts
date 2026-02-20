import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';
import { getSessionUserFromRequest } from '@/lib/chat/auth';

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
    const body = (await request.json().catch(() => ({}))) as {
      messageIds?: string[];
      markRead?: boolean;
    };

    const messageIds = Array.isArray(body.messageIds)
      ? body.messageIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : [];

    if (messageIds.length === 0) {
      return NextResponse.json({ updated: [] });
    }

    const { data, error } = await supabaseAdmin.rpc('mark_message_receipts', {
      p_room_id: roomId,
      p_message_ids: messageIds,
      p_user_id: sessionUser.id,
      p_mark_read: Boolean(body.markRead),
    });

    if (error) {
      console.error('[api rooms receipts] rpc failed', {
        roomId,
        userId: sessionUser.id,
        error,
      });
      return NextResponse.json({ error: 'Failed to mark receipts' }, { status: 500 });
    }

    return NextResponse.json({ updated: data || [] });
  } catch (error) {
    console.error('[api rooms receipts] failed to mark receipts', error);
    return NextResponse.json({ error: 'Failed to mark receipts' }, { status: 500 });
  }
}
