// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';
import { getVerifiedSessionUserFromRequest } from '@/lib/chat/auth';

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const sessionUser = await getVerifiedSessionUserFromRequest(request);
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

    const actorId = String(sessionUser.id);
    const { data: roomMembers } = await supabaseAdmin
      .from('room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .limit(200);

    console.warn('[api rooms receipts] identity resolved', {
      roomId,
      resolvedActorId: actorId,
      sampleRoomMemberUserIds: (roomMembers || []).map((member) => String(member.user_id)).slice(0, 5),
      markRead: Boolean(body.markRead),
    });

    const { data, error } = await supabaseAdmin.rpc('mark_message_receipts', {
      p_room_id: roomId,
      p_message_ids: messageIds,
      p_user_id: actorId,
      p_mark_read: Boolean(body.markRead),
    });

    if (error) {
      console.error('[api rooms receipts] rpc failed', {
        roomId,
        userId: actorId,
        error,
      });
      return NextResponse.json({ error: 'Failed to mark receipts' }, { status: 500 });
    }

    const updatedIds = (data || []) as string[];
    const rows = await supabaseAdmin.from('messages').select('id, user_id, meta').in('id', updatedIds).eq('room_id', roomId);
    const nowIso = new Date().toISOString();

    let deliveredKeys: string[] = [];
    let readKeys: string[] = [];

    type ReceiptMeta = {
      receipts?: {
        delivered?: Record<string, string>;
        read?: Record<string, string>;
      };
    };

    for (const row of rows.data || []) {
      if (String(row.user_id) === actorId) continue;
      const meta = ((row.meta ?? {}) as ReceiptMeta);
      meta.receipts ??= {};
      meta.receipts.delivered ??= {};
      meta.receipts.read ??= {};
      meta.receipts.delivered[actorId] ??= nowIso;
      if (body.markRead) {
        meta.receipts.read[actorId] ??= nowIso;
      }
      await supabaseAdmin.from('messages').update({ meta }).eq('id', row.id);

      if (deliveredKeys.length === 0) {
        deliveredKeys = Object.keys(meta.receipts.delivered || {}).slice(0, 5);
        readKeys = Object.keys(meta.receipts.read || {}).slice(0, 5);
      }
    }

    console.warn('[api rooms receipts] merge result sample', {
      roomId,
      resolvedActorId: actorId,
      deliveredKeys,
      readKeys,
    });

    return NextResponse.json({ updated: updatedIds });
  } catch (error) {
    console.error('[api rooms receipts] failed to mark receipts', error);
    return NextResponse.json({ error: 'Failed to mark receipts' }, { status: 500 });
  }
}
