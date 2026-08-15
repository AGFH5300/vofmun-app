// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
import { NextResponse } from 'next/server';
import { getVerifiedSessionUserFromRequest } from '@/lib/chat/auth';
import supabaseAdmin from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStoreHeaders = { 'Cache-Control': 'no-store, max-age=0' };

type ResolutionPermissions = {
  'view:ownreso': boolean;
  'view:allreso': boolean;
  'update:ownreso': boolean;
  'update:reso': string[];
};

type PermissionUpdate = {
  delegateID: string;
  resoPerms: ResolutionPermissions;
};

const json = (body: Record<string, unknown> | unknown[], status = 200) =>
  NextResponse.json(body, { status, headers: noStoreHeaders });

const parsePermissions = (value: unknown): ResolutionPermissions | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;

  if (
    typeof record['view:ownreso'] !== 'boolean' ||
    typeof record['view:allreso'] !== 'boolean' ||
    typeof record['update:ownreso'] !== 'boolean'
  ) {
    return null;
  }

  const updateResolutionIds = record['update:reso'];
  if (
    updateResolutionIds !== undefined &&
    (!Array.isArray(updateResolutionIds) || updateResolutionIds.some((id) => typeof id !== 'string'))
  ) {
    return null;
  }

  return {
    'view:ownreso': record['view:ownreso'],
    'view:allreso': record['view:allreso'],
    'update:ownreso': record['update:ownreso'],
    'update:reso': (updateResolutionIds as string[] | undefined) || [],
  };
};

const mapDelegate = (delegate: {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  country: string | null;
  committee_id: string | null;
  reso_perms: unknown;
}) => ({
  delegateID: delegate.id,
  firstname: delegate.first_name || '',
  lastname: delegate.last_name || '',
  email: delegate.email || '',
  country: delegate.country,
  committeeID: delegate.committee_id,
  resoPerms: parsePermissions(delegate.reso_perms) || {
    'view:ownreso': false,
    'view:allreso': false,
    'update:ownreso': false,
    'update:reso': [],
  },
});

const getActorCommittee = async (userId: string) => {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from('app_users')
    .select('committee_id')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data?.committee_id || null;
};

export async function GET(request: Request) {
  if (!supabaseAdmin) return json({ error: 'Delegate service is unavailable.' }, 503);

  const actor = await getVerifiedSessionUserFromRequest(request);
  if (!actor) return json({ error: 'Unauthorized' }, 401);
  if (!['chair', 'admin', 'secretariat'].includes(actor.role)) {
    return json({ error: 'Forbidden' }, 403);
  }

  try {
    const requestedCommittee = new URL(request.url).searchParams.get('committeeID');
    const actorCommittee = actor.role === 'chair' ? await getActorCommittee(actor.id) : null;
    const committeeId = actor.role === 'chair' ? actorCommittee : requestedCommittee;

    if (actor.role === 'chair' && !actorCommittee) {
      return json({ error: 'Your chair account is not assigned to a committee.' }, 409);
    }

    let query = supabaseAdmin
      .from('app_users')
      .select('id, first_name, last_name, email, country, committee_id, reso_perms')
      .eq('role', 'delegate')
      .order('first_name', { ascending: true })
      .order('last_name', { ascending: true });

    if (committeeId) query = query.eq('committee_id', committeeId);

    const { data, error } = await query;
    if (error) throw error;

    return json((data || []).map(mapDelegate));
  } catch (error) {
    console.error('[delegates] Failed to load delegates', {
      actorId: actor.id,
      message: error instanceof Error ? error.message : String(error),
    });
    return json({ error: 'Failed to load delegates.' }, 500);
  }
}

export async function PUT(request: Request) {
  if (!supabaseAdmin) return json({ error: 'Delegate service is unavailable.' }, 503);

  const actor = await getVerifiedSessionUserFromRequest(request);
  if (!actor) return json({ error: 'Unauthorized' }, 401);
  if (!['chair', 'admin', 'secretariat'].includes(actor.role)) {
    return json({ error: 'Forbidden' }, 403);
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const rawUpdates = Array.isArray(body.delegates)
      ? body.delegates
      : [{ delegateID: body.delegateID, resoPerms: body.resoPerms }];

    if (rawUpdates.length === 0 || rawUpdates.length > 100) {
      return json({ error: 'Provide between 1 and 100 delegate updates.' }, 400);
    }

    const updates: PermissionUpdate[] = [];
    for (const raw of rawUpdates) {
      if (!raw || typeof raw !== 'object') {
        return json({ error: 'Invalid delegate update.' }, 400);
      }

      const record = raw as Record<string, unknown>;
      const delegateID = typeof record.delegateID === 'string' ? record.delegateID.trim() : '';
      const resoPerms = parsePermissions(record.resoPerms);
      if (!delegateID || !resoPerms) {
        return json({ error: 'Each update requires a delegateID and valid resolution permissions.' }, 400);
      }
      updates.push({ delegateID, resoPerms });
    }

    const ids = Array.from(new Set(updates.map((update) => update.delegateID)));
    if (ids.length !== updates.length) {
      return json({ error: 'Each delegate may only appear once per request.' }, 400);
    }

    const actorCommittee = actor.role === 'chair' ? await getActorCommittee(actor.id) : null;
    if (actor.role === 'chair' && !actorCommittee) {
      return json({ error: 'Your chair account is not assigned to a committee.' }, 409);
    }

    let targetQuery = supabaseAdmin
      .from('app_users')
      .select('id, committee_id')
      .eq('role', 'delegate')
      .in('id', ids);

    if (actor.role === 'chair') targetQuery = targetQuery.eq('committee_id', actorCommittee!);

    const { data: targets, error: targetError } = await targetQuery;
    if (targetError) throw targetError;

    const allowedIds = new Set((targets || []).map((target) => target.id));
    const forbiddenIds = ids.filter((id) => !allowedIds.has(id));
    if (forbiddenIds.length > 0) {
      return json({ error: 'One or more delegates are outside your committee or do not exist.' }, 403);
    }

    const results = [];
    for (const update of updates) {
      const { data, error } = await supabaseAdmin
        .from('app_users')
        .update({ reso_perms: update.resoPerms })
        .eq('id', update.delegateID)
        .eq('role', 'delegate')
        .select('id, first_name, last_name, email, country, committee_id, reso_perms')
        .single();

      if (error) throw error;
      results.push({ delegateID: update.delegateID, success: true, delegate: mapDelegate(data) });
    }

    if (!Array.isArray(body.delegates)) {
      return json({
        message: 'Delegate permissions updated successfully',
        delegate: results[0]?.delegate,
      });
    }

    return json({ message: 'Bulk update completed', results });
  } catch (error) {
    console.error('[delegates] Failed to update delegate permissions', {
      actorId: actor.id,
      message: error instanceof Error ? error.message : String(error),
    });
    return json({ error: 'Failed to update delegate permissions.' }, 500);
  }
}
