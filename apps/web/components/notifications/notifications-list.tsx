"use client";
import { useMemo, useState, useTransition } from "react";
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

export function NotificationsList({ notifications }: { notifications: NotificationItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(notifications);
  const [notice, setNotice] = useState("");
  const [isPending, startTransition] = useTransition();
  const unreadCount = useMemo(() => items.filter((item) => !item.isRead).length, [items]);

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
