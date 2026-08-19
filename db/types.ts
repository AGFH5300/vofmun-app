// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).

import type { Json } from './supabase-database.types';

export interface Committee {
  committeeID: string;
  committeeCode: string;
  name: string;
  fullname: string;
}

export interface Chair {
  chairID: string;
  firstname: string;
  lastname: string;
  password?: string;
  email: string;
  committeeID?: string | null;
  committee?: Committee | null;
  id?: string;
  role?: AppUserRole;
}

export interface Secretariat {
  secretariatID: string;
  firstname: string;
  lastname: string;
  password?: string;
  email: string;
  id?: string;
  role?: AppUserRole;
}

export type AppUserRole = 'delegate' | 'chair' | 'secretariat' | 'admin';

export interface SessionUser {
  id: string;
  email: string;
  full_name: string;
  first_name: string;
  last_name: string;
  role: AppUserRole;
  committee_id: string | null;
  country: string | null;
  school?: string | null;
  grade?: string | null;
  legacy_id: string | null;
  reso_perms: {
    "view:ownreso": boolean;
    "view:allreso": boolean;
    "update:ownreso": boolean;
    "update:reso": string[];
  };
  // Backward-compatible aliases hydrated from app_users (not legacy tables).
  firstname?: string;
  lastname?: string;
  delegateID?: string;
  chairID?: string;
  adminID?: string;
  secretariatID?: string;
  committeeID?: string | null;
  committee?: Committee | null;
  resoPerms?: {
    "view:ownreso": boolean;
    "view:allreso": boolean;
    "update:ownreso": boolean;
    "update:reso": string[];
  };
}

export interface AppUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: AppUserRole;
  committee_id: string | null;
  country: string | null;
  school: string | null;
  grade: string | null;
  legacy_id: string | null;
  reso_perms: {
    "view:ownreso": boolean;
    "view:allreso": boolean;
    "update:ownreso": boolean;
    "update:reso": string[];
  };
  created_at?: string;
  updated_at?: string;
}

export type UserType = SessionUser | null;

export interface Speech {
  speechID: string;
  title: string;
  content: string;
  date: string;
  delegateID: string;
  tags: string[];
}

export interface Update {
  updateID: string;
  time: string;
  title: string;
  content: string;
  href: string | null;
}

export interface Announcement {
  announcementID: string;
  date: string;
  title: string;
  content: string;
  href: string | null;
}

export interface jargons {
  name: string;
  description: string;
}

export interface Delegate {
  delegateID: string;
  firstname: string;
  lastname: string;
  password?: string;
  email: string;
  country: string | null;
  school?: string | null;
  grade?: string | null;
  committeeID: string | null;
  committee?: Committee | null;
  id?: string;
  role?: AppUserRole;
  resoPerms: {
    "view:ownreso": boolean;
    "view:allreso": boolean;
    "update:ownreso": boolean;
    "update:reso": string[];
  };
}

export interface shortenedDel {
  delegateID: string;
  firstname: string;
  lastname: string;
  resoPerms: {
    "view:ownreso": boolean;
    "view:allreso": boolean;
    "update:ownreso": boolean;
    "update:reso": string[];
  };
}

export interface Article {
  source: {
    id: string;
    name: string;
  };
  author: string;
  title: string;
  description: string;
  url: string;
  urlToImage: string;
  publishedAt: string;
  content: string;
}

export interface Admin {
  adminID: string;
  firstname: string;
  lastname: string;
  password?: string;
  email: string;
  id?: string;
  role?: AppUserRole;
}

export interface Reso {
  resoID: string;
  title: string;
  delegateID: string;
  committeeID: string | null;
  content: Json;
  isNew: boolean | null;
}
