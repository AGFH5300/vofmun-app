// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';
import { getVerifiedSessionUserFromRequest } from '@/lib/chat/auth';
import { RoomWithDetails } from '@/lib/chat/types';
import { fetchRoomWithDetails } from './_lib/rooms';

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const sessionUser = await getVerifiedSessionUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: memberships } = await supabaseAdmin
      .from('room_members')
      .select('room_id')
      .eq('user_id', sessionUser.id);

    const roomIds = (memberships || []).map((m) => m.room_id).filter((roomId): roomId is string => typeof roomId === 'string');
    if (roomIds.length === 0) {
      return NextResponse.json([] as RoomWithDetails[]);
    }

    const rooms = await Promise.all(roomIds.map((roomId) => fetchRoomWithDetails(roomId)));
    return NextResponse.json(rooms.filter(Boolean));
  } catch (error) {
    console.error('[api rooms] failed to list rooms', error);
    return NextResponse.json({ error: 'Failed to load rooms' }, { status: 500 });
  }
}
