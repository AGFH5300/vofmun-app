import supabaseAdmin from '@/lib/supabaseAdmin';

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500 });
  }

  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { data: authUser, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authUser?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('friend_requests')
    .select('*')
    .eq('receiver_id', authUser.user.id)
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
