// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React, { useCallback, useEffect } from "react";
import { useSession } from "../app/context/sessionContext";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const useRedirect = () => {
  const router = useRouter();
  return useCallback((path: string) => router.replace(path), [router]);
};

const RouteLoading = () => (
  <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-[#f9f9f9] px-6">
    <div className="flex items-center gap-3 rounded-xl border border-[#dcc0bd]/30 bg-white px-5 py-4 text-sm font-medium text-[#6E1D1B] shadow-sm">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading your VOFMUN account…
    </div>
  </div>
);

// Protects routes from unauthenticated users.
export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { authReady, isAuthenticated } = useSession();
  const navigate = useRedirect();

  useEffect(() => {
    if (authReady && !isAuthenticated) {
      navigate("/login");
    }
  }, [authReady, isAuthenticated, navigate]);

  if (!authReady) return <RouteLoading />;
  if (!isAuthenticated) return null;

  return <>{children}</>;
};

export const DelegateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user: currentUser, authReady, isAuthenticated } = useSession();
  const navigate = useRedirect();
  const blocked = !isAuthenticated || currentUser?.role !== "delegate";

  useEffect(() => {
    if (authReady && blocked) {
      navigate("/login");
    }
  }, [authReady, blocked, navigate]);

  if (!authReady) return <RouteLoading />;
  if (blocked) return null;

  return <>{children}</>;
};

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user: currentUser, authReady, isAuthenticated } = useSession();
  const navigate = useRedirect();
  const blocked = !isAuthenticated || !["admin", "secretariat"].includes(currentUser?.role || "");

  useEffect(() => {
    if (authReady && blocked) {
      navigate("/login");
    }
  }, [authReady, blocked, navigate]);

  if (!authReady) return <RouteLoading />;
  if (blocked) return null;

  return <>{children}</>;
};

export const ChairRoute = ({ children }: { children: React.ReactNode }) => {
  const { user: currentUser, authReady, isAuthenticated } = useSession();
  const navigate = useRedirect();
  const blocked = !isAuthenticated || currentUser?.role !== "chair";

  useEffect(() => {
    if (authReady && blocked) {
      navigate("/login");
    }
  }, [authReady, blocked, navigate]);

  if (!authReady) return <RouteLoading />;
  if (blocked) return null;

  return <>{children}</>;
};

export const ParticipantRoute = ({ children }: { children: React.ReactNode }) => {
  const { user: currentUser, authReady, isAuthenticated } = useSession();
  const navigate = useRedirect();
  const blocked = !isAuthenticated || currentUser?.role === "admin" || currentUser?.role === "secretariat";

  useEffect(() => {
    if (authReady && blocked) {
      navigate("/login");
    }
  }, [authReady, blocked, navigate]);

  if (!authReady) return <RouteLoading />;
  if (blocked) return null;

  return <>{children}</>;
};
