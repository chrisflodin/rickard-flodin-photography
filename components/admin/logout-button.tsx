"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { apiMutation } from "@/lib/api-client/client";
import { Button } from "@/components/ui/button";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await apiMutation("/api/auth/logout", { method: "POST" });
    router.refresh();
    router.push("/");
  }

  return (
    <Button variant="outline" onClick={handleLogout}>
      <LogOut className="mr-1" />
      Sign out
    </Button>
  );
}
