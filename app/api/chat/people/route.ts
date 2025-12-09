import { searchPeople } from '@/server/chat/people';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('query') || '').trim();

  console.log('[api chat people] request', { query });

  if (!query || query.length < 2) {
    return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const results = await searchPeople(query);
    console.log('[api chat people] results', { query, count: results.length });
    return new Response(JSON.stringify(results), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[api chat people] error', error);
    return new Response(JSON.stringify({ error: 'Failed to search people' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
