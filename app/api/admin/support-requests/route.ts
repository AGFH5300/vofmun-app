import { NextResponse } from 'next/server';
import { getVerifiedSessionUserFromRequest } from '@/lib/chat/auth';
import supabaseAdmin from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const statuses = new Set(['open', 'in_progress', 'resolved', 'closed']);
const reply = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

const authorizeStaff = async (request: Request) => {
  const user = await getVerifiedSessionUserFromRequest(request);
  return user && ['admin', 'secretariat'].includes(user.role) ? user : null;
};

export async function GET(request: Request) {
  if (!supabaseAdmin) return reply({ error: 'Support service is unavailable.' }, 503);
  const actor = await authorizeStaff(request);
  if (!actor) return reply({ error: 'Unauthorized' }, 401);

  const requestedStatus = new URL(request.url).searchParams.get('status');
  let query = supabaseAdmin
    .from('support_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (requestedStatus && statuses.has(requestedStatus)) query = query.eq('status', requestedStatus);

  const { data, error } = await query;
  if (error) {
    console.error('[admin support] load failed', { actorId: actor.id, message: error.message });
    return reply({ error: 'Unable to load support requests.' }, 500);
  }

  return reply({ requests: data || [] });
}

export async function PATCH(request: Request) {
  if (!supabaseAdmin) return reply({ error: 'Support service is unavailable.' }, 503);
  const actor = await authorizeStaff(request);
  if (!actor) return reply({ error: 'Unauthorized' }, 401);

  const body = (await request.json()) as Record<string, unknown>;
  const id = typeof body.id === 'string' ? body.id : '';
  const status = typeof body.status === 'string' ? body.status : '';
  if (!id || !statuses.has(status)) return reply({ error: 'Invalid request ID or status.' }, 400);

  const { data, error } = await supabaseAdmin
    .from('support_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[admin support] update failed', { actorId: actor.id, requestId: id, message: error.message });
    return reply({ error: 'Unable to update the support request.' }, 500);
  }
  if (!data) return reply({ error: 'Support request not found.' }, 404);

  return reply({ request: data });
}
