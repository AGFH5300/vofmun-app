import supabase from "@/lib/supabase";
import { NextRequest } from "next/server";
import { getServerSession, getUserIdentity, unauthorizedResponse } from "@/lib/auth";

// GET /api/messages/conversations - Get all conversations for a user
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = getServerSession(request);
    if (!user) {
      return unauthorizedResponse('Please log in to access conversations');
    }

    const userIdentity = getUserIdentity(user);
    if (!userIdentity) {
      return unauthorizedResponse('Invalid user session');
    }

    // Get user's committee
    let userCommitteeID = '';
    if (userIdentity.userType === 'delegate') {
      const { data: delegation } = await supabase
        .from('Delegation')
        .select('committeeID')
        .eq('delegateID', userIdentity.userID)
        .single();
      userCommitteeID = delegation?.committeeID || '';
    } else if (userIdentity.userType === 'chair') {
      const { data: committeeChair } = await supabase
        .from('Committee-Chair')
        .select('committeeID')
        .eq('chairID', userIdentity.userID)
        .single();
      userCommitteeID = committeeChair?.committeeID || '';
    }

    if (!userCommitteeID) {
      return new Response(
        JSON.stringify({ error: 'User committee not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get all people in the same committee (potential conversation partners)
    let conversationPartners: any[] = [];

    // Get delegates in the same committee
    const { data: delegates } = await supabase
      .from('Delegation')
      .select(`
        delegateID,
        Delegate:delegateID (
          firstname,
          lastname
        )
      `)
      .eq('committeeID', userCommitteeID)
      .neq('delegateID', userIdentity.userID); // Exclude self

    if (delegates) {
      conversationPartners = [
        ...conversationPartners,
        ...delegates.map(d => ({
          participantID: d.delegateID,
          participantName: `${d.Delegate.firstname} ${d.Delegate.lastname}`,
          participantType: 'delegate'
        }))
      ];
    }

    // Get chairs in the same committee
    const { data: chairs } = await supabase
      .from('Committee-Chair')
      .select(`
        chairID,
        Chair:chairID (
          firstname,
          lastname
        )
      `)
      .eq('committeeID', userCommitteeID)
      .neq('chairID', userIdentity.userID); // Exclude self

    if (chairs) {
      conversationPartners = [
        ...conversationPartners,
        ...chairs.map(c => ({
          participantID: c.chairID,
          participantName: `${c.Chair.firstname} ${c.Chair.lastname}`,
          participantType: 'chair'
        }))
      ];
    }

    // Get last message and unread count for each conversation partner
    const conversationsWithDetails = await Promise.all(
      conversationPartners.map(async (partner) => {
        // Get last message
        const { data: lastMessage } = await supabase
          .from('Message')
          .select('content, timestamp')
          .or(`and(senderID.eq.${userIdentity.userID},receiverID.eq.${partner.participantID}),and(senderID.eq.${partner.participantID},receiverID.eq.${userIdentity.userID})`)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();

        // Get unread count (messages sent to this user that are unread)
        const { count: unreadCount } = await supabase
          .from('Message')
          .select('*', { count: 'exact', head: true })
          .eq('senderID', partner.participantID)
          .eq('receiverID', userIdentity.userID)
          .eq('read', false);

        return {
          ...partner,
          lastMessage: lastMessage?.content || 'No messages yet',
          lastMessageTime: lastMessage?.timestamp || new Date().toISOString(),
          unreadCount: unreadCount || 0
        };
      })
    );

    // Sort by last message time (most recent first)
    conversationsWithDetails.sort((a, b) => 
      new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
    );

    return new Response(
      JSON.stringify(conversationsWithDetails),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in conversations API:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}