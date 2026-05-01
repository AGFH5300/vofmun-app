// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
import supabaseAdmin from '@/lib/supabaseAdmin';
import { MessageWithUser, RoomMember, RoomType, RoomWithDetails, User } from '@/lib/chat/types';
import { fetchPersonById, getUserContext, isVisibleToViewer } from '@/server/chat/people';

export const deriveRoomType = (room: { is_private?: boolean | null; name?: string | null }, members: RoomMember[]): RoomType => {
  if (room.is_private && members.length === 2) return 'dm';
  const normalized = (room.name || '').toLowerCase();
  if (normalized.includes('committee') || normalized.includes('room')) return 'committee';
  return 'group';
};

export const fetchProfilesByIds = async (ids: string[]): Promise<Record<string, User>> => {
  if (!supabaseAdmin || ids.length === 0) return {};
  const uniqueIds = Array.from(new Set(ids));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: appUsers } = await (supabaseAdmin as any)
    .from('app_users')
    .select('id, email, first_name, last_name, role, country, committee_id')
    .in('id', uniqueIds);

  const appUserCommitteeIds = Array.from(
    new Set((appUsers || []).map((row: { committee_id: string | null }) => row.committee_id).filter(Boolean))
  );
  const appUserCommitteeMap = new Map<string, string | null>();

  if (appUserCommitteeIds.length > 0) {
    const { data: committees } = await supabaseAdmin
      .from('Committee')
      .select('committeeID, committeeCode, name')
      .in('committeeID', appUserCommitteeIds as string[]);

    (committees || []).forEach((committee) => {
      appUserCommitteeMap.set(committee.committeeID, committee.committeeCode || committee.name || null);
    });
  }

  const map: Record<string, User> = {};

  (appUsers || []).forEach((row: { id: string; email: string | null; first_name: string | null; last_name: string | null; role: string | null; country: string | null; committee_id: string | null }) => {
    const role = (row.role || 'delegate') as User['role'];
    map[row.id] = {
      id: row.id,
      email: row.email || '',
      full_name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Unknown',
      role,
      role_title: role.charAt(0).toUpperCase() + role.slice(1),
      committee: row.committee_id ? appUserCommitteeMap.get(row.committee_id) || null : null,
      country: row.country || null,
    };
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
  const memberRows = members.filter((m): m is typeof m & { user_id: string; room_id: string; role: 'admin' | 'member' } => Boolean(m.user_id && m.room_id && m.role));
  const profiles = await fetchProfilesByIds(memberRows.map((m) => m.user_id));
  return memberRows.map((member) => ({ ...member, user: profiles[member.user_id] }));
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
  if (!msg.user_id || !msg.room_id) return null;
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
