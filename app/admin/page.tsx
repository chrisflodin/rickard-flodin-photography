import type { Metadata } from "next";
import Link from "next/link";
import { getAdminSession } from "@/lib/api-client/auth";
import LoginForm from "@/components/admin/login-form";
import LogoutButton from "@/components/admin/logout-button";
import CommerceSettingsForm from "@/components/admin/commerce-settings";
import OrdersTable from "@/components/admin/orders-table";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const { isAdmin, user } = await getAdminSession();

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-6xl flex-col justify-center px-6 py-16">
      {isAdmin ? (
        <div className="space-y-8 text-center">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              You are signed in
            </h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Editing controls are now available across the site. Head to the
            gallery to upload, reorder and edit photos.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button asChild>
              <Link href="/">Go to gallery</Link>
            </Button>
            <LogoutButton />
          </div>
          <div className="rounded-lg border p-5">
            <CommerceSettingsForm />
          </div>
          <div className="rounded-lg border p-5">
            <OrdersTable />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Admin login</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to manage the portfolio.
            </p>
          </div>
          <LoginForm />
        </div>
      )}
    </div>
  );
}
