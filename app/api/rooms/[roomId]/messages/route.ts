import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';
import { getSessionUserFromRequest } from '@/lib/chat/auth';
import { fetchProfilesByIds } from '@/app/api/rooms/_lib/rooms';
import { MessageWithUser } from '@/lib/chat/types';

export async function GET(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const sessionUser = getSessionUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { roomId } = await params;

    const { data: membership } = await supabaseAdmin
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', sessionUser.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Not a room member' }, { status: 403 });
    }

    const { data: messages } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    const profiles = await fetchProfilesByIds((messages || []).map((msg) => msg.user_id));
    const formatted = (messages || []).map((msg) => ({ ...msg, user: profiles[msg.user_id] } as MessageWithUser));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('[api rooms messages] failed to load messages', error);
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const sessionUser = getSessionUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { roomId } = await params;
    const { content, reply_to } = (await request.json().catch(() => ({}))) as {
      content?: string;
      reply_to?: string | null;
    };

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    const { data: membership } = await supabaseAdmin
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', sessionUser.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Not a room member' }, { status: 403 });
    }

    const { data: inserted, error } = await supabaseAdmin
      .from('messages')
      .insert({ room_id: roomId, user_id: sessionUser.id, content: content.trim(), reply_to: reply_to || null })
      .select('*')
      .single();

    if (error || !inserted) {
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }

    const profiles = await fetchProfilesByIds([inserted.user_id]);
    const payload: MessageWithUser = { ...inserted, user: profiles[inserted.user_id] };

    return NextResponse.json(payload);
  } catch (error) {
    console.error('[api rooms messages] failed to send message', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
