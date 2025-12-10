import supabaseAdmin from '../../../../../lib/supabaseAdmin';
import { getSessionUserFromRequest } from '../../../../../lib/chat/auth';

const jsonResponse = (body: Record<string, any>, status = 200) =>
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

    return jsonResponse({ ok: true, count: requests.length, requests }, 200);
  } catch (error) {
    console.error('[api chat pending friend-requests] unexpected error', error);
    return jsonResponse({ ok: false, error: 'Internal server error' }, 500);
  }
}
