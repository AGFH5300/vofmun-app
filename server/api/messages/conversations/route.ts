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

    interface ConversationPartner {
      participantID: string;
      participantName: string;
      participantType: 'delegate' | 'chair';
    }

    // Get all people in the same committee (potential conversation partners)
    let conversationPartners: ConversationPartner[] = [];

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

    const conversationKeys = conversationPartners.map((partner) =>
      partner.participantID < userIdentity.userID
        ? `${partner.participantID}::${userIdentity.userID}`
        : `${userIdentity.userID}::${partner.participantID}`
    );

    const lastMessageMap = new Map<string, { content: string; timestamp: string }>();
    const unreadCountMap = new Map<string, number>();

    if (conversationKeys.length > 0) {
      const { data: lastMessages } = await supabase
        .from('Message')
        .select('conversationKey, content, timestamp')
        .in('conversationKey', conversationKeys)
        .order('timestamp', { ascending: false });

      if (lastMessages) {
        for (const message of lastMessages) {
          if (!message.conversationKey) continue;
          if (!lastMessageMap.has(message.conversationKey)) {
            lastMessageMap.set(message.conversationKey, {
              content: message.content ?? 'No messages yet',
              timestamp: message.timestamp ?? new Date().toISOString()
            });
          }
        }
      }

      const { data: unreadMessages } = await supabase
        .from('Message')
        .select('conversationKey')
        .eq('receiverID', userIdentity.userID)
        .eq('read', false)
        .in('conversationKey', conversationKeys);

      if (unreadMessages) {
        for (const message of unreadMessages) {
          if (!message.conversationKey) continue;
          unreadCountMap.set(
            message.conversationKey,
            (unreadCountMap.get(message.conversationKey) || 0) + 1
          );
        }
      }
    }

    const conversationsWithDetails = conversationPartners.map((partner, index) => {
      const conversationKey = conversationKeys[index];
      const lastMessage = lastMessageMap.get(conversationKey);
      return {
        ...partner,
        lastMessage: lastMessage?.content || 'No messages yet',
        lastMessageTime: lastMessage?.timestamp || new Date().toISOString(),
        unreadCount: unreadCountMap.get(conversationKey) || 0
      };
    });

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