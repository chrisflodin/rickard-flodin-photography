"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/services/supabase/client";

interface AdminContextValue {
  isAdmin: boolean;
}

const AdminContext = createContext<AdminContextValue>({ isAdmin: false });

export function AdminProvider({
  isAdmin,
  children,
}: {
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const [clientIsAdmin, setClientIsAdmin] = useState(isAdmin);

  useEffect(() => {
    setClientIsAdmin(isAdmin);
  }, [isAdmin]);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setClientIsAdmin(Boolean(data.user));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setClientIsAdmin(Boolean(session?.user));
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo(
    () => ({ isAdmin: clientIsAdmin }),
    [clientIsAdmin]
  );

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin(): boolean {
  return useContext(AdminContext).isAdmin;
}
