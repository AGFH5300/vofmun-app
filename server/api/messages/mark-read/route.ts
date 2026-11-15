import supabase from "@/lib/supabase";
import { NextRequest } from "next/server";
import { getServerSession, getUserIdentity, unauthorizedResponse } from "@/lib/auth";

// POST /api/messages/mark-read - Mark messages as read
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = getServerSession(request);
    if (!user) {
      return unauthorizedResponse('Please log in to mark messages as read');
    }

    const userIdentity = getUserIdentity(user);
    if (!userIdentity) {
      return unauthorizedResponse('Invalid user session');
    }

    const body = await request.json();
    const { conversationWith } = body;

    if (!conversationWith) {
      return new Response(
        JSON.stringify({ error: 'Missing conversation partner ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Mark all messages from conversationWith to authenticated user as read
    const { error } = await supabase
      .from('Message')
      .update({ read: true })
      .eq('senderID', conversationWith)
      .eq('receiverID', userIdentity.userID)
      .eq('read', false);

    if (error) {
      console.error('Error marking messages as read:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to mark messages as read' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in mark-read API:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}