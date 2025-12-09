import supabaseAdmin from '@/lib/supabaseAdmin';
import { getSessionUserFromRequest } from '@/lib/chat/auth';

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sessionUser = getSessionUserFromRequest(request);

  if (!sessionUser) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data, error } = await supabaseAdmin
    .from('friend_requests')
    .select('*')
    .eq('receiver_id', sessionUser.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[api chat pending friend-requests] error', error);
    return new Response(JSON.stringify({ error: 'Failed to load requests' }), { status: 500 });
  }

  return new Response(JSON.stringify(data || []), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
