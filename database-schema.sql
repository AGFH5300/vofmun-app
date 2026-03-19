--
-- PostgreSQL database dump
--

\restrict rKAliYod86oKzsVNpOEPdfcJv31eeG3Pvas25fXwDKCMXXqfAzIZyzAzxFA1TZe

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: add_room_creator_as_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_room_creator_as_admin() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.created_by is not null then
    insert into public.room_members (room_id, user_id, role)
    values (new.id, new.created_by, 'admin')
    on conflict (room_id, user_id) do nothing;
  end if;
  return new;
end;
$$;


--
-- Name: create_notification(uuid, character varying, text, character varying, character varying, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_notification(p_user_id uuid, p_title character varying, p_message text, p_type character varying DEFAULT 'info'::character varying, p_category character varying DEFAULT NULL::character varying, p_entity_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, title, message, type, category, entity_id)
  VALUES (p_user_id, p_title, p_message, p_type, p_category, p_entity_id)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;


--
-- Name: log_system_action(uuid, character varying, character varying, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_system_action(p_user_id uuid, p_action character varying, p_entity_type character varying DEFAULT NULL::character varying, p_entity_id uuid DEFAULT NULL::uuid, p_details jsonb DEFAULT NULL::jsonb) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO system_logs (user_id, action, entity_type, entity_id, details)
  VALUES (p_user_id, p_action, p_entity_type, p_entity_id, p_details)
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;



--
-- Name: get_room_unread_counts(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_room_unread_counts(p_user_id text) RETURNS TABLE(room_id uuid, unread_count bigint)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    rm.room_id,
    count(m.id) filter (
      where m.deleted_at is null
        and coalesce(m.user_id, '') <> p_user_id
        and coalesce(m.meta #>> array['receipts', 'read', p_user_id], '') = ''
    )::bigint as unread_count
  from public.room_members rm
  left join public.messages m
    on m.room_id = rm.room_id
  where rm.user_id = p_user_id
  group by rm.room_id
$$;

--
-- Name: mark_message_receipts(uuid, uuid[], character varying, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_message_receipts(p_room_id uuid, p_message_ids uuid[], p_user_id character varying, p_mark_read boolean DEFAULT false) RETURNS SETOF uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  now_json jsonb := to_jsonb(now()::text);
  delivered_path text[] := array['receipts','delivered', p_user_id::text];
  read_path text[] := array['receipts','read', p_user_id::text];
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  if not exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = p_user_id
  ) then
    raise exception 'User is not a member of this room';
  end if;

  return query
  update public.messages m
  set meta =
    case
      when p_mark_read then
        -- ensure delivered exists, then ensure read exists (without overwriting other users)
        (
          with base as (
            select coalesce(m.meta, '{}'::jsonb) as meta0
          ),
          delivered as (
            select
              case
                when (meta0 #> delivered_path) is null
                  then jsonb_set(meta0, delivered_path, now_json, true)
                else meta0
              end as meta1
            from base
          )
          select
            case
              when (meta1 #> read_path) is null
                then jsonb_set(meta1, read_path, now_json, true)
              else meta1
            end
          from delivered
        )
      else
        -- delivered only
        (
          with base as (
            select coalesce(m.meta, '{}'::jsonb) as meta0
          )
          select
            case
              when (meta0 #> delivered_path) is null
                then jsonb_set(meta0, delivered_path, now_json, true)
              else meta0
            end
          from base
        )
    end
  where m.room_id = p_room_id
    and m.id = any(p_message_ids)
    and m.user_id <> p_user_id
  returning m.id;
end;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Admin; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Admin" (
    "adminID" character varying(255) NOT NULL,
    firstname character varying(255) NOT NULL,
    lastname character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    email character varying(255) NOT NULL
);


--
-- Name: Announcement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Announcement" (
    "announcementID" character varying(255) NOT NULL,
    date character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    href character varying(255)
);


--
-- Name: Chair; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Chair" (
    "chairID" character varying(255) NOT NULL,
    firstname character varying(255) NOT NULL,
    lastname character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    "committeeID" uuid
);


--
-- Name: Chair-Speech; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Chair-Speech" (
    "speechID" character varying(255) NOT NULL,
    "chairID" character varying(255) NOT NULL
);


--
-- Name: Committee; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Committee" (
    "committeeCode" character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    fullname text NOT NULL,
    "committeeID" uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: Delegate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Delegate" (
    "delegateID" character varying(255) NOT NULL,
    firstname character varying(255) NOT NULL,
    lastname character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    "resoPerms" jsonb DEFAULT '{"update:reso": [], "view:allreso": false, "view:ownreso": true, "update:ownreso": true}'::jsonb NOT NULL,
    country text,
    "committeeID" uuid
);


--
-- Name: Delegate-Speech; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Delegate-Speech" (
    "speechID" character varying(255) NOT NULL,
    "delegateID" character varying(255) NOT NULL
);


--
-- Name: Resos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Resos" (
    "resoID" character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    "delegateID" character varying(255) NOT NULL,
    content jsonb NOT NULL,
    "isNew" boolean DEFAULT true,
    "committeeID" uuid
);


--
-- Name: Secretariat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Secretariat" (
    "secretariatID" character varying(255) NOT NULL,
    firstname character varying(255) NOT NULL,
    lastname character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    email character varying(255) NOT NULL
);


--
-- Name: Speech; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Speech" (
    "speechID" character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    date character varying(255) NOT NULL
);


--
-- Name: Updates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Updates" (
    "updateID" character varying(255) NOT NULL,
    "time" character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    href character varying(255)
);




--
-- Name: app_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_users (
    id uuid NOT NULL,
    email text,
    first_name text,
    last_name text,
    role text DEFAULT 'delegate'::text NOT NULL,
    committee_id uuid,
    country text,
    reso_perms jsonb DEFAULT '{"update:reso": [], "view:allreso": false, "view:ownreso": true, "update:ownreso": true}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT app_users_email_key UNIQUE (email),
    CONSTRAINT app_users_pkey PRIMARY KEY (id),
    CONSTRAINT app_users_role_check CHECK ((role = ANY (ARRAY['delegate'::text, 'chair'::text, 'secretariat'::text, 'admin'::text])))
);

--
-- Name: chat_rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_rooms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_private boolean DEFAULT false,
    created_by character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: friend_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.friend_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sender_id character varying(255) NOT NULL,
    receiver_id character varying(255) NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT friend_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text])))
);


--
-- Name: friendships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.friendships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user1_id character varying(255) NOT NULL,
    user2_id character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: message_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    room_id uuid NOT NULL,
    bucket text DEFAULT 'chat-attachments'::text NOT NULL,
    path text NOT NULL,
    original_name text NOT NULL,
    mime_type text,
    size_bytes bigint,
    created_by character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_id uuid,
    user_id character varying(255),
    content text NOT NULL,
    message_type character varying(20) DEFAULT 'text'::character varying,
    reply_to uuid,
    edited_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by character varying(255)
);


--
-- Name: room_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_id uuid,
    user_id character varying(255),
    role character varying(20) DEFAULT 'member'::character varying,
    joined_at timestamp with time zone DEFAULT now()
);


--
-- Name: Admin Admin_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Admin"
    ADD CONSTRAINT "Admin_email_key" UNIQUE (email);


--
-- Name: Admin Admin_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Admin"
    ADD CONSTRAINT "Admin_pkey" PRIMARY KEY ("adminID");


--
-- Name: Announcement Announcement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Announcement"
    ADD CONSTRAINT "Announcement_pkey" PRIMARY KEY ("announcementID");


--
-- Name: Chair-Speech Chair-Speech_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Chair-Speech"
    ADD CONSTRAINT "Chair-Speech_pkey" PRIMARY KEY ("speechID", "chairID");


--
-- Name: Chair Chair_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Chair"
    ADD CONSTRAINT "Chair_email_key" UNIQUE (email);


--
-- Name: Chair Chair_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Chair"
    ADD CONSTRAINT "Chair_pkey" PRIMARY KEY ("chairID");


--
-- Name: Committee Committee_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Committee"
    ADD CONSTRAINT "Committee_code_key" UNIQUE ("committeeCode");


--
-- Name: Committee Committee_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Committee"
    ADD CONSTRAINT "Committee_pkey" PRIMARY KEY ("committeeID");


--
-- Name: Delegate-Speech Delegate-Speech_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Delegate-Speech"
    ADD CONSTRAINT "Delegate-Speech_pkey" PRIMARY KEY ("speechID", "delegateID");


--
-- Name: Delegate Delegate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Delegate"
    ADD CONSTRAINT "Delegate_pkey" PRIMARY KEY ("delegateID");


--
-- Name: Resos Resos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Resos"
    ADD CONSTRAINT "Resos_pkey" PRIMARY KEY ("resoID");


--
-- Name: Secretariat Secretariat_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Secretariat"
    ADD CONSTRAINT "Secretariat_email_key" UNIQUE (email);


--
-- Name: Secretariat Secretariat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Secretariat"
    ADD CONSTRAINT "Secretariat_pkey" PRIMARY KEY ("secretariatID");


--
-- Name: Speech Speech_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Speech"
    ADD CONSTRAINT "Speech_pkey" PRIMARY KEY ("speechID");


--
-- Name: Updates Updates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Updates"
    ADD CONSTRAINT "Updates_pkey" PRIMARY KEY ("updateID");


--
-- Name: chat_rooms chat_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_rooms
    ADD CONSTRAINT chat_rooms_pkey PRIMARY KEY (id);


--
-- Name: friend_requests friend_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friend_requests
    ADD CONSTRAINT friend_requests_pkey PRIMARY KEY (id);


--
-- Name: friend_requests friend_requests_sender_id_receiver_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friend_requests
    ADD CONSTRAINT friend_requests_sender_id_receiver_id_key UNIQUE (sender_id, receiver_id);


--
-- Name: friendships friendships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_pkey PRIMARY KEY (id);


--
-- Name: friendships friendships_user1_id_user2_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_user1_id_user2_id_key UNIQUE (user1_id, user2_id);


--
-- Name: message_attachments message_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_attachments
    ADD CONSTRAINT message_attachments_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: room_members room_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_members
    ADD CONSTRAINT room_members_pkey PRIMARY KEY (id);


--
-- Name: room_members room_members_room_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_members
    ADD CONSTRAINT room_members_room_id_user_id_key UNIQUE (room_id, user_id);


--
-- Name: idx_chair_speech_chair; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chair_speech_chair ON public."Chair-Speech" USING btree ("chairID");


--
-- Name: idx_chat_rooms_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_rooms_created_by ON public.chat_rooms USING btree (created_by);


--
-- Name: idx_chat_rooms_private; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_rooms_private ON public.chat_rooms USING btree (is_private);


--
-- Name: idx_delegate_speech_delegate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delegate_speech_delegate ON public."Delegate-Speech" USING btree ("delegateID");


--
-- Name: idx_friend_requests_receiver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friend_requests_receiver ON public.friend_requests USING btree (receiver_id);


--
-- Name: idx_friend_requests_sender; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friend_requests_sender ON public.friend_requests USING btree (sender_id);


--
-- Name: idx_friend_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friend_requests_status ON public.friend_requests USING btree (status);


--
-- Name: idx_friendships_user1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friendships_user1 ON public.friendships USING btree (user1_id);


--
-- Name: idx_friendships_user2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friendships_user2 ON public.friendships USING btree (user2_id);


--
-- Name: idx_message_attachments_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_attachments_created_by ON public.message_attachments USING btree (created_by);


--
-- Name: idx_message_attachments_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_attachments_message_id ON public.message_attachments USING btree (message_id);


--
-- Name: idx_message_attachments_room_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_attachments_room_id ON public.message_attachments USING btree (room_id);


--
-- Name: idx_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_created_at ON public.messages USING btree (created_at DESC);


--
-- Name: idx_messages_reply_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_reply_to ON public.messages USING btree (reply_to);


--
-- Name: idx_messages_room_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_room_id ON public.messages USING btree (room_id);


--
-- Name: idx_messages_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_user_id ON public.messages USING btree (user_id);


--
-- Name: idx_resos_delegate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resos_delegate ON public."Resos" USING btree ("delegateID");


--
-- Name: idx_room_members_room_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_members_room_id ON public.room_members USING btree (room_id);


--
-- Name: idx_room_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_members_user_id ON public.room_members USING btree (user_id);



--
-- Name: app_users app_users_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER app_users_set_updated_at BEFORE UPDATE ON public.app_users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: chat_rooms add_room_creator_as_admin_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER add_room_creator_as_admin_trigger AFTER INSERT ON public.chat_rooms FOR EACH ROW EXECUTE FUNCTION public.add_room_creator_as_admin();


--
-- Name: chat_rooms update_chat_rooms_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_chat_rooms_updated_at BEFORE UPDATE ON public.chat_rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: messages update_messages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: Chair-Speech Chair-Speech_chairID_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Chair-Speech"
    ADD CONSTRAINT "Chair-Speech_chairID_fkey" FOREIGN KEY ("chairID") REFERENCES public."Chair"("chairID") ON DELETE CASCADE;


--
-- Name: Chair-Speech Chair-Speech_speechID_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Chair-Speech"
    ADD CONSTRAINT "Chair-Speech_speechID_fkey" FOREIGN KEY ("speechID") REFERENCES public."Speech"("speechID") ON DELETE CASCADE;



--
-- Name: app_users app_users_committee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_committee_id_fkey FOREIGN KEY (committee_id) REFERENCES public."Committee"("committeeID") ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: app_users app_users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: Chair Chair_committeeID_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Chair"
    ADD CONSTRAINT "Chair_committeeID_fkey" FOREIGN KEY ("committeeID") REFERENCES public."Committee"("committeeID");


--
-- Name: Delegate-Speech Delegate-Speech_delegateID_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Delegate-Speech"
    ADD CONSTRAINT "Delegate-Speech_delegateID_fkey" FOREIGN KEY ("delegateID") REFERENCES public."Delegate"("delegateID") ON DELETE CASCADE;


--
-- Name: Delegate-Speech Delegate-Speech_speechID_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Delegate-Speech"
    ADD CONSTRAINT "Delegate-Speech_speechID_fkey" FOREIGN KEY ("speechID") REFERENCES public."Speech"("speechID") ON DELETE CASCADE;


--
-- Name: Delegate Delegate_committeeID_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Delegate"
    ADD CONSTRAINT "Delegate_committeeID_fkey" FOREIGN KEY ("committeeID") REFERENCES public."Committee"("committeeID") ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Resos Resos_committeeID_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Resos"
    ADD CONSTRAINT "Resos_committeeID_fkey" FOREIGN KEY ("committeeID") REFERENCES public."Committee"("committeeID") ON UPDATE CASCADE;


--
-- Name: Resos Resos_delegateID_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Resos"
    ADD CONSTRAINT "Resos_delegateID_fkey" FOREIGN KEY ("delegateID") REFERENCES public."Delegate"("delegateID");


--
-- Name: message_attachments message_attachments_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_attachments
    ADD CONSTRAINT message_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: message_attachments message_attachments_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_attachments
    ADD CONSTRAINT message_attachments_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(id) ON DELETE CASCADE;


--
-- Name: messages messages_reply_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_reply_to_fkey FOREIGN KEY (reply_to) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: messages messages_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(id) ON DELETE CASCADE;


--
-- Name: room_members room_members_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_members
    ADD CONSTRAINT room_members_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(id) ON DELETE CASCADE;


--
-- Name: chat_rooms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

--
-- Name: friendships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

--
-- Name: message_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: room_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;

--
-- Name: FUNCTION get_room_unread_counts(text); Type: ACL; Schema: public; Owner: -
--

GRANT EXECUTE ON FUNCTION public.get_room_unread_counts(text) TO authenticated;

-- PostgreSQL database dump complete
--

\unrestrict rKAliYod86oKzsVNpOEPdfcJv31eeG3Pvas25fXwDKCMXXqfAzIZyzAzxFA1TZe

