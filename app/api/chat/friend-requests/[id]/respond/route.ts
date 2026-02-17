// @ts-nocheck
import supabaseAdmin from '../../../../../../lib/supabaseAdmin';
import { getSessionUserFromRequest } from '../../../../../../lib/chat/auth';
import { fetchPeopleDetailsByIds } from '../../../../../../server/chat/people';

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const extractIdFromUrl = (url: string) => {
  const match = url.match(/\/api\/chat\/friend-requests\/([^/]+)\/respond/);
  return match?.[1] || null;
};

const ensureDirectRoom = async (userA: string, userB: string) => {
  if (!supabaseAdmin) return null;

  try {
    const [first, second] = [userA, userB].sort();
    const deterministicName = `dm:${first}:${second}`;

    const { data: existingRoom } = await supabaseAdmin
      .from('chat_rooms')
      .select('id')
      .eq('name', deterministicName)
      .eq('is_private', true)
      .maybeSingle();

    let roomId = (existingRoom as { id?: string } | null)?.id || null;

    if (!roomId) {
      const { data: createdRoom, error: createRoomError } = await supabaseAdmin
        .from('chat_rooms')
        .insert({ name: deterministicName, description: null, is_private: true, created_by: userA })
        .select('id')
        .single();

      if (createRoomError || !createdRoom) {
        console.error('[friend-requests respond] failed to create dm room', createRoomError);
        return null;
      }

      roomId = (createdRoom as { id: string }).id;
    }

    const { error: memberError } = await supabaseAdmin
      .from('room_members')
      .upsert(
        [
          { room_id: roomId, user_id: userA, role: 'member' },
          { room_id: roomId, user_id: userB, role: 'member' },
        ],
        { onConflict: 'room_id,user_id' }
      );

    if (memberError) {
      console.error('[friend-requests respond] failed to add room members', memberError);
    }

    return roomId;
  } catch (error) {
    console.error('[friend-requests respond] failed to ensure direct room', error);
    return null;
  }
};

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      return jsonResponse({ ok: false, error: 'Server not configured' }, 500);
    }

    const sessionUser = getSessionUserFromRequest(request);
    if (!sessionUser) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
    }

    const id = extractIdFromUrl(new URL(request.url).pathname);
    if (!id) {
      return jsonResponse({ ok: false, error: 'Missing request id' }, 400);
    }

    const { data: requestRow, error: fetchError } = await supabaseAdmin
      .from('friend_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('[friend-requests respond] failed to fetch request', fetchError);
      return jsonResponse({ ok: false, error: 'Failed to load request' }, 500);
    }

    if (!requestRow) {
      return jsonResponse({ ok: false, error: 'Request not found' }, 404);
    }

    if (requestRow.receiver_id !== sessionUser.id) {
      return jsonResponse({ ok: false, error: 'You are not allowed to respond to this request' }, 403);
    }

    const body = await request.json().catch(() => null);
    const action = body?.action as 'accept' | 'decline' | undefined;

    if (!action || (action !== 'accept' && action !== 'decline')) {
      return jsonResponse({ ok: false, error: 'Invalid action' }, 400);
    }

    if (action === 'accept') {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('friend_requests')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();

      if (updateError || !updated) {
        console.error('[friend-requests respond] failed to accept request', updateError);
        return jsonResponse({ ok: false, error: 'Failed to update request' }, 500);
      }

      const [user1_id, user2_id] = [updated.sender_id, updated.receiver_id].sort();

      const { data: friendship, error: friendshipError } = await supabaseAdmin
        .from('friendships')
        .upsert({ user1_id, user2_id }, { onConflict: 'user1_id,user2_id' })
        .select('id')
        .maybeSingle();

      if (friendshipError) {
        console.error('[friend-requests respond] failed to upsert friendship', friendshipError);
      }

      const roomId = await ensureDirectRoom(updated.sender_id, updated.receiver_id);

      const peerId = updated.sender_id === sessionUser.id ? updated.receiver_id : updated.sender_id;
      const peerProfiles = await fetchPeopleDetailsByIds([peerId]);
      const peer = peerProfiles[peerId];

      return jsonResponse(
        {
          ok: true,
          status: 'accepted',
          friendshipId: (friendship as { id?: string } | null)?.id || null,
          roomId: roomId || null,
          peer: peer
            ? {
                id: peer.id,
                role: peer.role,
                firstname: peer.firstname,
                lastname: peer.lastname,
                email: peer.email,
              }
            : null,
          request: updated,
        },
        200
      );
    }

    const { data: updated, error: rejectError } = await supabaseAdmin
      .from('friend_requests')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (rejectError || !updated) {
      console.error('[friend-requests respond] failed to reject request', rejectError);
      return jsonResponse({ ok: false, error: 'Failed to update request' }, 500);
    }

    return jsonResponse({ ok: true, status: 'rejected', request: updated }, 200);
  } catch (error) {
    console.error('[friend-requests respond] unexpected error', error);
    return jsonResponse({ ok: false, error: 'Internal server error' }, 500);
  }
}
