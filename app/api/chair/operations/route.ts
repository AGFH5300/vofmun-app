// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
import { NextResponse } from 'next/server';
import { getVerifiedSessionUserFromRequest } from '@/lib/chat/auth';
import supabaseAdmin from '@/lib/supabaseAdmin';
import {
  ATTENDANCE_STATUSES,
  AWARD_STATUSES,
  ChairOperationError,
  TALLY_KINDS,
  applyChairSessionAction,
  createDefaultChairSessionState,
  normalizeChairSessionState,
  normalizeScores,
  normalizeTallies,
  type AttendanceStatus,
  type AwardStatus,
  type ChairSessionAction,
  type TallyKind,
} from '@/lib/chair/operations';
import type { Json } from '@/db/supabase-database.types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const responseHeaders = { 'Cache-Control': 'no-store, max-age=0' };
const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: responseHeaders });

type ActorContext = {
  actorId: string;
  role: 'chair' | 'admin' | 'secretariat';
  committeeId: string;
};

type SessionRow = {
  id: string;
  committee_id: string;
  session_number: number;
  title: string;
  status: string;
  state: Json;
  version: number;
  updated_at: string;
};

const getActorContext = async (request: Request, bodyCommitteeId?: unknown): Promise<ActorContext | null> => {
  if (!supabaseAdmin) return null;
  const actor = await getVerifiedSessionUserFromRequest(request);
  if (!actor || !['chair', 'admin', 'secretariat'].includes(actor.role)) return null;

  const { data: profile, error } = await supabaseAdmin
    .from('app_users')
    .select('committee_id')
    .eq('id', actor.id)
    .maybeSingle();
  if (error) throw error;

  const requestedCommitteeId = typeof bodyCommitteeId === 'string' && bodyCommitteeId.trim()
    ? bodyCommitteeId.trim()
    : new URL(request.url).searchParams.get('committeeID');
  const committeeId = actor.role === 'chair' ? profile?.committee_id : requestedCommitteeId;
  if (!committeeId) return null;

  return {
    actorId: actor.id,
    role: actor.role as ActorContext['role'],
    committeeId,
  };
};

const ensureSession = async (context: ActorContext): Promise<SessionRow> => {
  if (!supabaseAdmin) throw new Error('Chair operations are unavailable.');

  const { data: existing, error: selectError } = await supabaseAdmin
    .from('chair_committee_sessions')
    .select('id, committee_id, session_number, title, status, state, version, updated_at')
    .eq('committee_id', context.committeeId)
    .neq('status', 'archived')
    .order('session_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing as SessionRow;

  const { data: created, error: createError } = await supabaseAdmin
    .from('chair_committee_sessions')
    .insert({
      committee_id: context.committeeId,
      session_number: 1,
      title: 'Committee Session 1',
      status: 'scheduled',
      state: createDefaultChairSessionState() as unknown as Json,
      created_by: context.actorId,
      updated_by: context.actorId,
    })
    .select('id, committee_id, session_number, title, status, state, version, updated_at')
    .single();
  if (createError) {
    const { data: raced, error: racedError } = await supabaseAdmin
      .from('chair_committee_sessions')
      .select('id, committee_id, session_number, title, status, state, version, updated_at')
      .eq('committee_id', context.committeeId)
      .order('session_number', { ascending: false })
      .limit(1)
      .single();
    if (racedError) throw createError;
    return raced as SessionRow;
  }
  return created as SessionRow;
};

const delegateBelongsToCommittee = async (delegateId: string, committeeId: string) => {
  if (!supabaseAdmin) return false;
  const { data, error } = await supabaseAdmin
    .from('app_users')
    .select('id')
    .eq('id', delegateId)
    .eq('role', 'delegate')
    .eq('committee_id', committeeId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
};

const buildSnapshot = async (context: ActorContext, session?: SessionRow) => {
  if (!supabaseAdmin) throw new Error('Chair operations are unavailable.');
  const activeSession = session || await ensureSession(context);

  const [
    { data: committee, error: committeeError },
    { data: delegates, error: delegatesError },
    { data: matrix, error: matrixError },
    { data: metrics, error: metricsError },
  ] = await Promise.all([
    supabaseAdmin
      .from('Committee')
      .select('committeeID, committeeCode, name, fullname')
      .eq('committeeID', context.committeeId)
      .single(),
    supabaseAdmin
      .from('app_users')
      .select('id, first_name, last_name, email, country, school, grade, reso_perms')
      .eq('role', 'delegate')
      .eq('committee_id', context.committeeId)
      .order('country', { ascending: true })
      .order('first_name', { ascending: true }),
    supabaseAdmin
      .from('committee_matrix_seats')
      .select('id, country_name, sort_order')
      .eq('committee_id', context.committeeId)
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('chair_delegate_metrics')
      .select('delegate_id, attendance_status, tallies, scores, notes, award_status, updated_at')
      .eq('committee_id', context.committeeId),
  ]);

  if (committeeError) throw committeeError;
  if (delegatesError) throw delegatesError;
  if (matrixError) throw matrixError;
  if (metricsError) throw metricsError;

  const metricMap = new Map((metrics || []).map((entry) => [entry.delegate_id, entry]));
  const mappedDelegates = (delegates || []).map((delegate) => {
    const metric = metricMap.get(delegate.id);
    return {
      id: delegate.id,
      firstName: delegate.first_name || '',
      lastName: delegate.last_name || '',
      email: delegate.email || '',
      country: delegate.country,
      school: delegate.school,
      grade: delegate.grade,
      resoPerms: delegate.reso_perms,
      attendance: (metric?.attendance_status || 'present') as AttendanceStatus,
      tallies: normalizeTallies(metric?.tallies),
      scores: normalizeScores(metric?.scores),
      notes: metric?.notes || '',
      awardStatus: (metric?.award_status || 'none') as AwardStatus,
      metricsUpdatedAt: metric?.updated_at || null,
    };
  });

  const delegatesByCountry = new Map<string, typeof mappedDelegates>();
  for (const delegate of mappedDelegates) {
    const countryKey = (delegate.country || '').trim().toLocaleLowerCase();
    if (!countryKey) continue;
    const existing = delegatesByCountry.get(countryKey) || [];
    existing.push(delegate);
    delegatesByCountry.set(countryKey, existing);
  }

  return {
    committee,
    session: {
      ...activeSession,
      state: normalizeChairSessionState(activeSession.state),
    },
    delegates: mappedDelegates,
    matrix: (matrix || []).map((seat) => ({
      id: seat.id,
      country: seat.country_name,
      sortOrder: seat.sort_order,
      delegates: delegatesByCountry.get(seat.country_name.trim().toLocaleLowerCase()) || [],
    })),
    unmappedDelegates: mappedDelegates.filter((delegate) => {
      const country = (delegate.country || '').trim().toLocaleLowerCase();
      return !country || !(matrix || []).some((seat) => seat.country_name.trim().toLocaleLowerCase() === country);
    }),
    syncedAt: new Date().toISOString(),
  };
};

const updateMetric = async (context: ActorContext, body: Record<string, unknown>) => {
  if (!supabaseAdmin) throw new Error('Chair operations are unavailable.');
  const delegateId = typeof body.delegateId === 'string' ? body.delegateId.trim() : '';
  if (!delegateId || !(await delegateBelongsToCommittee(delegateId, context.committeeId))) {
    throw new ChairOperationError('That delegate is outside your committee.');
  }

  const { data: current, error } = await supabaseAdmin
    .from('chair_delegate_metrics')
    .select('attendance_status, tallies, scores, notes, award_status')
    .eq('committee_id', context.committeeId)
    .eq('delegate_id', delegateId)
    .maybeSingle();
  if (error) throw error;

  const next = {
    attendance_status: (current?.attendance_status || 'present') as AttendanceStatus,
    tallies: normalizeTallies(current?.tallies),
    scores: normalizeScores(current?.scores),
    notes: current?.notes || '',
    award_status: (current?.award_status || 'none') as AwardStatus,
  };

  if (body.action === 'metric.attendance') {
    if (typeof body.status !== 'string' || !ATTENDANCE_STATUSES.includes(body.status as AttendanceStatus)) {
      throw new ChairOperationError('Choose a valid roll-call status.');
    }
    next.attendance_status = body.status as AttendanceStatus;
  } else if (body.action === 'metric.tally') {
    if (typeof body.kind !== 'string' || !TALLY_KINDS.includes(body.kind as TallyKind)) {
      throw new ChairOperationError('Choose a valid tally.');
    }
    const delta = body.delta === -1 ? -1 : 1;
    const kind = body.kind as TallyKind;
    const adjust = (value: number) => Math.max(0, Math.min(999, value + delta));
    if (kind === 'speech') next.tallies = { ...next.tallies, speech: adjust(next.tallies.speech) };
    else if (kind === 'motion') next.tallies = { ...next.tallies, motion: adjust(next.tallies.motion) };
    else if (kind === 'poi') next.tallies = { ...next.tallies, poi: adjust(next.tallies.poi) };
    else if (kind === 'amendment') next.tallies = { ...next.tallies, amendment: adjust(next.tallies.amendment) };
    else if (kind === 'resolution') next.tallies = { ...next.tallies, resolution: adjust(next.tallies.resolution) };
    else next.tallies = { ...next.tallies, diplomacy: adjust(next.tallies.diplomacy) };
  } else if (body.action === 'metric.assessment') {
    next.scores = normalizeScores(body.scores);
    next.notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 4_000) : '';
    if (typeof body.awardStatus !== 'string' || !AWARD_STATUSES.includes(body.awardStatus as AwardStatus)) {
      throw new ChairOperationError('Choose a valid award status.');
    }
    next.award_status = body.awardStatus as AwardStatus;
  } else {
    throw new ChairOperationError('Unknown delegate metric operation.');
  }

  const { error: upsertError } = await supabaseAdmin
    .from('chair_delegate_metrics')
    .upsert({
      committee_id: context.committeeId,
      delegate_id: delegateId,
      attendance_status: next.attendance_status,
      tallies: next.tallies as unknown as Json,
      scores: next.scores as unknown as Json,
      notes: next.notes,
      award_status: next.award_status,
      updated_by: context.actorId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'committee_id,delegate_id' });
  if (upsertError) throw upsertError;
};

export async function GET(request: Request) {
  if (!supabaseAdmin) return json({ error: 'Chair operations are unavailable.' }, 503);
  try {
    const context = await getActorContext(request);
    if (!context) return json({ error: 'A committee-scoped chair or staff account is required.' }, 403);
    return json(await buildSnapshot(context));
  } catch (error) {
    console.error('[chair operations] Failed to load dashboard', {
      message: error instanceof Error ? error.message : String(error),
    });
    return json({ error: 'Unable to load chair operations.' }, 500);
  }
}

export async function PATCH(request: Request) {
  if (!supabaseAdmin) return json({ error: 'Chair operations are unavailable.' }, 503);
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const context = await getActorContext(request, body.committeeId);
    if (!context) return json({ error: 'A committee-scoped chair or staff account is required.' }, 403);
    const action = typeof body.action === 'string' ? body.action : '';

    if (action.startsWith('metric.')) {
      await updateMetric(context, body);
      return json(await buildSnapshot(context));
    }

    const session = await ensureSession(context);
    if (action === 'session.meta') {
      const title = typeof body.title === 'string' ? body.title.trim().slice(0, 160) : session.title;
      const status = typeof body.status === 'string' && ['scheduled', 'active', 'paused', 'closed', 'archived'].includes(body.status)
        ? body.status
        : session.status;
      const { data: updated, error } = await supabaseAdmin
        .from('chair_committee_sessions')
        .update({ title: title || session.title, status, updated_by: context.actorId, updated_at: new Date().toISOString() })
        .eq('id', session.id)
        .select('id, committee_id, session_number, title, status, state, version, updated_at')
        .single();
      if (error) throw error;
      return json(await buildSnapshot(context, updated as SessionRow));
    }

    const delegateId = typeof body.delegateId === 'string' ? body.delegateId.trim() : '';
    if (delegateId && !(await delegateBelongsToCommittee(delegateId, context.committeeId))) {
      throw new ChairOperationError('That delegate is outside your committee.');
    }

    const currentState = normalizeChairSessionState(session.state);
    const activeSpeaker = currentState.speakers.find((speaker) => speaker.id === currentState.activeSpeakerId);
    let automaticTally: { delegateId: string; kind: 'speech' | 'motion' } | null = null;
    if (action === 'motion.add' && delegateId) {
      automaticTally = { delegateId, kind: 'motion' };
    } else if (
      activeSpeaker
      && ((action === 'speaker.complete' && body.skipped !== true) || action === 'speaker.startNext')
    ) {
      automaticTally = { delegateId: activeSpeaker.delegateId, kind: 'speech' };
    }

    const nextState = applyChairSessionAction(
      currentState,
      { ...body, action } as ChairSessionAction,
    );
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('chair_committee_sessions')
      .update({
        state: nextState as unknown as Json,
        version: session.version + 1,
        updated_by: context.actorId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id)
      .eq('version', session.version)
      .select('id, committee_id, session_number, title, status, state, version, updated_at')
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return json({ error: 'Another chair updated the session. Reloaded the latest state.' }, 409);

    if (automaticTally?.delegateId) {
      try {
        await updateMetric(context, {
          action: 'metric.tally',
          delegateId: automaticTally.delegateId,
          kind: automaticTally.kind,
          delta: 1,
        });
      } catch (automaticTallyError) {
        console.error('[chair operations] Automatic delegate tally failed', {
          message: automaticTallyError instanceof Error ? automaticTallyError.message : String(automaticTallyError),
          committeeId: context.committeeId,
          delegateId: automaticTally.delegateId,
          kind: automaticTally.kind,
        });
      }
    }

    return json(await buildSnapshot(context, updated as SessionRow));
  } catch (error) {
    if (error instanceof ChairOperationError) return json({ error: error.message }, 400);
    console.error('[chair operations] Failed to update dashboard', {
      message: error instanceof Error ? error.message : String(error),
    });
    return json({ error: 'Unable to update chair operations.' }, 500);
  }
}
