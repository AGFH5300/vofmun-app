import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { status: 'unhealthy', app: 'vofmun-one', database: 'not_configured' },
      { status: 503, headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  }

  const { error } = await supabaseAdmin
    .from('app_users')
    .select('id', { head: true, count: 'exact' })
    .limit(1);

  if (error) {
    console.error('[health] database check failed', { message: error.message });
    return NextResponse.json(
      { status: 'unhealthy', app: 'vofmun-one', database: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  }

  return NextResponse.json(
    { status: 'healthy', app: 'vofmun-one', database: 'available' },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
