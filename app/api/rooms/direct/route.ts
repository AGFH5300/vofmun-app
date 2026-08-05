// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';
import { getVerifiedSessionUserFromRequest } from '@/lib/chat/auth';
import { canInteractWithUser, fetchRoomWithDetails } from '../_lib/rooms';

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const sessionUser = await getVerifiedSessionUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const targetUserId = String(body?.targetUserId || '').trim();

    if (!targetUserId) {
      return NextResponse.json({ error: 'Missing targetUserId' }, { status: 400 });
    }

    if (targetUserId === sessionUser.id) {
      return NextResponse.json({ error: 'Cannot create direct room with yourself' }, { status: 400 });
    }

    const { data: appUserRows, error: appUserError } = await supabaseAdmin
      .from('app_users')
      .select('id')
      .eq('id', targetUserId)
      .limit(1);

    if (appUserError || !appUserRows || appUserRows.length === 0) {
      return NextResponse.json({ error: 'Invalid target user' }, { status: 400 });
    }

    const isAllowed = await canInteractWithUser(sessionUser.id, targetUserId);
    if (!isAllowed) {
      return NextResponse.json({ error: 'Not allowed to message this user' }, { status: 403 });
    }

    const { data: myMemberships } = await supabaseAdmin
      .from('room_members')
      .select('room_id')
      .eq('user_id', sessionUser.id);
    const roomIds = (myMemberships || []).map((m) => m.room_id);

    let roomId: string | null = null;
    if (roomIds.length > 0) {
      const { data: mutualRooms } = await supabaseAdmin
        .from('room_members')
        .select('room_id')
        .eq('user_id', targetUserId)
        .in('room_id', roomIds);

      roomId = mutualRooms?.[0]?.room_id ?? null;
    }

    if (!roomId) {
      const { data: createdRoom, error } = await supabaseAdmin
        .from('chat_rooms')
        .insert({
          name: 'Direct message',
          description: null,
          is_private: true,
          created_by: sessionUser.id,
        })
        .select('id')
        .single();

      if (error || !createdRoom) {
        return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
      }

      roomId = createdRoom.id;
      const { error: memberInsertError } = await supabaseAdmin
        .from('room_members')
        .insert([{ room_id: roomId, user_id: targetUserId, role: 'member' }]);

      if (memberInsertError) {
        return NextResponse.json({ error: 'Failed to create room members' }, { status: 500 });
      }
    }

    const room = await fetchRoomWithDetails(roomId);
    if (!room) {
      return NextResponse.json({ error: 'Failed to load room' }, { status: 500 });
    }

    return NextResponse.json(room);
  } catch (error) {
    console.error('[api rooms direct] failed to create direct room', error);
    return NextResponse.json({ error: 'Failed to create direct room' }, { status: 500 });
  }
}
