// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      Committee: {
        Row: { committeeID: string; committeeCode: string; name: string; fullname: string };
        Insert: { committeeID?: string; committeeCode: string; name: string; fullname: string };
        Update: { committeeID?: string; committeeCode?: string; name?: string; fullname?: string };
        Relationships: [];
      };
      app_users: {
        Row: {
          id: string;
          email: string | null;
          first_name: string | null;
          last_name: string | null;
          role: string;
          committee_id: string | null;
          country: string | null;
          reso_perms: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          role?: string;
          committee_id?: string | null;
          country?: string | null;
          reso_perms?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          role?: string;
          committee_id?: string | null;
          country?: string | null;
          reso_perms?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chat_rooms: {
        Row: { id: string; name: string; description: string | null; is_private: boolean | null; created_by: string | null; created_at: string | null; updated_at: string | null };
        Insert: { id?: string; name: string; description?: string | null; is_private?: boolean | null; created_by?: string | null; created_at?: string | null; updated_at?: string | null };
        Update: { id?: string; name?: string; description?: string | null; is_private?: boolean | null; created_by?: string | null; created_at?: string | null; updated_at?: string | null };
        Relationships: [];
      };
      friend_requests: {
        Row: { id: string; sender_id: string; receiver_id: string; status: string; created_at: string | null; updated_at: string | null };
        Insert: { id?: string; sender_id: string; receiver_id: string; status?: string; created_at?: string | null; updated_at?: string | null };
        Update: { id?: string; sender_id?: string; receiver_id?: string; status?: string; created_at?: string | null; updated_at?: string | null };
        Relationships: [];
      };
      friendships: {
        Row: { id: string; user1_id: string; user2_id: string; created_at: string | null };
        Insert: { id?: string; user1_id: string; user2_id: string; created_at?: string | null };
        Update: { id?: string; user1_id?: string; user2_id?: string; created_at?: string | null };
        Relationships: [];
      };
      message_hidden_for_users: {
        Row: { room_id: string; message_id: string; user_id: string; hidden_at: string | null };
        Insert: { room_id: string; message_id: string; user_id: string; hidden_at?: string | null };
        Update: { room_id?: string; message_id?: string; user_id?: string; hidden_at?: string | null };
        Relationships: [];
      };
      messages: {
        Row: { id: string; room_id: string | null; user_id: string | null; content: string; message_type: string | null; reply_to: string | null; edited_at: string | null; created_at: string | null; updated_at: string | null; meta: Json; deleted_at: string | null; deleted_by: string | null };
        Insert: { id?: string; room_id?: string | null; user_id?: string | null; content: string; message_type?: string | null; reply_to?: string | null; edited_at?: string | null; created_at?: string | null; updated_at?: string | null; meta?: Json; deleted_at?: string | null; deleted_by?: string | null };
        Update: { id?: string; room_id?: string | null; user_id?: string | null; content?: string; message_type?: string | null; reply_to?: string | null; edited_at?: string | null; created_at?: string | null; updated_at?: string | null; meta?: Json; deleted_at?: string | null; deleted_by?: string | null };
        Relationships: [];
      };
      message_attachments: {
        Row: {
          id: string;
          message_id: string;
          room_id: string;
          bucket: string;
          path: string;
          original_name: string;
          mime_type: string | null;
          size_bytes: number;
          created_by: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          message_id: string;
          room_id: string;
          bucket: string;
          path: string;
          original_name: string;
          mime_type?: string | null;
          size_bytes: number;
          created_by: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          message_id?: string;
          room_id?: string;
          bucket?: string;
          path?: string;
          original_name?: string;
          mime_type?: string | null;
          size_bytes?: number;
          created_by?: string;
          created_at?: string | null;
        };
        Relationships: [];
      };
      room_members: {
        Row: { id: string; room_id: string | null; user_id: string | null; role: string | null; joined_at: string | null };
        Insert: { id?: string; room_id?: string | null; user_id?: string | null; role?: string | null; joined_at?: string | null };
        Update: { id?: string; room_id?: string | null; user_id?: string | null; role?: string | null; joined_at?: string | null };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_room_unread_counts: {
        Args: { p_user_id: string };
        Returns: { room_id: string; unread_count: number }[];
      };
      mark_message_receipts: {
        Args: { p_room_id: string; p_message_ids: string[]; p_user_id: string; p_mark_read?: boolean };
        Returns: string[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
