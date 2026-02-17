import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';
import { getSessionUserFromRequest } from '@/lib/chat/auth';
import { RoomWithDetails } from '@/lib/chat/types';
import { fetchRoomWithDetails } from './_lib/rooms';

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const sessionUser = getSessionUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: memberships } = await supabaseAdmin
      .from('room_members')
      .select('room_id')
      .eq('user_id', sessionUser.id);

    const roomIds = (memberships || []).map((m) => m.room_id);
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
