import { ReactNode } from "react";

import { SidebarNav } from "@/components/layout/sidebar-nav";
import { fetchCurrentOrganization, fetchCurrentUser, fetchUnreadNotificationCount } from "@/lib/api";

export async function AppShell({ children }: { children: ReactNode }) {
  const [{ data: currentUser }, { data: currentOrganization }, { data: unreadNotifications }] = await Promise.all([
    fetchCurrentUser(),
    fetchCurrentOrganization(),
    fetchUnreadNotificationCount(),
  ]);

  return (
    <div className="min-h-screen bg-[#fcfbf8]">
      <SidebarNav
        currentUser={
          currentUser
            ? { name: currentUser.name, email: currentUser.email }
            : null
        }
        currentOrganizationName={currentOrganization?.name ?? null}
        notificationUnreadCount={unreadNotifications?.unreadCount ?? 0}
      />
      <main className="min-h-screen min-w-0 pl-56">{children}</main>
    </div>
  );
}
