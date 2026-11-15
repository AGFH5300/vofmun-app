import supabase from "@/lib/supabase";
import { NextRequest } from "next/server";
import { getServerSession, getUserIdentity, unauthorizedResponse } from "@/lib/auth";

// GET /api/messages - Get messages for a specific conversation
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = getServerSession(request);
    if (!user) {
      return unauthorizedResponse('Please log in to access messages');
    }

    const userIdentity = getUserIdentity(user);
    if (!userIdentity) {
      return unauthorizedResponse('Invalid user session');
    }

    const { searchParams } = new URL(request.url);
    const conversationWith = searchParams.get('conversationWith');

    if (!conversationWith) {
      return new Response(
        JSON.stringify({ error: 'Missing conversation partner ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get messages between the authenticated user and the conversation partner
    const { data: messages, error } = await supabase
      .from('Message')
      .select('*')
      .or(`and(senderID.eq.${userIdentity.userID},receiverID.eq.${conversationWith}),and(senderID.eq.${conversationWith},receiverID.eq.${userIdentity.userID})`)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch messages' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(messages || []),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in messages API:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// POST /api/messages - Send a new message
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = getServerSession(request);
    if (!user) {
      return unauthorizedResponse('Please log in to send messages');
    }

    const userIdentity = getUserIdentity(user);
    if (!userIdentity) {
      return unauthorizedResponse('Invalid user session');
    }

    const body = await request.json();
    const { receiverID, content } = body;

    if (!receiverID || !content) {
      return new Response(
        JSON.stringify({ error: 'Missing receiver ID or message content' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get receiver information
    let receiverName = '';
    let receiverType = '';
    let committeeID = '';

    // First try delegate table
    const { data: delegate } = await supabase
      .from('Delegate')
      .select('firstname, lastname, committeeID')
      .eq('delegateID', receiverID)
      .single();

    if (delegate) {
      receiverName = `${delegate.firstname} ${delegate.lastname}`;
      receiverType = 'delegate';
      
      // Get committee from delegation
      const { data: delegation } = await supabase
        .from('Delegation')
        .select('committeeID')
        .eq('delegateID', receiverID)
        .single();
      
      committeeID = delegation?.committeeID || '';
    } else {
      // Try chair table
      const { data: chair } = await supabase
        .from('Chair')
        .select('firstname, lastname')
        .eq('chairID', receiverID)
        .single();

      if (chair) {
        receiverName = `${chair.firstname} ${chair.lastname}`;
        receiverType = 'chair';
        
        // Get committee from committee-chair
        const { data: committeeChair } = await supabase
          .from('Committee-Chair')
          .select('committeeID')
          .eq('chairID', receiverID)
          .single();
        
        committeeID = committeeChair?.committeeID || '';
      }
    }

    if (!receiverName) {
      return new Response(
        JSON.stringify({ error: 'Receiver not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Insert the message with authenticated user as sender
    const { data: message, error } = await supabase
      .from('Message')
      .insert({
        senderID: userIdentity.userID,
        senderType: userIdentity.userType,
        senderName: userIdentity.userName,
        receiverID,
        receiverType,
        receiverName,
        content: content.trim(),
        timestamp: new Date().toISOString(),
        read: false,
        committeeID
      })
      .select()
      .single();

    if (error) {
      console.error('Error sending message:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to send message' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(message),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in send message API:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}