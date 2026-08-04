// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React, { useEffect } from "react";
import { useSession } from "../app/context/sessionContext";
import { useRouter } from "next/navigation";

const PROTECTED_ROUTE_DEBUG_PREFIX = "[ProtectedRouteDebug]";

const useRedirect = () => {
  const router = useRouter();
  return (path: string) => router.replace(path);
};

// this route protects from all unauthorized
export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user: currentUser, authReady, isAuthenticated } = useSession();
  const navigate = useRedirect();

  useEffect(() => {
    console.debug(`${PROTECTED_ROUTE_DEBUG_PREFIX} ProtectedRoute`, {
      authReady,
      isAuthenticated,
      hasUser: Boolean(currentUser),
    });
    if (!authReady) return;
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [authReady, currentUser, isAuthenticated, navigate]);

  if (!authReady) return null;
  if (!isAuthenticated) return null;

  return <>{children}</>;
};

// protects from any1 who aint a delegate
export const DelegateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user: currentUser, authReady, isAuthenticated } = useSession();
  const navigate = useRedirect();

  const blocked = !isAuthenticated || currentUser?.role !== 'delegate';

  useEffect(() => {
    if (!authReady) return;
    if (blocked) {
      navigate("/login");
    }
  }, [blocked, authReady, navigate]);

  if (!authReady) return null;
  if (blocked) return null;

  return <>{children}</>;
};

// protects staff-only pages from delegates and chairs
export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user: currentUser, authReady, isAuthenticated } = useSession();
  const navigate = useRedirect();

  const blocked = !isAuthenticated || !['admin', 'secretariat'].includes(currentUser?.role || '');

  useEffect(() => {
    if (!authReady) return;
    if (blocked) {
      navigate("/login");
    }
  }, [blocked, authReady, navigate]);

  if (!authReady) return null;
  if (blocked) return null;

  return <>{children}</>;
};

export const ChairRoute = ({ children }: { children: React.ReactNode }) => {
  const { user: currentUser, authReady, isAuthenticated } = useSession();
  const navigate = useRedirect();

  const blocked = !isAuthenticated || currentUser?.role !== 'chair';

  useEffect(() => {
    if (!authReady) return;
    if (blocked) {
      navigate("/login");
    }
  }, [blocked, authReady, navigate]);

  if (!authReady) return null;
  if (blocked) return null;

  return <>{children}</>;
};

export const ParticipantRoute = ({ children }: { children: React.ReactNode }) => {
  const { user: currentUser, authReady, isAuthenticated } = useSession();
  const navigate = useRedirect();

  const blocked = !isAuthenticated || currentUser?.role === 'admin' || currentUser?.role === 'secretariat';

  useEffect(() => {
    console.debug(`${PROTECTED_ROUTE_DEBUG_PREFIX} ParticipantRoute`, {
      authReady,
      isAuthenticated,
      hasUser: Boolean(currentUser),
      blocked,
    });
    if (!authReady) return;
    if (blocked) {
      navigate("/login");
    }
  }, [blocked, authReady, currentUser, isAuthenticated, navigate]);

  if (!authReady) return null;
  if (blocked) return null;

  return <>{children}</>;
};
