// @ts-nocheck
import { randomUUID } from 'crypto';
import supabaseAdmin from '../../../../lib/supabaseAdmin';
import { getSessionUserFromRequest } from '../../../../lib/chat/auth';
import { fetchPersonById, fetchPeopleDetailsByIds, getUserContext, isVisibleToViewer } from '../../../../server/chat/people';
import { FriendRequest } from '../../../../lib/chat/types';

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const normalizeRequestStatus = (status: string) => (status === 'declined' ? 'rejected' : status);

const mapProfileToUser = (profile: Awaited<ReturnType<typeof fetchPeopleDetailsByIds>>[string] | null | undefined) => {
  if (!profile) return null;
  const fullName = `${profile.firstname || ''} ${profile.lastname || ''}`.trim() || 'Unknown';
  const roleTitle = profile.role.charAt(0).toUpperCase() + profile.role.slice(1);
  return {
    id: profile.id,
    email: profile.email || '',
    full_name: fullName,
    firstname: profile.firstname,
    lastname: profile.lastname,
    role: profile.role,
    role_title: roleTitle,
    committee: profile.committeeCode || null,
    country: profile.country || null,
  };
};

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      return jsonResponse({ ok: false, error: 'Server not configured' }, 500);
    }

    const sessionUser = getSessionUserFromRequest(request);
    if (!sessionUser) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
    }

    const { data, error } = await supabaseAdmin
      .from('friend_requests')
      .select('*')
      .or(`sender_id.eq.${sessionUser.id},receiver_id.eq.${sessionUser.id}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[api chat friend-requests] failed to fetch requests', error);
      return jsonResponse({ ok: false, error: 'Failed to load requests' }, 500);
    }

    const requests = data || [];

    const { data: friendships, error: friendshipsError } = await supabaseAdmin
      .from('friendships')
      .select('*')
      .or(`user1_id.eq.${sessionUser.id},user2_id.eq.${sessionUser.id}`)
      .order('created_at', { ascending: false });

    if (friendshipsError) {
      console.error('[api chat friend-requests] failed to fetch friendships', friendshipsError);
      return jsonResponse({ ok: false, error: 'Failed to load requests' }, 500);
    }

    const requestPairKeys = new Set(
      requests.map((req) => [req.sender_id, req.receiver_id].sort().join('::'))
    );

    const acceptedFromFriendships = (friendships || [])
      .filter((friendship) => friendship.user1_id && friendship.user2_id)
      .filter((friendship) => !requestPairKeys.has([friendship.user1_id, friendship.user2_id].sort().join('::')))
      .map((friendship) => ({
        id: friendship.id,
        sender_id: friendship.user1_id,
        receiver_id: friendship.user2_id,
        status: 'accepted',
        created_at: friendship.created_at,
      }));

    const combinedRequests = [...requests, ...acceptedFromFriendships].sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );

    const uniqueIds = Array.from(
      new Set(combinedRequests.flatMap((req) => [req.sender_id, req.receiver_id]).filter(Boolean))
    );
    const profiles = await fetchPeopleDetailsByIds(uniqueIds);

    const enriched = combinedRequests.map((req) => ({
      ...req,
      status: normalizeRequestStatus(req.status),
      sender: mapProfileToUser(profiles[req.sender_id]),
      receiver: mapProfileToUser(profiles[req.receiver_id]),
    }));

    return jsonResponse({ ok: true, requests: enriched }, 200);
  } catch (error) {
    console.error('[api chat friend-requests] unexpected error in GET', error);
    return jsonResponse({ ok: false, error: 'Internal server error' }, 500);
  }
}

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      return jsonResponse({ ok: false, error: 'Server not configured' }, 500);
    }

    const sessionUser = getSessionUserFromRequest(request);
    if (!sessionUser) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
    }

    const body = await request.json().catch(() => null);
    const receiverId = body?.receiverId || body?.targetUserId;

    if (!receiverId) {
      return jsonResponse({ ok: false, error: 'Missing receiverId' }, 400);
    }

    if (receiverId === sessionUser.id) {
      return jsonResponse({ ok: false, error: 'Cannot send a request to yourself' }, 400);
    }

    const viewer = await getUserContext(sessionUser.id);
    if (!viewer) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
    }

    const target = await fetchPersonById(receiverId);
    if (!target) {
      return jsonResponse({ ok: false, error: 'User not found' }, 404);
    }

    if (!isVisibleToViewer(viewer, target)) {
      return jsonResponse({ ok: false, error: 'Not allowed to connect with this user' }, 403);
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('friend_requests')
      .select('*')
      .or(`and(sender_id.eq.${sessionUser.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${sessionUser.id})`);

    if (existingError) {
      console.error('[api chat friend-requests] failed to check existing requests', existingError);
      return jsonResponse({ ok: false, error: 'Failed to send request' }, 500);
    }

    const blocker = (existing || []).find((item) => item.status === 'pending' || item.status === 'accepted');
    if (blocker) {
      return jsonResponse(
        {
          ok: true,
          status: normalizeRequestStatus(blocker.status),
          already_exists: true,
          request: { ...blocker, status: normalizeRequestStatus(blocker.status) } as FriendRequest,
        },
        200
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
      return jsonResponse({ ok: false, error: 'Failed to send request' }, 500);
    }

    return jsonResponse({ ok: true, status: data.status, request: data as FriendRequest }, 200);
  } catch (error) {
    console.error('[api chat friend-requests] unexpected error', error);
    return jsonResponse({ ok: false, error: 'Internal server error' }, 500);
  }
}
