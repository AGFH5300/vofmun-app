// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
import { NextRequest } from "next/server";
import { UserType } from "@/db/types";

export function getServerSession(request: NextRequest): UserType | null {
  try {
    const userCookie = request.cookies.get("user");
    if (!userCookie?.value) {
      return null;
    }

    const user = JSON.parse(userCookie.value) as UserType;
    if (!user?.id || !user?.role) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error parsing user session:', error);
    return null;
  }
}

export function getUserIdentity(user: UserType): { userID: string; userType: 'delegate' | 'chair' | 'admin' | 'secretariat'; userName: string } | null {
  if (!user?.id || !user?.role) return null;

  return {
    userID: String(user.id),
    userType: user.role,
    userName: user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown'
  };
}

export function unauthorizedResponse(message: string = 'Unauthorized') {
  return new Response(
    JSON.stringify({ error: message }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  );
}

export function forbiddenResponse(message: string = 'Forbidden') {
  return new Response(
    JSON.stringify({ error: message }),
    { status: 403, headers: { 'Content-Type': 'application/json' } }
  );
}
