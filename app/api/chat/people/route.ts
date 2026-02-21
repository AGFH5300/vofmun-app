// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
// @ts-nocheck
import supabaseAdmin from '@/lib/supabaseAdmin';
import { getSessionUserFromRequest } from '@/lib/chat/auth';
import { searchPeople } from '@/server/chat/people';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('query') || '').trim();

  if (!query || query.length < 2) {
    return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    if (!supabaseAdmin) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500 });
    }

    const sessionUser = getSessionUserFromRequest(request);
    if (!sessionUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const results = await searchPeople(query, sessionUser.id);
    return new Response(JSON.stringify(results), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[api chat people] error', error);
    return new Response(JSON.stringify([]), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
