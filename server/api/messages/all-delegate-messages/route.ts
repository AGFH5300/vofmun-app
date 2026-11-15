import supabase from "@/lib/supabase";
import { NextRequest } from "next/server";
import { getServerSession, getUserIdentity, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

// GET /api/messages/all-delegate-messages - Get all delegate-to-delegate messages in the chair's committee
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = getServerSession(request);
    if (!user) {
      return unauthorizedResponse('Please log in to access delegate messages');
    }

    const userIdentity = getUserIdentity(user);
    if (!userIdentity) {
      return unauthorizedResponse('Invalid user session');
    }

    // Only chairs can view all delegate messages
    if (userIdentity.userType !== 'chair') {
      return forbiddenResponse('Only chairs can view all delegate messages');
    }

    // Get chair's committee
    const { data: committeeChair } = await supabase
      .from('Committee-Chair')
      .select('committeeID')
      .eq('chairID', userIdentity.userID)
      .single();

    if (!committeeChair) {
      return new Response(
        JSON.stringify({ error: 'Chair committee assignment not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const committeeID = committeeChair.committeeID;

    // Get all delegates in this committee
    const { data: delegations } = await supabase
      .from('Delegation')
      .select('delegateID')
      .eq('committeeID', committeeID);

    if (!delegations || delegations.length === 0) {
      return new Response(
        JSON.stringify([]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const delegateIDs = delegations.map(d => d.delegateID);

    // Get all messages between delegates in this committee
    const { data: messages, error } = await supabase
      .from('Message')
      .select('*')
      .eq('senderType', 'delegate')
      .eq('receiverType', 'delegate')
      .in('senderID', delegateIDs)
      .in('receiverID', delegateIDs)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Error fetching delegate messages:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch delegate messages' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(messages || []),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in all-delegate-messages API:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}