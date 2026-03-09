// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { Admin, Delegate, Chair, Secretariat, UserType } from "@/db/types";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
// lot to explain here lolz
interface SessionContextProps {
  user: UserType | null;
  isSessionHydrated: boolean;
  login: (user: UserType) => void;
  logout: () => void;
}

const SessionContext = createContext<SessionContextProps | undefined>(
  undefined
);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<Delegate | Admin | Chair | Secretariat | null>(null);
  const [isSessionHydrated, setIsSessionHydrated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const storedUser = Cookies.get("user");

    if (!storedUser) {
      setUser(null);
      setIsSessionHydrated(true);
      return;
    }

    try {
      setUser(JSON.parse(storedUser));
    } catch {
      Cookies.remove("user");
      setUser(null);
    } finally {
      setIsSessionHydrated(true);
    }
  }, []);

  const login = (user: UserType) => {
    setUser(user);
    Cookies.set("user", JSON.stringify(user));
  };

  //for now, though this is there, it doesnt have an implementation, might add it later,
  //if this is already added and my comment is still here then i have forgotten to remove this
  const logout = () => {
    setUser(null);
    Cookies.remove("user");
    router.replace("/login");
  };

  return (
    <SessionContext.Provider value={{ user, isSessionHydrated, login, logout }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
};
