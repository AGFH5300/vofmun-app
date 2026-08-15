import { NextResponse } from 'next/server';
import { getVerifiedSessionUserFromRequest } from '@/lib/chat/auth';
import supabaseAdmin from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const scopes = new Set(['all', 'role', 'committee', 'user']);
const kinds = new Set(['announcement', 'action', 'warning']);
const roles = new Set(['delegate', 'chair', 'admin', 'secretariat']);
const reply = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

const authorizeStaff = async (request: Request) => {
  const user = await getVerifiedSessionUserFromRequest(request);
  return user && ['admin', 'secretariat'].includes(user.role) ? user : null;
};

export async function GET(request: Request) {
  if (!supabaseAdmin) return reply({ error: 'Notification service is unavailable.' }, 503);
  const actor = await authorizeStaff(request);
  if (!actor) return reply({ error: 'Unauthorized' }, 401);

  const { data, error } = await supabaseAdmin
    .from('app_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[admin notifications] load failed', { actorId: actor.id, message: error.message });
    return reply({ error: 'Unable to load notifications.' }, 500);
  }

  return reply({ notifications: data || [] });
}

export async function POST(request: Request) {
  if (!supabaseAdmin) return reply({ error: 'Notification service is unavailable.' }, 503);
  const actor = await authorizeStaff(request);
  if (!actor) return reply({ error: 'Unauthorized' }, 401);

  const body = (await request.json()) as Record<string, unknown>;
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const kind = typeof body.kind === 'string' ? body.kind : 'announcement';
  const targetScope = typeof body.targetScope === 'string' ? body.targetScope : 'all';
  const targetRole = typeof body.targetRole === 'string' ? body.targetRole : null;
  const targetCommitteeId = typeof body.targetCommitteeId === 'string' ? body.targetCommitteeId : null;
  const targetUserId = typeof body.targetUserId === 'string' ? body.targetUserId : null;
  const expiresAt = typeof body.expiresAt === 'string' && body.expiresAt ? body.expiresAt : null;

  if (!title || title.length > 160 || !message || message.length > 2000) {
    return reply({ error: 'Title and message are required and must fit the allowed length.' }, 400);
  }
  if (!kinds.has(kind) || !scopes.has(targetScope)) {
    return reply({ error: 'Invalid notification kind or audience.' }, 400);
  }
  if (
    (targetScope === 'role' && (!targetRole || !roles.has(targetRole))) ||
    (targetScope === 'committee' && !targetCommitteeId) ||
    (targetScope === 'user' && !targetUserId)
  ) {
    return reply({ error: 'The selected audience requires a target.' }, 400);
  }

  const { data, error } = await supabaseAdmin
    .from('app_notifications')
    .insert({
      title,
      message,
      kind,
      target_scope: targetScope,
      target_role: targetScope === 'role' ? targetRole : null,
      target_committee_id: targetScope === 'committee' ? targetCommitteeId : null,
      target_user_id: targetScope === 'user' ? targetUserId : null,
      created_by: actor.id,
      expires_at: expiresAt,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[admin notifications] create failed', { actorId: actor.id, message: error.message });
    return reply({ error: 'Unable to publish the notification.' }, 500);
  }

  return reply({ notification: data }, 201);
}

export async function DELETE(request: Request) {
  if (!supabaseAdmin) return reply({ error: 'Notification service is unavailable.' }, 503);
  const actor = await authorizeStaff(request);
  if (!actor) return reply({ error: 'Unauthorized' }, 401);

  const body = (await request.json()) as Record<string, unknown>;
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return reply({ error: 'Notification ID is required.' }, 400);

  const { error } = await supabaseAdmin.from('app_notifications').delete().eq('id', id);
  if (error) {
    console.error('[admin notifications] delete failed', { actorId: actor.id, notificationId: id, message: error.message });
    return reply({ error: 'Unable to remove the notification.' }, 500);
  }

  return reply({ success: true });
}
