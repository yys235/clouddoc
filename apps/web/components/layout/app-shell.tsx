import { ReactNode } from "react";

import { SidebarNav } from "@/components/layout/sidebar-nav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fcfbf8]">
      <SidebarNav />
      <main className="min-h-screen min-w-0 pl-56">{children}</main>
    </div>
  );
}
