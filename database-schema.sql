-- =========================
-- TABLES
-- =========================

create table public."Admin" (
  "adminID" character varying(255) not null,
  firstname character varying(255) not null,
  lastname character varying(255) not null,
  password character varying(255) not null,
  email character varying(255) not null,
  constraint "Admin_email_key" UNIQUE (email),
  constraint "Admin_pkey" PRIMARY KEY ("adminID")
) TABLESPACE pg_default;

create table public."Announcement" (
  "announcementID" character varying(255) not null,
  date character varying(255) not null,
  title character varying(255) not null,
  content text not null,
  href character varying(255),
  constraint "Announcement_pkey" PRIMARY KEY ("announcementID")
) TABLESPACE pg_default;

create table public."Chair" (
  "chairID" character varying(255) not null,
  firstname character varying(255) not null,
  lastname character varying(255) not null,
  password character varying(255) not null,
  email character varying(255) not null,
  constraint "Chair_email_key" UNIQUE (email),
  constraint "Chair_pkey" PRIMARY KEY ("chairID")
) TABLESPACE pg_default;

create table public."Committee" (
  "committeeCode" character varying(255) not null,
  name character varying(255) not null,
  fullname text not null,
  "committeeID" uuid not null default gen_random_uuid(),
  constraint "Committee_code_key" UNIQUE ("committeeCode"),
  constraint "Committee_pkey" PRIMARY KEY ("committeeID")
) TABLESPACE pg_default;

create table public."Delegate" (
  "delegateID" character varying(255) not null,
  firstname character varying(255) not null,
  lastname character varying(255) not null,
  password character varying(255) not null,
  email character varying(255) not null,
  "resoPerms" jsonb not null default '{"update:reso": [], "view:allreso": false, "view:ownreso": true, "update:ownreso": true}'::jsonb,
  country text,
  "committeeID" uuid,
  constraint "Delegate_committeeID_fkey" FOREIGN KEY ("committeeID") REFERENCES "Committee"("committeeID") ON UPDATE CASCADE ON DELETE SET NULL,
  constraint "Delegate_pkey" PRIMARY KEY ("delegateID")
) TABLESPACE pg_default;

create table public."Speech" (
  "speechID" character varying(255) not null,
  title character varying(255) not null,
  content text not null,
  date character varying(255) not null,
  constraint "Speech_pkey" PRIMARY KEY ("speechID")
) TABLESPACE pg_default;

create table public."Delegate-Speech" (
  "speechID" character varying(255) not null,
  "delegateID" character varying(255) not null,
  constraint "Delegate-Speech_delegateID_fkey" FOREIGN KEY ("delegateID") REFERENCES "Delegate"("delegateID") ON DELETE CASCADE,
  constraint "Delegate-Speech_pkey" PRIMARY KEY ("speechID", "delegateID"),
  constraint "Delegate-Speech_speechID_fkey" FOREIGN KEY ("speechID") REFERENCES "Speech"("speechID") ON DELETE CASCADE
) TABLESPACE pg_default;

create table public."Chair-Speech" (
  "speechID" character varying(255) not null,
  "chairID" character varying(255) not null,
  constraint "Chair-Speech_chairID_fkey" FOREIGN KEY ("chairID") REFERENCES "Chair"("chairID") ON DELETE CASCADE,
  constraint "Chair-Speech_pkey" PRIMARY KEY ("speechID", "chairID"),
  constraint "Chair-Speech_speechID_fkey" FOREIGN KEY ("speechID") REFERENCES "Speech"("speechID") ON DELETE CASCADE
) TABLESPACE pg_default;

create table public."Resos" (
  "resoID" character varying(255) not null,
  title character varying(255) not null,
  "delegateID" character varying(255) not null,
  content jsonb not null,
  "isNew" boolean default true,
  "committeeID" uuid,
  constraint "Resos_committeeID_fkey" FOREIGN KEY ("committeeID") REFERENCES "Committee"("committeeID") ON UPDATE CASCADE,
  constraint "Resos_delegateID_fkey" FOREIGN KEY ("delegateID") REFERENCES "Delegate"("delegateID"),
  constraint "Resos_pkey" PRIMARY KEY ("resoID")
) TABLESPACE pg_default;

create table public."Updates" (
  "updateID" character varying(255) not null,
  "time" character varying(255) not null,
  title character varying(255) not null,
  content text not null,
  href character varying(255),
  constraint "Updates_pkey" PRIMARY KEY ("updateID")
) TABLESPACE pg_default;

create table public."Committee-Chair" (
  "chairID" character varying(255) not null,
  "committeeID" uuid,
  constraint "Committee-Chair_chairID_fkey" FOREIGN KEY ("chairID") REFERENCES "Chair"("chairID") ON DELETE CASCADE,
  constraint "Committee-Chair_committeeID_fkey" FOREIGN KEY ("committeeID") REFERENCES "Committee"("committeeID") ON UPDATE CASCADE
) TABLESPACE pg_default;

create table public.chat_rooms (
  id uuid not null default gen_random_uuid(),
  name character varying(100) not null,
  description text,
  is_private boolean default false,
  created_by character varying(255),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint chat_rooms_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

create table public.room_members (
  id uuid not null default gen_random_uuid(),
  room_id uuid,
  user_id character varying(255),
  role character varying(20) default 'member'::character varying,
  joined_at timestamp with time zone default now(),
  constraint room_members_pkey PRIMARY KEY (id),
  constraint room_members_room_id_fkey FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
  constraint room_members_room_id_user_id_key UNIQUE (room_id, user_id)
) TABLESPACE pg_default;

create table public.messages (
  id uuid not null default gen_random_uuid(),
  room_id uuid,
  user_id character varying(255),
  content text not null,
  message_type character varying(20) default 'text'::character varying,
  reply_to uuid,
  edited_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint messages_pkey PRIMARY KEY (id),
  constraint messages_reply_to_fkey FOREIGN KEY (reply_to) REFERENCES messages(id) ON DELETE SET NULL,
  constraint messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE
) TABLESPACE pg_default;

create table public.friend_requests (
  id uuid not null default gen_random_uuid(),
  sender_id character varying(255) not null,
  receiver_id character varying(255) not null,
  status text not null default 'pending'::text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint friend_requests_pkey PRIMARY KEY (id),
  constraint friend_requests_sender_id_receiver_id_key UNIQUE (sender_id, receiver_id),
  constraint friend_requests_status_check CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text]))
) TABLESPACE pg_default;

create table public.friendships (
  id uuid not null default gen_random_uuid(),
  user1_id character varying(255) not null,
  user2_id character varying(255) not null,
  created_at timestamp with time zone default now(),
  constraint friendships_pkey PRIMARY KEY (id),
  constraint friendships_user1_id_user2_id_key UNIQUE (user1_id, user2_id)
) TABLESPACE pg_default;

create table public."Secretariat" (
  "secretariatID" character varying(255) not null,
  firstname character varying(255) not null,
  lastname character varying(255) not null,
  password character varying(255) not null,
  email character varying(255) not null,
  constraint "Secretariat_email_key" UNIQUE (email),
  constraint "Secretariat_pkey" PRIMARY KEY ("secretariatID")
) TABLESPACE pg_default;

-- =========================
-- INDEXES
-- =========================

CREATE INDEX idx_chair_speech_chair ON public."Chair-Speech" USING btree ("chairID");

CREATE INDEX idx_delegate_speech_delegate ON public."Delegate-Speech" USING btree ("delegateID");

CREATE INDEX idx_resos_delegate ON public."Resos" USING btree ("delegateID");

CREATE INDEX idx_chat_rooms_created_by ON public.chat_rooms USING btree (created_by);

CREATE INDEX idx_chat_rooms_private ON public.chat_rooms USING btree (is_private);

CREATE INDEX idx_friend_requests_receiver ON public.friend_requests USING btree (receiver_id);

CREATE INDEX idx_friend_requests_sender ON public.friend_requests USING btree (sender_id);

CREATE INDEX idx_friend_requests_status ON public.friend_requests USING btree (status);

CREATE INDEX idx_friendships_user1 ON public.friendships USING btree (user1_id);

CREATE INDEX idx_friendships_user2 ON public.friendships USING btree (user2_id);

CREATE INDEX idx_messages_created_at ON public.messages USING btree (created_at DESC);

CREATE INDEX idx_messages_reply_to ON public.messages USING btree (reply_to);

CREATE INDEX idx_messages_room_id ON public.messages USING btree (room_id);

CREATE INDEX idx_messages_user_id ON public.messages USING btree (user_id);

CREATE INDEX idx_room_members_room_id ON public.room_members USING btree (room_id);

CREATE INDEX idx_room_members_user_id ON public.room_members USING btree (user_id);

-- =========================
-- RLS
-- =========================

alter table public.chat_rooms enable row level security;
alter table public.friendships enable row level security;
alter table public.messages enable row level security;
alter table public.room_members enable row level security;
