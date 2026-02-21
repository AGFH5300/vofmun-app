// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React, { useEffect } from "react";
import { useSession } from "../app/context/sessionContext";
import { useRouter } from "next/navigation";

const useRedirect = () => {
  const router = useRouter();
  return (path: string) => router.push(path);
};

// this route protects from all unauthorized
export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user: currentUser } = useSession();
  const navigate = useRedirect();

  useEffect(() => {
    if (currentUser === null) {
      navigate("/login");
    }
  }, [currentUser, navigate]);

  return <>{children}</>;
};

// protects from any1 who aint a delegate
export const DelegateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user: currentUser } = useSession();
  const navigate = useRedirect();

  useEffect(() => {
    if (!('delegateID' in (currentUser || {})) || currentUser === null) {
      navigate("/login");
    }
  }, [currentUser, navigate]);

  return <>{children}</>;
};

// protects from any1 who aint an admin
export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user: currentUser } = useSession();
  const navigate = useRedirect();

  useEffect(() => {
    if (!('adminID' in (currentUser || {})) || currentUser === null) {
      navigate("/login");
    }
  }, [currentUser, navigate]);

  return <>{children}</>;
};

export const ChairRoute = ({ children }: { children: React.ReactNode }) => {
  const { user: currentUser } = useSession();
  const navigate = useRedirect();

  useEffect(() => {
    if (!('chairID' in (currentUser || {})) || currentUser === null) {
      navigate("/login");
    }
  }, [currentUser, navigate]);

  return <>{children}</>;
};

export const ParticipantRoute = ({ children }: { children: React.ReactNode }) => {
  const { user: currentUser } = useSession();
  const navigate = useRedirect();

  useEffect(() => {
    if (('adminID' in (currentUser || {})) || currentUser === null) {
      navigate("/login");
    }
  }, [currentUser, navigate]);

  return <>{children}</>;
};
