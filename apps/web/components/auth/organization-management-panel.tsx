"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import type { CurrentOrganization, OrganizationMember, SessionSummary } from "@/lib/api";
import {
  createOrganization,
  inviteOrganizationMember,
  revokeSession,
  updateOrganizationMember,
} from "@/lib/api";

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

export function OrganizationManagementPanel({
  currentOrganization,
  members,
  sessions,
}: {
  currentOrganization: CurrentOrganization | null;
  members: OrganizationMember[];
  sessions: SessionSummary[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [organizationName, setOrganizationName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [notice, setNotice] = useState("");
  const [pendingSessionAction, setPendingSessionAction] = useState<SessionSummary | null>(null);
  const canManageOrganization = currentOrganization?.role === "owner" || currentOrganization?.role === "admin";

  return (
    <section className="rounded-3xl bg-white p-5 shadow-panel">
      <h2 className="text-lg font-semibold">组织管理</h2>
      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-100 p-4">
          <div className="text-sm font-medium text-slate-900">创建组织</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">创建后会自动生成一个团队空间。</div>
          <input
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            placeholder="输入组织名称"
            className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
          />
          <button
            type="button"
            disabled={isPending || !organizationName.trim()}
            onClick={() =>
              startTransition(async () => {
                try {
                  await createOrganization({ name: organizationName.trim() });
                  setOrganizationName("");
                  setNotice("组织已创建");
                  router.refresh();
                } catch {
                  setNotice("组织创建失败");
                }
              })
            }
            className="mt-3 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            创建组织
          </button>
        </div>

        <div className="rounded-lg border border-slate-100 p-4">
          <div className="text-sm font-medium text-slate-900">邀请成员</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">
            {currentOrganization ? `当前组织：${currentOrganization.name}` : "当前没有组织可邀请"}
          </div>
          <input
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="输入成员邮箱"
            className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
            disabled={!currentOrganization}
          />
          <select
            value={inviteRole}
            onChange={(event) => setInviteRole(event.target.value)}
            className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
            disabled={!currentOrganization}
          >
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
          <button
            type="button"
            disabled={isPending || !currentOrganization || !inviteEmail.trim() || !canManageOrganization}
            onClick={() =>
              startTransition(async () => {
                if (!currentOrganization) {
                  return;
                }
                try {
                  await inviteOrganizationMember({
                    organizationId: currentOrganization.id,
                    email: inviteEmail.trim(),
                    role: inviteRole,
                  });
                  setInviteEmail("");
                  setNotice("邀请已创建");
                  router.refresh();
                } catch {
                  setNotice("邀请失败");
                }
              })
            }
          className="mt-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-60"
          >
            发送邀请
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-slate-100 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-slate-900">成员管理</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">
              {currentOrganization ? `当前组织共有 ${members.length} 位成员。` : "登录后可查看当前组织成员。"}
            </div>
          </div>
          {!canManageOrganization ? (
            <div className="rounded-lg bg-mist px-3 py-1 text-xs font-medium text-slate-500">只读</div>
          ) : null}
        </div>
        <div className="mt-3 space-y-2">
          {members.length > 0 ? (
            members.map((member) => {
              const isOwner = member.role === "owner";
              const canEditMember = Boolean(canManageOrganization && !isOwner);

              return (
                <div
                  key={member.id}
                  className="grid gap-3 rounded-lg border border-slate-100 px-3 py-3 lg:grid-cols-[minmax(0,1fr),140px,140px,120px]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-800">{member.name}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">{member.email}</div>
                    <div className="mt-1 text-xs text-slate-400">加入于 {formatTime(member.joinedAt)}</div>
                  </div>
                  <select
                    defaultValue={member.role}
                    disabled={!canEditMember || isPending}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none disabled:bg-slate-50 disabled:text-slate-400"
                    onChange={(event) => {
                      const nextRole = event.target.value;
                      startTransition(async () => {
                        if (!currentOrganization || nextRole === member.role) {
                          return;
                        }
                        try {
                          await updateOrganizationMember({
                            organizationId: currentOrganization.id,
                            memberId: member.id,
                            role: nextRole,
                          });
                          setNotice(`已更新 ${member.name} 的角色`);
                          router.refresh();
                        } catch {
                          setNotice(`更新 ${member.name} 角色失败`);
                          router.refresh();
                        }
                      });
                    }}
                  >
                    <option value="owner">owner</option>
                    <option value="admin">admin</option>
                    <option value="member">member</option>
                  </select>
                  <select
                    defaultValue={member.status}
                    disabled={!canEditMember || isPending}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none disabled:bg-slate-50 disabled:text-slate-400"
                    onChange={(event) => {
                      const nextStatus = event.target.value;
                      startTransition(async () => {
                        if (!currentOrganization || nextStatus === member.status) {
                          return;
                        }
                        try {
                          await updateOrganizationMember({
                            organizationId: currentOrganization.id,
                            memberId: member.id,
                            status: nextStatus,
                          });
                          setNotice(`已更新 ${member.name} 的状态`);
                          router.refresh();
                        } catch {
                          setNotice(`更新 ${member.name} 状态失败`);
                          router.refresh();
                        }
                      });
                    }}
                  >
                    <option value="active">active</option>
                    <option value="invited">invited</option>
                    <option value="disabled">disabled</option>
                  </select>
                  <div className="flex items-center justify-end">
                    <div className="rounded-lg bg-mist px-3 py-1 text-xs font-medium text-slate-600">
                      {isOwner ? "组织所有者" : "成员"}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-sm text-slate-500">当前没有可用的成员数据。</div>
          )}
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-slate-100 p-4">
        <div className="text-sm font-medium text-slate-900">当前会话</div>
        <div className="mt-3 space-y-2">
          {sessions.length > 0 ? (
            sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate text-slate-800">{session.userAgent || "Unknown device"}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {session.ipAddress || "unknown ip"} · {formatTime(session.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-mist px-3 py-1 text-xs font-medium text-slate-600">
                    {session.isCurrent ? "当前会话" : "活跃"}
                  </div>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setPendingSessionAction(session)}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 disabled:opacity-60"
                  >
                    {session.isCurrent ? "退出" : "撤销"}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-slate-500">当前没有可用的会话数据。</div>
          )}
        </div>
      </div>

      {notice ? <div className="mt-3 text-sm text-slate-600">{notice}</div> : null}
      <ConfirmDialog
        open={Boolean(pendingSessionAction)}
        title={pendingSessionAction?.isCurrent ? "确认退出当前会话" : "确认撤销会话"}
        description={
          pendingSessionAction
            ? pendingSessionAction.isCurrent
              ? "确认后将退出当前登录状态，并跳转到登录页。"
              : "确认后该会话将失效，需要重新登录。"
            : ""
        }
        confirmLabel={pendingSessionAction?.isCurrent ? "确认退出" : "确认撤销"}
        cancelLabel="取消"
        danger
        pending={isPending}
        onCancel={() => setPendingSessionAction(null)}
        onConfirm={() =>
          startTransition(async () => {
            if (!pendingSessionAction) {
              return;
            }
            try {
              await revokeSession(pendingSessionAction.id);
              setNotice(pendingSessionAction.isCurrent ? "当前会话已退出" : "会话已撤销");
              setPendingSessionAction(null);
              router.refresh();
              if (pendingSessionAction.isCurrent) {
                router.push("/login");
              }
            } catch {
              setNotice("撤销会话失败");
            }
          })
        }
      />
    </section>
  );
}
