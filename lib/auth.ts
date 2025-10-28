import { NextRequest } from "next/server";
import { UserType, Delegate, Chair, Admin } from "@/db/types";

/**
 * Extract and validate user session from request cookies
 * @param request - Next.js request object
 * @returns User object or null if not authenticated
 */
export function getServerSession(request: NextRequest): UserType | null {
  try {
    const userCookie = request.cookies.get("user");
    if (!userCookie?.value) {
      return null;
    }

    const user = JSON.parse(userCookie.value) as UserType;
    
    // Validate that the user object has the required structure
    if (!user) {
      return null;
    }

    // Check if user has valid ID and required fields
    if ('delegateID' in user && user.delegateID && user.firstname && user.lastname) {
      return user as Delegate;
    }
    
    if ('chairID' in user && user.chairID && user.firstname && user.lastname) {
      return user as Chair;
    }
    
    if ('adminID' in user && user.adminID && user.firstname && user.lastname) {
      return user as Admin;
    }

    return null;
  } catch (error) {
    console.error('Error parsing user session:', error);
    return null;
  }
}

/**
 * Get user ID and type from authenticated session
 * @param user - User object from session
 * @returns Object with userID and userType
 */
export function getUserIdentity(user: UserType): { userID: string; userType: 'delegate' | 'chair' | 'admin'; userName: string } | null {
  if (!user) return null;

  if ('delegateID' in user) {
    return {
      userID: user.delegateID,
      userType: 'delegate',
      userName: `${user.firstname} ${user.lastname}`
    };
  }
  
  if ('chairID' in user) {
    return {
      userID: user.chairID,
      userType: 'chair',
      userName: `${user.firstname} ${user.lastname}`
    };
  }
  
  if ('adminID' in user) {
    return {
      userID: user.adminID,
      userType: 'admin',
      userName: `${user.firstname} ${user.lastname}`
    };
  }

  return null;
}

/**
 * Create unauthorized response
 */
export function unauthorizedResponse(message: string = 'Unauthorized') {
  return new Response(
    JSON.stringify({ error: message }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Create forbidden response
 */
export function forbiddenResponse(message: string = 'Forbidden') {
  return new Response(
    JSON.stringify({ error: message }),
    { status: 403, headers: { 'Content-Type': 'application/json' } }
  );
}