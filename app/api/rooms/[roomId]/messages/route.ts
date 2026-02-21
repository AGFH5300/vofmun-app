// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';
import { getSessionUserFromRequest } from '@/lib/chat/auth';
import { fetchProfilesByIds } from '@/app/api/rooms/_lib/rooms';
import { MessageWithUser } from '@/lib/chat/types';
import { createDefaultMessageMeta } from '@/lib/chat/messageMeta';

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

    const { data: membershipRows, error: membershipError } = await supabaseAdmin
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', sessionUser.id)
      .limit(1);

    if (membershipError) {
      console.error('[api rooms messages] failed membership check', {
        roomId,
        userId: sessionUser.id,
        error: membershipError,
      });
      return NextResponse.json({ error: 'Failed to validate room membership' }, { status: 500 });
    }

    if (!membershipRows || membershipRows.length === 0) {
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

    const { data: membershipRows, error: membershipError } = await supabaseAdmin
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', sessionUser.id)
      .limit(1);

    if (membershipError) {
      console.error('[api rooms messages] failed membership check before insert', {
        roomId,
        userId: sessionUser.id,
        error: membershipError,
      });
      return NextResponse.json({ error: 'Failed to validate room membership' }, { status: 500 });
    }

    if (!membershipRows || membershipRows.length === 0) {
      return NextResponse.json({ error: 'Not a room member' }, { status: 403 });
    }

    const { data: inserted, error } = await supabaseAdmin
      .from('messages')
      .insert({
        room_id: roomId,
        user_id: sessionUser.id,
        content: content.trim(),
        reply_to: reply_to || null,
        meta: createDefaultMessageMeta(),
      })
      .select('*')
      .single();

    if (error || !inserted) {
      console.error('[api rooms messages] insert failed', {
        roomId,
        userId: sessionUser.id,
        error,
      });
      return NextResponse.json({ error: 'Failed to send message', details: error?.message || null }, { status: 500 });
    }

    try {
      const profiles = await fetchProfilesByIds([inserted.user_id]);
      const payload: MessageWithUser = { ...inserted, user: profiles[inserted.user_id] };
      return NextResponse.json(payload);
    } catch (profileError) {
      console.error('[api rooms messages] profile enrichment failed after insert', {
        roomId,
        userId: sessionUser.id,
        insertedMessageId: inserted.id,
        error: profileError,
      });
      return NextResponse.json(inserted);
    }
  } catch (error) {
    console.error('[api rooms messages] failed to send message', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
