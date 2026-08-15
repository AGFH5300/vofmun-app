import { NextResponse } from 'next/server';
import { getVerifiedSessionUserFromRequest } from '@/lib/chat/auth';
import supabaseAdmin from '@/lib/supabaseAdmin';
import type { Json } from '@/db/supabase-database.types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const allowedEventTypes = new Set(['registration', 'committee', 'break', 'ceremony', 'departure', 'featured']);
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const offsetPattern = /^[+-]\d{2}:\d{2}$/;
const reply = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

const validSchedule = (value: unknown) => {
  if (!Array.isArray(value) || value.length > 10) return false;

  return value.every((day) => {
    if (!day || typeof day !== 'object') return false;
    const record = day as Record<string, unknown>;
    if (
      typeof record.shortLabel !== 'string' ||
      typeof record.label !== 'string' ||
      typeof record.dateISO !== 'string' ||
      !datePattern.test(record.dateISO) ||
      !Array.isArray(record.events) ||
      record.events.length > 50
    ) {
      return false;
    }

    return record.events.every((event) => {
      if (!event || typeof event !== 'object') return false;
      const item = event as Record<string, unknown>;
      return (
        typeof item.label === 'string' &&
        typeof item.title === 'string' &&
        typeof item.start === 'string' &&
        timePattern.test(item.start) &&
        typeof item.end === 'string' &&
        timePattern.test(item.end) &&
        typeof item.type === 'string' &&
        allowedEventTypes.has(item.type)
      );
    });
  });
};

export async function GET(request: Request) {
  if (!supabaseAdmin) return reply({ error: 'Conference service is unavailable.' }, 503);
  const actor = await getVerifiedSessionUserFromRequest(request);
  if (!actor) return reply({ error: 'Unauthorized' }, 401);

  const { data, error } = await supabaseAdmin
    .from('conference_settings')
    .select('*')
    .eq('id', 'current')
    .maybeSingle();

  if (error) {
    console.error('[conference] load failed', { actorId: actor.id, message: error.message });
    return reply({ error: 'Unable to load conference settings.' }, 500);
  }
  if (!data) return reply({ error: 'Conference settings have not been configured.' }, 404);

  return reply({ conference: data });
}

export async function PUT(request: Request) {
  if (!supabaseAdmin) return reply({ error: 'Conference service is unavailable.' }, 503);
  const actor = await getVerifiedSessionUserFromRequest(request);
  if (!actor) return reply({ error: 'Unauthorized' }, 401);
  if (!['admin', 'secretariat'].includes(actor.role)) return reply({ error: 'Forbidden' }, 403);

  const body = (await request.json()) as Record<string, unknown>;
  const conferenceName = typeof body.conferenceName === 'string' ? body.conferenceName.trim() : '';
  const timezone = typeof body.timezone === 'string' ? body.timezone.trim() : '';
  const utcOffset = typeof body.utcOffset === 'string' ? body.utcOffset.trim() : '';
  const startAt = typeof body.startAt === 'string' && body.startAt ? body.startAt : null;
  const endAt = typeof body.endAt === 'string' && body.endAt ? body.endAt : null;
  const crisisStatus = body.crisisStatus === 'published' ? 'published' : 'not_published';
  const crisisTitle = typeof body.crisisTitle === 'string' ? body.crisisTitle.trim() || null : null;
  const crisisContent = typeof body.crisisContent === 'string' ? body.crisisContent.trim() || null : null;
  const crisisMediaUrl = typeof body.crisisMediaUrl === 'string' ? body.crisisMediaUrl.trim() || null : null;

  if (!conferenceName || conferenceName.length > 160 || !timezone || !offsetPattern.test(utcOffset)) {
    return reply({ error: 'Conference name, timezone, or UTC offset is invalid.' }, 400);
  }
  if (!validSchedule(body.schedule)) return reply({ error: 'The conference schedule is invalid.' }, 400);
  if (crisisStatus === 'published' && !crisisTitle && !crisisContent && !crisisMediaUrl) {
    return reply({ error: 'Published crisis briefings require a title, content, or media URL.' }, 400);
  }
  if (crisisMediaUrl) {
    try {
      const url = new URL(crisisMediaUrl);
      if (url.protocol !== 'https:') throw new Error('HTTPS required');
    } catch {
      return reply({ error: 'Crisis media URL must be a valid HTTPS URL.' }, 400);
    }
  }

  const { data, error } = await supabaseAdmin
    .from('conference_settings')
    .upsert({
      id: 'current',
      conference_name: conferenceName,
      timezone,
      utc_offset: utcOffset,
      start_at: startAt,
      end_at: endAt,
      schedule: body.schedule as Json,
      crisis_status: crisisStatus,
      crisis_title: crisisTitle,
      crisis_content: crisisContent,
      crisis_media_url: crisisMediaUrl,
      updated_by: actor.id,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    console.error('[conference] update failed', { actorId: actor.id, message: error.message });
    return reply({ error: 'Unable to save conference settings.' }, 500);
  }

  return reply({ conference: data });
}
