// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'error';

export interface User {
  id: string;
  email: string;
  username?: string;
  full_name: string;
  firstname?: string | null;
  lastname?: string | null;
  avatar_url?: string | null;
  is_online?: boolean | null;
  last_seen?: string | null;
  role_title?: string | null;
  committee?: string | null;
  role?: 'admin' | 'delegate' | 'chair' | 'secretariat';
  country?: string | null;
}

export type RoomType = 'dm' | 'group' | 'committee';

export interface ChatRoom {
  id: string;
  name: string;
  description?: string | null;
  is_private?: boolean | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  room_type?: RoomType;
  icon?: string | null;
}

export interface RoomMember {
  id: string;
  room_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at?: string | null;
  user?: User;
}

export interface Message {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  message_type?: string | null;
  reply_to?: string | null;
  edited_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  meta?: Record<string, unknown> | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
}

export interface MessageWithUser extends Message {
  user?: User;
  status?: MessageStatus;
  tempId?: string;
}

export interface RoomWithDetails extends ChatRoom {
  members: RoomMember[];
  lastMessage?: MessageWithUser | null;
  isPinned?: boolean;
  unreadCount?: number;
}

export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected';

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: FriendRequestStatus;
  created_at?: string | null;
  updated_at?: string | null;
  sender?: User;
  receiver?: User;
}

export interface UserSearchResult extends User {
  is_friend?: boolean;
  has_pending_request?: boolean;
}

export interface ChatSocketPayload {
  type: 'auth' | 'authenticated' | 'auth_error' | 'join_room' | 'room_joined' | 'typing' | 'user_typing' | 'new_message' | 'user_online' | 'user_offline' | 'online_users';
  token?: string;
  roomId?: string;
  message?: MessageWithUser;
  userId?: string;
  isTyping?: boolean;
  onlineUserIds?: string[];
}
