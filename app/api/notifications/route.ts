import { NextResponse } from 'next/server';
import { getVerifiedSessionUserFromRequest } from '@/lib/chat/auth';
import supabaseAdmin from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const reply = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

const loadVisibleNotifications = async (userId: string, role: string) => {
  if (!supabaseAdmin) return [];

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('app_users')
    .select('committee_id')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) throw profileError;

  const { data, error } = await supabaseAdmin
    .from('app_notifications')
    .select('*')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;

  return (data || []).filter((notification) => {
    if (notification.target_scope === 'all') return true;
    if (notification.target_scope === 'role') return notification.target_role === role;
    if (notification.target_scope === 'committee') return notification.target_committee_id === profile?.committee_id;
    return notification.target_scope === 'user' && notification.target_user_id === userId;
  });
};

export async function GET(request: Request) {
  if (!supabaseAdmin) return reply({ error: 'Notification service is unavailable.' }, 503);
  const actor = await getVerifiedSessionUserFromRequest(request);
  if (!actor) return reply({ error: 'Unauthorized' }, 401);

  try {
    const notifications = await loadVisibleNotifications(actor.id, actor.role);
    const ids = notifications.map((notification) => notification.id);
    let readIds = new Set<string>();

    if (ids.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', actor.id)
        .in('notification_id', ids);
      if (error) throw error;
      readIds = new Set((data || []).map((row) => row.notification_id));
    }

    const items = notifications.map((notification) => ({
      ...notification,
      isRead: readIds.has(notification.id),
    }));

    return reply({ notifications: items, unreadCount: items.filter((item) => !item.isRead).length });
  } catch (error) {
    console.error('[notifications] load failed', {
      actorId: actor.id,
      message: error instanceof Error ? error.message : String(error),
    });
    return reply({ error: 'Unable to load notifications.' }, 500);
  }
}

export async function POST(request: Request) {
  if (!supabaseAdmin) return reply({ error: 'Notification service is unavailable.' }, 503);
  const actor = await getVerifiedSessionUserFromRequest(request);
  if (!actor) return reply({ error: 'Unauthorized' }, 401);

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const visible = await loadVisibleNotifications(actor.id, actor.role);
    const visibleIds = new Set(visible.map((notification) => notification.id));
    const requestedIds = Array.isArray(body.notificationIds)
      ? body.notificationIds.filter((id): id is string => typeof id === 'string' && visibleIds.has(id))
      : [];
    const ids = body.all === true ? Array.from(visibleIds) : Array.from(new Set(requestedIds));

    if (ids.length > 0) {
      const readAt = new Date().toISOString();
      const { error } = await supabaseAdmin
        .from('notification_reads')
        .upsert(
          ids.map((notificationId) => ({
            notification_id: notificationId,
            user_id: actor.id,
            read_at: readAt,
          })),
          { onConflict: 'notification_id,user_id' },
        );
      if (error) throw error;
    }

    return reply({ success: true, markedRead: ids.length });
  } catch (error) {
    console.error('[notifications] mark-read failed', {
      actorId: actor.id,
      message: error instanceof Error ? error.message : String(error),
    });
    return reply({ error: 'Unable to update notifications.' }, 500);
  }
}
