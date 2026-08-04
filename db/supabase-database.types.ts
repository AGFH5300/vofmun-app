// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type EmptyRelationships = [];

export type Database = {
  public: {
    Tables: {
      Admin: {
        Row: { adminID: string; firstname: string; lastname: string; email: string };
        Insert: { adminID: string; firstname: string; lastname: string; email: string };
        Update: { adminID?: string; firstname?: string; lastname?: string; email?: string };
        Relationships: EmptyRelationships;
      };
      Announcement: {
        Row: { announcementID: string; date: string; title: string; content: string; href: string | null };
        Insert: { announcementID: string; date: string; title: string; content: string; href?: string | null };
        Update: { announcementID?: string; date?: string; title?: string; content?: string; href?: string | null };
        Relationships: EmptyRelationships;
      };
      Chair: {
        Row: { chairID: string; firstname: string; lastname: string; email: string; committeeID: string | null };
        Insert: { chairID: string; firstname: string; lastname: string; email: string; committeeID?: string | null };
        Update: { chairID?: string; firstname?: string; lastname?: string; email?: string; committeeID?: string | null };
        Relationships: EmptyRelationships;
      };
      "Chair-Speech": {
        Row: { speechID: string; chairID: string };
        Insert: { speechID: string; chairID: string };
        Update: { speechID?: string; chairID?: string };
        Relationships: EmptyRelationships;
      };
      Committee: {
        Row: { committeeID: string; committeeCode: string; name: string; fullname: string };
        Insert: { committeeID?: string; committeeCode: string; name: string; fullname: string };
        Update: { committeeID?: string; committeeCode?: string; name?: string; fullname?: string };
        Relationships: EmptyRelationships;
      };
      Delegate: {
        Row: { delegateID: string; firstname: string; lastname: string; email: string; resoPerms: Json; country: string | null; committeeID: string | null };
        Insert: { delegateID: string; firstname: string; lastname: string; email: string; resoPerms?: Json; country?: string | null; committeeID?: string | null };
        Update: { delegateID?: string; firstname?: string; lastname?: string; email?: string; resoPerms?: Json; country?: string | null; committeeID?: string | null };
        Relationships: EmptyRelationships;
      };
      "Delegate-Speech": {
        Row: { speechID: string; delegateID: string };
        Insert: { speechID: string; delegateID: string };
        Update: { speechID?: string; delegateID?: string };
        Relationships: EmptyRelationships;
      };
      Resos: {
        Row: { resoID: string; title: string; delegateID: string; content: Json; isNew: boolean | null; committeeID: string | null };
        Insert: { resoID: string; title: string; delegateID: string; content: Json; isNew?: boolean | null; committeeID?: string | null };
        Update: { resoID?: string; title?: string; delegateID?: string; content?: Json; isNew?: boolean | null; committeeID?: string | null };
        Relationships: EmptyRelationships;
      };
      Secretariat: {
        Row: { secretariatID: string; firstname: string; lastname: string; email: string };
        Insert: { secretariatID: string; firstname: string; lastname: string; email: string };
        Update: { secretariatID?: string; firstname?: string; lastname?: string; email?: string };
        Relationships: EmptyRelationships;
      };
      Speech: {
        Row: { speechID: string; title: string; content: string; date: string };
        Insert: { speechID: string; title: string; content: string; date: string };
        Update: { speechID?: string; title?: string; content?: string; date?: string };
        Relationships: EmptyRelationships;
      };
      Updates: {
        Row: { updateID: string; time: string; title: string; content: string; href: string | null };
        Insert: { updateID: string; time: string; title: string; content: string; href?: string | null };
        Update: { updateID?: string; time?: string; title?: string; content?: string; href?: string | null };
        Relationships: EmptyRelationships;
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
          legacy_id: string | null;
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
          legacy_id?: string | null;
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
          legacy_id?: string | null;
          reso_perms?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: EmptyRelationships;
      };
      chat_rooms: {
        Row: { id: string; name: string; description: string | null; is_private: boolean | null; created_by: string | null; created_at: string | null; updated_at: string | null };
        Insert: { id?: string; name: string; description?: string | null; is_private?: boolean | null; created_by?: string | null; created_at?: string | null; updated_at?: string | null };
        Update: { id?: string; name?: string; description?: string | null; is_private?: boolean | null; created_by?: string | null; created_at?: string | null; updated_at?: string | null };
        Relationships: EmptyRelationships;
      };
      friend_requests: {
        Row: { id: string; sender_id: string; receiver_id: string; status: string; created_at: string | null; updated_at: string | null };
        Insert: { id?: string; sender_id: string; receiver_id: string; status?: string; created_at?: string | null; updated_at?: string | null };
        Update: { id?: string; sender_id?: string; receiver_id?: string; status?: string; created_at?: string | null; updated_at?: string | null };
        Relationships: EmptyRelationships;
      };
      friendships: {
        Row: { id: string; user1_id: string; user2_id: string; created_at: string | null };
        Insert: { id?: string; user1_id: string; user2_id: string; created_at?: string | null };
        Update: { id?: string; user1_id?: string; user2_id?: string; created_at?: string | null };
        Relationships: EmptyRelationships;
      };
      message_attachments: {
        Row: { id: string; message_id: string; room_id: string; bucket: string; path: string; original_name: string; mime_type: string | null; size_bytes: number | null; created_by: string; created_at: string };
        Insert: { id?: string; message_id: string; room_id: string; bucket?: string; path: string; original_name: string; mime_type?: string | null; size_bytes?: number | null; created_by: string; created_at?: string };
        Update: { id?: string; message_id?: string; room_id?: string; bucket?: string; path?: string; original_name?: string; mime_type?: string | null; size_bytes?: number | null; created_by?: string; created_at?: string };
        Relationships: EmptyRelationships;
      };
      message_hidden_for_users: {
        Row: { room_id: string; message_id: string; user_id: string; hidden_at: string | null };
        Insert: { room_id: string; message_id: string; user_id: string; hidden_at?: string | null };
        Update: { room_id?: string; message_id?: string; user_id?: string; hidden_at?: string | null };
        Relationships: EmptyRelationships;
      };
      messages: {
        Row: { id: string; room_id: string | null; user_id: string | null; content: string; message_type: string | null; reply_to: string | null; edited_at: string | null; created_at: string | null; updated_at: string | null; meta: Json; deleted_at: string | null; deleted_by: string | null };
        Insert: { id?: string; room_id?: string | null; user_id?: string | null; content: string; message_type?: string | null; reply_to?: string | null; edited_at?: string | null; created_at?: string | null; updated_at?: string | null; meta?: Json; deleted_at?: string | null; deleted_by?: string | null };
        Update: { id?: string; room_id?: string | null; user_id?: string | null; content?: string; message_type?: string | null; reply_to?: string | null; edited_at?: string | null; created_at?: string | null; updated_at?: string | null; meta?: Json; deleted_at?: string | null; deleted_by?: string | null };
        Relationships: EmptyRelationships;
      };
      room_members: {
        Row: { id: string; room_id: string | null; user_id: string | null; role: string | null; joined_at: string | null };
        Insert: { id?: string; room_id?: string | null; user_id?: string | null; role?: string | null; joined_at?: string | null };
        Update: { id?: string; room_id?: string | null; user_id?: string | null; role?: string | null; joined_at?: string | null };
        Relationships: EmptyRelationships;
      };
      support_requests: {
        Row: { id: string; user_id: string | null; display_name: string | null; country: string | null; committee_id: string | null; committee_name: string | null; role: string | null; message: string; source: string; status: string; created_at: string; updated_at: string };
        Insert: { id?: string; user_id?: string | null; display_name?: string | null; country?: string | null; committee_id?: string | null; committee_name?: string | null; role?: string | null; message: string; source?: string; status?: string; created_at?: string; updated_at?: string };
        Update: { id?: string; user_id?: string | null; display_name?: string | null; country?: string | null; committee_id?: string | null; committee_name?: string | null; role?: string | null; message?: string; source?: string; status?: string; created_at?: string; updated_at?: string };
        Relationships: EmptyRelationships;
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_resolution: {
        Args: { p_title: string; p_content: Json };
        Returns: string;
      };
      create_speech: {
        Args: { p_title: string; p_content: string; p_date: string };
        Returns: string;
      };
      delete_speech: {
        Args: { p_speech_id: string };
        Returns: undefined;
      };
      current_app_committee_id: { Args: Record<string, never>; Returns: string | null };
      current_app_role: { Args: Record<string, never>; Returns: string | null };
      current_legacy_id: { Args: Record<string, never>; Returns: string | null };
      current_reso_perms: { Args: Record<string, never>; Returns: Json };
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
