// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type EmptyRelationships = [];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "13.0.5" };
  public: {
    Tables: {
      Admin: {
        Row: { adminID: string; auth_user_id: string | null; firstname: string; lastname: string; email: string };
        Insert: { adminID: string; auth_user_id?: string | null; firstname: string; lastname: string; email: string };
        Update: { adminID?: string; auth_user_id?: string | null; firstname?: string; lastname?: string; email?: string };
        Relationships: EmptyRelationships;
      };
      Announcement: {
        Row: { announcementID: string; date: string; title: string; content: string; href: string | null };
        Insert: { announcementID: string; date: string; title: string; content: string; href?: string | null };
        Update: { announcementID?: string; date?: string; title?: string; content?: string; href?: string | null };
        Relationships: EmptyRelationships;
      };
      Chair: {
        Row: { chairID: string; auth_user_id: string | null; firstname: string; lastname: string; email: string; committeeID: string | null };
        Insert: { chairID: string; auth_user_id?: string | null; firstname: string; lastname: string; email: string; committeeID?: string | null };
        Update: { chairID?: string; auth_user_id?: string | null; firstname?: string; lastname?: string; email?: string; committeeID?: string | null };
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
        Row: { delegateID: string; auth_user_id: string | null; firstname: string; lastname: string; email: string; resoPerms: Json; country: string | null; committeeID: string | null };
        Insert: { delegateID: string; auth_user_id?: string | null; firstname: string; lastname: string; email: string; resoPerms?: Json; country?: string | null; committeeID?: string | null };
        Update: { delegateID?: string; auth_user_id?: string | null; firstname?: string; lastname?: string; email?: string; resoPerms?: Json; country?: string | null; committeeID?: string | null };
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
        Row: { secretariatID: string; auth_user_id: string | null; firstname: string; lastname: string; email: string };
        Insert: { secretariatID: string; auth_user_id?: string | null; firstname: string; lastname: string; email: string };
        Update: { secretariatID?: string; auth_user_id?: string | null; firstname?: string; lastname?: string; email?: string };
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
        Row: { id: string; email: string | null; first_name: string | null; last_name: string | null; role: string; committee_id: string | null; country: string | null; legacy_id: string | null; reso_perms: Json; created_at: string; updated_at: string };
        Insert: { id: string; email?: string | null; first_name?: string | null; last_name?: string | null; role?: string; committee_id?: string | null; country?: string | null; legacy_id?: string | null; reso_perms?: Json; created_at?: string; updated_at?: string };
        Update: { id?: string; email?: string | null; first_name?: string | null; last_name?: string | null; role?: string; committee_id?: string | null; country?: string | null; legacy_id?: string | null; reso_perms?: Json; created_at?: string; updated_at?: string };
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
        Row: { id: string; room_id: string; message_id: string; user_id: string; hidden_at: string };
        Insert: { id?: string; room_id: string; message_id: string; user_id: string; hidden_at?: string };
        Update: { id?: string; room_id?: string; message_id?: string; user_id?: string; hidden_at?: string };
        Relationships: EmptyRelationships;
      };
      messages: {
        Row: {
          id: string; room_id: string | null; user_id: string | null; content: string; message_type: string | null; reply_to: string | null;
          edited_at: string | null; created_at: string | null; updated_at: string | null; meta: Json; deleted_at: string | null; deleted_by: string | null;
          history_acted_by: string | null; history_action: string | null; history_saved_at: string | null;
          previous_attachments: Json | null; previous_content: string | null; previous_created_at: string | null; previous_deleted_at: string | null;
          previous_edited_at: string | null; previous_message_row: Json | null; previous_reply_to: string | null; previous_user_id: string | null;
        };
        Insert: {
          id?: string; room_id?: string | null; user_id?: string | null; content: string; message_type?: string | null; reply_to?: string | null;
          edited_at?: string | null; created_at?: string | null; updated_at?: string | null; meta?: Json; deleted_at?: string | null; deleted_by?: string | null;
          history_acted_by?: string | null; history_action?: string | null; history_saved_at?: string | null;
          previous_attachments?: Json | null; previous_content?: string | null; previous_created_at?: string | null; previous_deleted_at?: string | null;
          previous_edited_at?: string | null; previous_message_row?: Json | null; previous_reply_to?: string | null; previous_user_id?: string | null;
        };
        Update: {
          id?: string; room_id?: string | null; user_id?: string | null; content?: string; message_type?: string | null; reply_to?: string | null;
          edited_at?: string | null; created_at?: string | null; updated_at?: string | null; meta?: Json; deleted_at?: string | null; deleted_by?: string | null;
          history_acted_by?: string | null; history_action?: string | null; history_saved_at?: string | null;
          previous_attachments?: Json | null; previous_content?: string | null; previous_created_at?: string | null; previous_deleted_at?: string | null;
          previous_edited_at?: string | null; previous_message_row?: Json | null; previous_reply_to?: string | null; previous_user_id?: string | null;
        };
        Relationships: EmptyRelationships;
      };
      pending_chat_attachments: {
        Row: { id: string; room_id: string; bucket: string; path: string; original_name: string; mime_type: string; size_bytes: number; created_by: string; created_at: string; consumed_at: string | null };
        Insert: { id?: string; room_id: string; bucket?: string; path: string; original_name: string; mime_type: string; size_bytes: number; created_by: string; created_at?: string; consumed_at?: string | null };
        Update: { id?: string; room_id?: string; bucket?: string; path?: string; original_name?: string; mime_type?: string; size_bytes?: number; created_by?: string; created_at?: string; consumed_at?: string | null };
        Relationships: EmptyRelationships;
      };
      room_members: {
        Row: { id: string; room_id: string | null; user_id: string | null; role: string | null; joined_at: string | null };
        Insert: { id?: string; room_id?: string | null; user_id?: string | null; role?: string | null; joined_at?: string | null };
        Update: { id?: string; room_id?: string | null; user_id?: string | null; role?: string | null; joined_at?: string | null };
        Relationships: EmptyRelationships;
      };
      app_notifications: {
        Row: { id: string; title: string; message: string; kind: string; target_scope: string; target_role: string | null; target_committee_id: string | null; target_user_id: string | null; created_by: string | null; created_at: string; expires_at: string | null };
        Insert: { id?: string; title: string; message: string; kind?: string; target_scope?: string; target_role?: string | null; target_committee_id?: string | null; target_user_id?: string | null; created_by?: string | null; created_at?: string; expires_at?: string | null };
        Update: { id?: string; title?: string; message?: string; kind?: string; target_scope?: string; target_role?: string | null; target_committee_id?: string | null; target_user_id?: string | null; created_by?: string | null; created_at?: string; expires_at?: string | null };
        Relationships: EmptyRelationships;
      };
      notification_reads: {
        Row: { notification_id: string; user_id: string; read_at: string };
        Insert: { notification_id: string; user_id: string; read_at?: string };
        Update: { notification_id?: string; user_id?: string; read_at?: string };
        Relationships: EmptyRelationships;
      };
      conference_settings: {
        Row: { id: string; conference_name: string; timezone: string; utc_offset: string; start_at: string | null; end_at: string | null; schedule: Json; crisis_status: string; crisis_title: string | null; crisis_content: string | null; crisis_media_url: string | null; updated_by: string | null; updated_at: string };
        Insert: { id?: string; conference_name?: string; timezone?: string; utc_offset?: string; start_at?: string | null; end_at?: string | null; schedule?: Json; crisis_status?: string; crisis_title?: string | null; crisis_content?: string | null; crisis_media_url?: string | null; updated_by?: string | null; updated_at?: string };
        Update: { id?: string; conference_name?: string; timezone?: string; utc_offset?: string; start_at?: string | null; end_at?: string | null; schedule?: Json; crisis_status?: string; crisis_title?: string | null; crisis_content?: string | null; crisis_media_url?: string | null; updated_by?: string | null; updated_at?: string };
        Relationships: EmptyRelationships;
      };
      support_requests: {
        Row: { id: string; user_id: string | null; display_name: string | null; country: string | null; committee_id: string | null; committee_name: string | null; role: string | null; message: string; source: string; status: string; created_at: string; updated_at: string };
        Insert: { id?: string; user_id?: string | null; display_name?: string | null; country?: string | null; committee_id?: string | null; committee_name?: string | null; role?: string | null; message: string; source?: string; status?: string; created_at?: string; updated_at?: string };
        Update: { id?: string; user_id?: string | null; display_name?: string | null; country?: string | null; committee_id?: string | null; committee_name?: string | null; role?: string | null; message?: string; source?: string; status?: string; created_at?: string; updated_at?: string };
        Relationships: EmptyRelationships;
      };
    };
    Views: {
      v_pending_auth_invites: {
        Row: { role: string | null; email: string | null; first_name: string | null; last_name: string | null };
        Relationships: EmptyRelationships;
      };
    };
    Functions: {
      create_resolution: { Args: { p_title: string; p_content: Json }; Returns: string };
      create_speech: { Args: { p_title: string; p_content: string; p_date: string }; Returns: string };
      delete_speech: { Args: { p_speech_id: string }; Returns: undefined };
      current_app_committee_id: { Args: Record<string, never>; Returns: string | null };
      current_app_role: { Args: Record<string, never>; Returns: string | null };
      current_legacy_id: { Args: Record<string, never>; Returns: string | null };
      current_reso_perms: { Args: Record<string, never>; Returns: Json };
      get_room_unread_counts: { Args: { p_user_id: string }; Returns: { room_id: string; unread_count: number }[] };
      mark_message_receipts: { Args: { p_room_id: string; p_message_ids: string[]; p_user_id: string; p_mark_read?: boolean }; Returns: string[] };
      room_id_from_object_path: { Args: { object_name: string }; Returns: string | null };
      sync_auth_user_to_app_users: { Args: { p_auth_user_id: string; p_email: string }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
