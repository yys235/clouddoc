"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { markAllNotificationsRead, markNotificationRead, type NotificationItem } from "@/lib/api";

function formatTime(value: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function notificationFromEvent(value: unknown): NotificationItem | null {
  const item = value as {
    id?: string;
    user_id?: string;
    actor_id?: string | null;
    actor_name?: string | null;
    document_id?: string | null;
    document_title?: string | null;
    thread_id?: string | null;
    comment_id?: string | null;
    notification_type?: string;
    title?: string;
    body?: string;
    is_read?: boolean;
    created_at?: string;
    updated_at?: string;
  };
  if (!item?.id || !item.user_id || !item.notification_type || !item.title) {
    return null;
  }
  return {
    id: item.id,
    userId: item.user_id,
    actorId: item.actor_id ?? undefined,
    actorName: item.actor_name ?? undefined,
    documentId: item.document_id ?? undefined,
    documentTitle: item.document_title ?? undefined,
    threadId: item.thread_id ?? undefined,
    commentId: item.comment_id ?? undefined,
    notificationType: item.notification_type,
    title: item.title,
    body: item.body ?? "",
    isRead: Boolean(item.is_read),
    createdAt: item.created_at ?? new Date().toISOString(),
    updatedAt: item.updated_at ?? item.created_at ?? new Date().toISOString(),
  };
}

export function NotificationsList({
  notifications,
  enableLiveUpdates = false,
}: {
  notifications: NotificationItem[];
  enableLiveUpdates?: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(notifications);
  const [notice, setNotice] = useState("");
  const [isPending, startTransition] = useTransition();
  const unreadCount = useMemo(() => items.filter((item) => !item.isRead).length, [items]);

  useEffect(() => {
    setItems(notifications);
  }, [notifications]);

  useEffect(() => {
    if (!enableLiveUpdates) {
      return;
    }

    const source = new EventSource("/api/events/stream", { withCredentials: true });
    const handleCreated = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as { notification?: unknown };
        const notification = notificationFromEvent(payload.notification);
        if (!notification) {
          return;
        }
        setItems((current) => {
          const existing = current.some((item) => item.id === notification.id);
          if (existing) {
            return current.map((item) => (item.id === notification.id ? notification : item));
          }
          return [notification, ...current];
        });
      } catch {
        setNotice("收到通知更新，但解析失败");
      }
    };
    const handleRead = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as { notification?: { id?: string }; target_id?: string };
        const id = payload.notification?.id ?? payload.target_id;
        if (!id) {
          return;
        }
        setItems((current) =>
          current.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
        );
      } catch {
        setNotice("收到已读更新，但解析失败");
      }
    };
    const handleReadAll = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as { notification_ids?: string[] };
        const ids = new Set(payload.notification_ids ?? []);
        setItems((current) =>
          current.map((item) => (ids.size === 0 || ids.has(item.id) ? { ...item, isRead: true } : item)),
        );
      } catch {
        setItems((current) => current.map((item) => ({ ...item, isRead: true })));
      }
    };

    source.addEventListener("notification.created", handleCreated);
    source.addEventListener("notification.read", handleRead);
    source.addEventListener("notification.read_all", handleReadAll);
    source.onerror = () => {
      source.close();
    };
    return () => {
      source.removeEventListener("notification.created", handleCreated);
      source.removeEventListener("notification.read", handleRead);
      source.removeEventListener("notification.read_all", handleReadAll);
      source.close();
    };
  }, [enableLiveUpdates]);

  const openNotificationDocument = (item: NotificationItem) => {
    const href = `/docs/${item.documentId}${item.threadId ? `?thread=${item.threadId}` : ""}`;
    startTransition(async () => {
      if (!item.isRead) {
        try {
          await markNotificationRead(item.id);
          setItems((current) =>
            current.map((currentItem) =>
              currentItem.id === item.id ? { ...currentItem, isRead: true } : currentItem,
            ),
          );
        } catch {
          setNotice("标记已读失败");
        }
      }
      router.push(href);
      router.refresh();
    });
  };

  return (
    <section className="rounded-3xl bg-white p-5 shadow-panel">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">评论通知</h2>
          <div className="mt-1 text-sm text-slate-500">未读 {unreadCount} 条</div>
        </div>
        <button
          type="button"
          disabled={isPending || unreadCount === 0}
          onClick={() =>
            startTransition(async () => {
              try {
                await markAllNotificationsRead();
                setItems((current) => current.map((item) => ({ ...item, isRead: true })));
                setNotice("已全部标记为已读");
                router.refresh();
              } catch {
                setNotice("标记全部已读失败");
              }
            })
          }
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-60"
        >
          全部已读
        </button>
      </div>

      {notice ? <div className="mt-3 text-sm text-slate-600">{notice}</div> : null}

      <div className="mt-4 space-y-3">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border px-4 py-3 ${item.isRead ? "border-slate-100 bg-white" : "border-sky-100 bg-sky-50/40"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900">{item.title}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {item.actorName ? `${item.actorName} · ` : ""}
                    {formatTime(item.createdAt)}
                  </div>
                </div>
                {!item.isRead ? <span className="mt-1 h-2.5 w-2.5 rounded-full bg-sky-500" /> : null}
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-600">{item.body}</div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="truncate text-xs text-slate-400">{item.documentTitle ?? "未命名文档"}</div>
                <div className="flex items-center gap-2">
                  {!item.isRead ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          try {
                            await markNotificationRead(item.id);
                            setItems((current) =>
                              current.map((currentItem) =>
                                currentItem.id === item.id ? { ...currentItem, isRead: true } : currentItem,
                              ),
                            );
                            router.refresh();
                          } catch {
                            setNotice("标记已读失败");
                          }
                        })
                      }
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 disabled:opacity-60"
                    >
                      标记已读
                    </button>
                  ) : null}
                  {item.documentId ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => openNotificationDocument(item)}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white disabled:opacity-60"
                    >
                      打开文档
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
            当前没有通知。
          </div>
        )}
      </div>
    </section>
  );
}
