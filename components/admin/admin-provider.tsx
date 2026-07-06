"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

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
