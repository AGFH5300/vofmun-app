// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
import supabaseAdmin from '@/lib/supabaseAdmin';
import { MessageWithUser, RoomMember, RoomType, RoomWithDetails, User } from '@/lib/chat/types';
import { fetchPersonById, getUserContext, isVisibleToViewer, mapProfileForChat } from '@/server/chat/people';

export const deriveRoomType = (room: { is_private?: boolean | null; name?: string | null }, members: RoomMember[]): RoomType => {
  if (room.is_private && members.length === 2) return 'dm';
  const normalized = (room.name || '').toLowerCase();
  if (normalized.includes('committee') || normalized.includes('room')) return 'committee';
  return 'group';
};

export const fetchProfilesByIds = async (ids: string[]): Promise<Record<string, User>> => {
  if (!supabaseAdmin || ids.length === 0) return {};
  const uniqueIds = Array.from(new Set(ids));

  const [admins, chairs, delegates, secs] = await Promise.all([
    supabaseAdmin.from('Admin').select('adminID, firstname, lastname, email').in('adminID', uniqueIds),
    supabaseAdmin.from('Chair').select('chairID, firstname, lastname, email').in('chairID', uniqueIds),
    supabaseAdmin.from('Delegate').select('delegateID, firstname, lastname, email, country, committeeID').in('delegateID', uniqueIds),
    supabaseAdmin.from('Secretariat').select('secretariatID, firstname, lastname, email').in('secretariatID', uniqueIds),
  ]);

  const delegateCommitteeIds = new Set<string>();
  (delegates.data || []).forEach((row) => {
    if (row.committeeID) delegateCommitteeIds.add(row.committeeID);
  });

  const chairCommitteeIds = new Set<string>();
  if (chairs.data && chairs.data.length > 0) {
    const { data: chairLinks } = await supabaseAdmin
      .from('Committee-Chair')
      .select('chairID, committeeID')
      .in('chairID', chairs.data.map((row) => row.chairID));

    (chairLinks || []).forEach((link) => {
      if (link.committeeID) chairCommitteeIds.add(link.committeeID);
    });
  }

  const committeeIds = new Set([...delegateCommitteeIds, ...chairCommitteeIds]);
  const committeeMap = new Map<string, string | null>();
  if (committeeIds.size > 0) {
    const { data: committees } = await supabaseAdmin
      .from('Committee')
      .select('committeeID, committeeCode, name')
      .in('committeeID', Array.from(committeeIds));

    (committees || []).forEach((committee) => {
      committeeMap.set(committee.committeeID, committee.committeeCode || committee.name || null);
    });
  }

  const chairCommitteeMap = new Map<string, string | null>();
  if (chairCommitteeIds.size > 0) {
    const { data: chairLinks } = await supabaseAdmin
      .from('Committee-Chair')
      .select('chairID, committeeID')
      .in('committeeID', Array.from(chairCommitteeIds));

    (chairLinks || []).forEach((link) => {
      chairCommitteeMap.set(link.chairID, link.committeeID ? committeeMap.get(link.committeeID) || null : null);
    });
  }

  const map: Record<string, User> = {};
  (admins.data || []).forEach((row) => {
    const profile = mapProfileForChat(row, 'admin');
    map[profile.id] = profile;
  });
  (chairs.data || []).forEach((row) => {
    const profile = mapProfileForChat(row, 'chair', {
      committee: chairCommitteeMap.get(row.chairID) || null,
    });
    map[profile.id] = profile;
  });
  (delegates.data || []).forEach((row) => {
    const profile = mapProfileForChat(row, 'delegate', {
      committee: row.committeeID ? committeeMap.get(row.committeeID) || null : null,
      country: row.country || null,
    });
    map[profile.id] = profile;
  });
  (secs.data || []).forEach((row) => {
    const profile = mapProfileForChat(row, 'secretariat');
    map[profile.id] = profile;
  });

  return map;
};

export const fetchRoomMembers = async (roomId: string): Promise<RoomMember[]> => {
  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin
    .from('room_members')
    .select('id, room_id, user_id, role, joined_at')
    .eq('room_id', roomId);
  const members = data || [];
  const profiles = await fetchProfilesByIds(members.map((m) => m.user_id).filter(Boolean));
  return members.map((member) => ({ ...member, user: profiles[member.user_id] }));
};

export const fetchLastMessage = async (roomId: string): Promise<MessageWithUser | null> => {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from('messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!data || data.length === 0) return null;

  const msg = data[0];
  const profiles = await fetchProfilesByIds([msg.user_id]);
  return { ...msg, user: profiles[msg.user_id] } as MessageWithUser;
};

export const canInteractWithUser = async (viewerId: string, targetUserId: string) => {
  const viewer = await getUserContext(viewerId);
  const target = await fetchPersonById(targetUserId);
  return viewer ? isVisibleToViewer(viewer, target || null) : false;
};

export const fetchRoomWithDetails = async (roomId: string): Promise<RoomWithDetails | null> => {
  if (!supabaseAdmin) return null;
  const { data: room } = await supabaseAdmin
    .from('chat_rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (!room) return null;

  const members = await fetchRoomMembers(roomId);
  const lastMessage = await fetchLastMessage(roomId);
  return { ...room, members, lastMessage, room_type: deriveRoomType(room, members) } as RoomWithDetails;
};
