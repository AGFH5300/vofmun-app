
export interface Committee {
  committeeID: string;
  name: string;
  fullname: string;
}

export interface Chair {
  chairID: string;
  firstname: string;
  lastname: string;
  password: string;
  email: string;
}

export interface Secretariat {
  secretariatID: string;
  firstname: string;
  lastname: string;
  password: string;
  email: string;
}

export type UserType = Delegate | Admin | Chair | Secretariat | null;

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
  href: string;
}

export interface Announcement {
  announcementID: string;
  date: string;
  title: string;
  content: string;
  href: string;
}

export interface SpeechTag {
  speechID: string;
  tag: string;
}

export interface jargons {
  name: string;
  description: string;
}

export interface Delegate {
  delegateID: string;
  firstname: string;
  lastname: string;
  password: string;
  email: string;
  country: string | null;
  committeeID: string | null;
  committee?: Committee | null;
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
  adminID :string;
  firstname: string;
  lastname: string;
  password: string;
  email: string;
}

export interface Reso {
  resoID: string;
  title:string;
  delegateID: string;
  committeeID: string;
  content: Object;
  isNew: boolean;
}