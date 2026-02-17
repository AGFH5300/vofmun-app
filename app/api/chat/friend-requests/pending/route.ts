// @ts-nocheck
import supabaseAdmin from '../../../../../lib/supabaseAdmin';
import { getSessionUserFromRequest } from '../../../../../lib/chat/auth';
import { fetchPeopleDetailsByIds } from '../../../../../server/chat/people';

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

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

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
      .eq('receiver_id', sessionUser.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[api chat pending friend-requests] error', error);
      return jsonResponse({ ok: false, error: 'Failed to load requests' }, 500);
    }

    const requests = data || [];
    const senderIds = Array.from(new Set(requests.map((req) => req.sender_id).filter(Boolean)));
    const profiles = await fetchPeopleDetailsByIds(senderIds);

    const enriched = requests.map((req) => ({
      ...req,
      sender: mapProfileToUser(profiles[req.sender_id]),
    }));

    return jsonResponse({ ok: true, count: enriched.length, requests: enriched }, 200);
  } catch (error) {
    console.error('[api chat pending friend-requests] unexpected error', error);
    return jsonResponse({ ok: false, error: 'Internal server error' }, 500);
  }
}
