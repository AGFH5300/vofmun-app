export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'error';

export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  avatar_url?: string | null;
  is_online?: boolean | null;
  last_seen?: string | null;
}

export interface ChatRoom {
  id: string;
  name: string;
  description?: string | null;
  is_private?: boolean | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
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
}

export interface MessageWithUser extends Message {
  user?: User;
  status?: MessageStatus;
  tempId?: string;
}

export interface RoomWithDetails extends ChatRoom {
  members: RoomMember[];
  lastMessage?: MessageWithUser | null;
}

export interface ChatSocketPayload {
  type: 'auth' | 'authenticated' | 'join_room' | 'room_joined' | 'typing' | 'user_typing' | 'new_message' | 'user_online' | 'user_offline';
  token?: string;
  roomId?: string;
  message?: MessageWithUser;
  userId?: string;
  isTyping?: boolean;
}
