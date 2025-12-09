import { randomUUID } from 'crypto';
import supabaseAdmin from '@/lib/supabaseAdmin';
import { getSessionUserFromRequest } from '@/lib/chat/auth';
import { fetchPersonById, getUserContext, isVisibleToViewer } from '@/server/chat/people';
import { FriendRequest } from '@/lib/chat/types';

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return new Response(JSON.stringify({ ok: false, error: 'Server not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sessionUser = getSessionUserFromRequest(request);
  if (!sessionUser) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json().catch(() => null);
    const receiverId = body?.receiverId || body?.targetUserId;

    if (!receiverId) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing receiverId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (receiverId === sessionUser.id) {
      return new Response(JSON.stringify({ ok: false, error: 'Cannot send a request to yourself' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const viewer = await getUserContext(sessionUser.id);
    const target = await fetchPersonById(receiverId);
    if (!isVisibleToViewer(viewer, target)) {
      return new Response(JSON.stringify({ ok: false, error: 'Not allowed to connect with this user' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: existing } = await supabaseAdmin
      .from('friend_requests')
      .select('*')
      .or(
        `and(sender_id.eq.${sessionUser.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${sessionUser.id})`
      );

    const blocker = (existing || []).find((item) => item.status === 'pending' || item.status === 'accepted');
    if (blocker) {
      return new Response(
        JSON.stringify({ ok: true, status: blocker.status, already_exists: true, request: blocker as FriendRequest }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const insertPayload = {
      id: randomUUID(),
      sender_id: sessionUser.id,
      receiver_id: receiverId,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin.from('friend_requests').insert(insertPayload).select('*').single();

    if (error || !data) {
      console.error('[api chat friend-requests] failed to insert request', error);
      return new Response(JSON.stringify({ ok: false, error: 'Failed to send request' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, status: data.status, request: data as FriendRequest }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[api chat friend-requests] unexpected error', error);
    return new Response(JSON.stringify({ ok: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
