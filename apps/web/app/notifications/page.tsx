import { AppShell } from "@/components/layout/app-shell";
import { DashboardPageFrame } from "@/components/dashboard/dashboard-sections";
import { fetchNotifications } from "@/lib/api";

import { NotificationsList } from "@/components/notifications/notifications-list";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const { data: notifications, unavailable } = await fetchNotifications();

  return (
    <AppShell>
      <DashboardPageFrame
        title="通知"
        description="查看评论相关通知，并快速跳转到对应文档位置。"
        apiUnavailable={unavailable}
      >
        <NotificationsList notifications={notifications} />
      </DashboardPageFrame>
    </AppShell>
  );
}
