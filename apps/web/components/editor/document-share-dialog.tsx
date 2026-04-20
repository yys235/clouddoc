"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";

import {
  addDocumentPermission,
  deleteDocumentPermission,
  disableDocumentShare,
  fetchDocumentIntegrations,
  fetchDocumentPermissionAuditLogs,
  fetchDocumentPermissions,
  fetchDocumentPermissionSettings,
  fetchDocumentShareSettings,
  rotateDocumentShare,
  transferDocumentOwner,
  type DocumentPermissionAuditLog,
  type DocumentIntegrationAccess,
  type DocumentPermissionMember,
  type DocumentPermissionSettings,
  type OrganizationMember,
  type ShareLinkSettings,
  updateDocumentPermission,
  updateDocumentPermissionSettings,
  updateDocumentVisibility,
  upsertDocumentShare,
} from "@/lib/api";

function toLocalDateTimeValue(value?: string) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function absoluteShareUrl(shareUrl?: string) {
  if (!shareUrl) {
    return "";
  }
  if (typeof window === "undefined") {
    return shareUrl;
  }
  if (/^https?:\/\//i.test(shareUrl)) {
    return shareUrl;
  }
  return `${window.location.origin}${shareUrl}`;
}

export function DocumentShareDialog({
  open,
  documentId,
  currentVisibility,
  canTransferOwner = false,
  initialTab = "visibility",
  mentionCandidates,
  onClose,
  onSaved,
}: {
  open: boolean;
  documentId: string;
  currentVisibility: "private" | "public";
  canTransferOwner?: boolean;
  initialTab?: "visibility" | "members" | "share" | "security" | "integrations" | "audit";
  mentionCandidates: OrganizationMember[];
  onClose: () => void;
  onSaved: (next: { visibility: "private" | "public"; share: ShareLinkSettings | null }) => void;
}) {
  const [visibility, setVisibility] = useState<"private" | "public">(currentVisibility);
  const [enabled, setEnabled] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [password, setPassword] = useState("");
  const [allowCopy, setAllowCopy] = useState(false);
  const [allowExport, setAllowExport] = useState(false);
  const [share, setShare] = useState<ShareLinkSettings | null>(null);
  const [permissionSettings, setPermissionSettings] = useState<DocumentPermissionSettings | null>(null);
  const [permissionMembers, setPermissionMembers] = useState<DocumentPermissionMember[]>([]);
  const [documentIntegrations, setDocumentIntegrations] = useState<DocumentIntegrationAccess[]>([]);
  const [auditLogs, setAuditLogs] = useState<DocumentPermissionAuditLog[]>([]);
  const [activeTab, setActiveTab] = useState<"visibility" | "members" | "share" | "security" | "integrations" | "audit">("visibility");
  const [newSubjectId, setNewSubjectId] = useState("");
  const [newSubjectQuery, setNewSubjectQuery] = useState("");
  const [newPermissionLevel, setNewPermissionLevel] = useState("view");
  const [transferOwnerId, setTransferOwnerId] = useState("");
  const [transferOwnerQuery, setTransferOwnerQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const deferredNewSubjectQuery = useDeferredValue(newSubjectQuery);
  const deferredTransferOwnerQuery = useDeferredValue(transferOwnerQuery);

  const memberMap = useMemo(
    () => new Map(mentionCandidates.map((member) => [member.userId, member])),
    [mentionCandidates],
  );

  const filterCandidates = (query: string, excludeIds: string[] = []) => {
    const normalized = query.trim().toLowerCase();
    return mentionCandidates
      .filter((member) => !excludeIds.includes(member.userId))
      .filter((member) => {
        if (!normalized) {
          return true;
        }
        return [member.name, member.email, member.userId].some((value) => value.toLowerCase().includes(normalized));
      })
      .slice(0, normalized ? 8 : 6);
  };

  const selectableCollaborators = useMemo(
    () => filterCandidates(deferredNewSubjectQuery, permissionMembers.map((member) => member.subjectId)),
    [deferredNewSubjectQuery, mentionCandidates, permissionMembers],
  );
  const transferableOwners = useMemo(
    () => filterCandidates(deferredTransferOwnerQuery),
    [deferredTransferOwnerQuery, mentionCandidates],
  );
  const selectedNewSubject = newSubjectId ? memberMap.get(newSubjectId) ?? null : null;
  const selectedTransferOwner = transferOwnerId ? memberMap.get(transferOwnerId) ?? null : null;

  useEffect(() => {
    if (!open) {
      return;
    }
    setVisibility(currentVisibility);
    setActiveTab(initialTab);
    setPassword("");
    setTransferOwnerId("");
    setTransferOwnerQuery("");
    setNewSubjectId("");
    setNewSubjectQuery("");
    setNotice("");
    setLoading(true);
    void Promise.all([
      fetchDocumentShareSettings(documentId),
      fetchDocumentPermissionSettings(documentId),
      fetchDocumentPermissions(documentId),
      fetchDocumentIntegrations(documentId),
      fetchDocumentPermissionAuditLogs(documentId),
    ])
      .then(([result, permissionSettingsResult, membersResult, integrationsResult, auditResult]) => {
        const nextShare = result.data;
        setShare(nextShare);
        setEnabled(Boolean(nextShare?.isEnabled));
        setExpiresAt(toLocalDateTimeValue(nextShare?.expiresAt));
        setAllowCopy(Boolean(nextShare?.allowCopy));
        setAllowExport(Boolean(nextShare?.allowExport));
        setPermissionSettings(permissionSettingsResult.data);
        setPermissionMembers(membersResult.data);
        setDocumentIntegrations(integrationsResult.data);
        setAuditLogs(auditResult.data);
      })
      .finally(() => setLoading(false));
  }, [currentVisibility, documentId, initialTab, open]);

  const resolvedShareUrl = useMemo(() => absoluteShareUrl(share?.shareUrl), [share?.shareUrl]);

  if (!open) {
    return null;
  }

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setNotice("");
    try {
      await updateDocumentVisibility(documentId, visibility);
      if (permissionSettings) {
        const nextSettings = await updateDocumentPermissionSettings(documentId, {
          commentScope: permissionSettings.commentScope,
          shareCollaboratorScope: permissionSettings.shareCollaboratorScope,
          copyScope: permissionSettings.copyScope,
          exportScope: permissionSettings.exportScope,
          printScope: permissionSettings.printScope,
          downloadScope: permissionSettings.downloadScope,
          externalAccessEnabled: permissionSettings.externalAccessEnabled,
          linkShareScope: permissionSettings.linkShareScope,
        });
        setPermissionSettings(nextSettings);
      }
      let nextShare: ShareLinkSettings | null = share;
      if (enabled) {
        nextShare = await upsertDocumentShare(documentId, {
          enabled: true,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          password: password || null,
          allowCopy,
          allowExport,
        });
      } else if (share?.id || share?.token) {
        nextShare = await disableDocumentShare(documentId);
      } else {
        nextShare = null;
      }
      setShare(nextShare);
      setPassword("");
      onSaved({ visibility, share: enabled ? nextShare : null });
      setNotice("权限与分享设置已保存");
    } catch {
      setNotice("权限与分享设置保存失败");
    } finally {
      setSaving(false);
    }
  };

  const reloadPermissionData = async () => {
    const [membersResult, auditResult] = await Promise.all([
      fetchDocumentPermissions(documentId),
      fetchDocumentPermissionAuditLogs(documentId),
    ]);
    setPermissionMembers(membersResult.data);
    setAuditLogs(auditResult.data);
  };

  const handleAddPermission = async () => {
    if (saving || !newSubjectId.trim()) return;
    setSaving(true);
    setNotice("");
    try {
      await addDocumentPermission(documentId, {
        subjectType: "user",
        subjectId: newSubjectId.trim(),
        permissionLevel: newPermissionLevel,
      });
      setNewSubjectId("");
      setNewSubjectQuery("");
      await reloadPermissionData();
      setNotice("协作者已添加");
    } catch {
      setNotice("添加协作者失败，请确认成员和权限");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePermission = async (permissionId: string, permissionLevel: string) => {
    if (saving) return;
    setSaving(true);
    setNotice("");
    try {
      await updateDocumentPermission(documentId, permissionId, permissionLevel);
      await reloadPermissionData();
      setNotice("协作者权限已更新");
    } catch {
      setNotice("更新协作者权限失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePermission = async (permissionId: string) => {
    if (saving) return;
    if (!window.confirm("确认删除这个协作者权限吗？")) return;
    setSaving(true);
    setNotice("");
    try {
      await deleteDocumentPermission(documentId, permissionId);
      await reloadPermissionData();
      setNotice("协作者权限已删除");
    } catch {
      setNotice("删除协作者权限失败");
    } finally {
      setSaving(false);
    }
  };

  const handleTransferOwner = async () => {
    if (saving) return;
    const nextOwnerId = transferOwnerId.trim();
    if (!nextOwnerId) {
      setNotice("请先选择新所有者");
      return;
    }
    if (!window.confirm("确认转移文档所有权吗？转移后你可能不再拥有最高权限。")) return;
    setSaving(true);
    setNotice("");
    try {
      await transferDocumentOwner(documentId, nextOwnerId);
      setTransferOwnerId("");
      setTransferOwnerQuery("");
      await reloadPermissionData();
      setNotice("所有者已转移");
    } catch {
      setNotice("所有者转移失败，请确认成员和权限");
    } finally {
      setSaving(false);
    }
  };

  const renderMemberMeta = (userId: string) => {
    const member = memberMap.get(userId);
    if (!member) {
      return (
        <>
          <div className="truncate font-medium text-slate-800">{userId}</div>
          <div className="text-xs text-slate-400">未知成员 · user</div>
        </>
      );
    }
    return (
      <>
        <div className="truncate font-medium text-slate-800">{member.name}</div>
        <div className="truncate text-xs text-slate-400">{member.email} · {member.userId}</div>
      </>
    );
  };

  const updateLocalPermissionSetting = <K extends keyof DocumentPermissionSettings>(key: K, value: DocumentPermissionSettings[K]) => {
    setPermissionSettings((current) => (current ? { ...current, [key]: value } : current));
  };

  const handleRotate = async () => {
    if (saving) return;
    setSaving(true);
    setNotice("");
    try {
      const nextShare = await rotateDocumentShare(documentId);
      setShare(nextShare);
      setEnabled(Boolean(nextShare.isEnabled));
      setNotice("分享链接已重新生成");
    } catch {
      setNotice("重新生成链接失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDisableShare = async () => {
    if (saving) return;
    setSaving(true);
    setNotice("");
    try {
      const nextShare = await disableDocumentShare(documentId);
      setShare(nextShare);
      setEnabled(false);
      setPassword("");
      setNotice("分享已关闭");
      onSaved({ visibility, share: null });
    } catch {
      setNotice("关闭分享失败");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!resolvedShareUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(resolvedShareUrl);
      setNotice("分享链接已复制");
    } catch {
      setNotice("复制分享链接失败");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/18 px-4">
      <div className="max-h-[86vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">权限与分享</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              配置文档可见性，以及独立的只读分享访问方式。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600"
          >
            关闭
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 border-b border-slate-100 pb-3">
          {[
            ["visibility", "可见性"],
            ["members", "协作者"],
            ["share", "分享链接"],
            ["security", "安全设置"],
            ["integrations", "开放接入"],
            ["audit", "操作记录"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value as typeof activeTab)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                activeTab === value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-5">
          {activeTab === "visibility" ? <section className="space-y-2.5">
            <div className="text-sm font-medium text-slate-900">文档可见性</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "private" as const, label: "私有文档", desc: "只有作者和授权用户可访问原文档链接" },
                { value: "public" as const, label: "公开文档", desc: "任何人都可以访问原文档链接" },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setVisibility(item.value)}
                  className={`rounded-lg border px-3 py-3 text-left ${
                    visibility === item.value
                      ? "border-sky-300 bg-sky-50 text-sky-700"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">{item.desc}</div>
                </button>
              ))}
            </div>
          </section> : null}

          {activeTab === "members" ? (
            <section className="space-y-3">
              <div>
                <div className="text-sm font-medium text-slate-900">协作者</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">按姓名、邮箱或用户 ID 搜索当前组织成员，点选后添加协作者。</p>
              </div>
              <div className="space-y-2 rounded-lg border border-slate-100 p-3">
                <div className="grid gap-2 md:grid-cols-[1fr_150px_auto]">
                  <input
                    value={newSubjectQuery}
                    onChange={(event) => {
                      setNewSubjectQuery(event.target.value);
                      if (!event.target.value.trim()) {
                        setNewSubjectId("");
                      }
                    }}
                    placeholder="搜索成员：姓名 / 邮箱 / 用户 ID"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
                  />
                  <select
                    value={newPermissionLevel}
                    onChange={(event) => setNewPermissionLevel(event.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
                  >
                    <option value="view">可查看</option>
                    <option value="comment">可评论</option>
                    <option value="edit">可编辑</option>
                    <option value="full_access">可管理</option>
                  </select>
                  <button
                    type="button"
                    disabled={saving || !newSubjectId.trim()}
                    onClick={() => void handleAddPermission()}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
                  >
                    添加
                  </button>
                </div>
                {selectedNewSubject ? (
                  <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-700">
                    已选择：{selectedNewSubject.name} · {selectedNewSubject.email}
                  </div>
                ) : null}
                <div className="grid gap-2 md:grid-cols-2">
                  {selectableCollaborators.map((candidate) => (
                    <button
                      key={candidate.userId}
                      type="button"
                      onClick={() => {
                        setNewSubjectId(candidate.userId);
                        setNewSubjectQuery(candidate.name);
                      }}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                        newSubjectId === candidate.userId
                          ? "border-sky-300 bg-sky-50 text-sky-700"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <div className="truncate font-medium">{candidate.name}</div>
                      <div className="truncate text-xs text-slate-400">{candidate.email}</div>
                    </button>
                  ))}
                </div>
                {!selectableCollaborators.length ? (
                  <div className="text-xs text-slate-400">未找到可添加的成员。</div>
                ) : null}
              </div>
              <div className="space-y-2">
                {permissionMembers.length === 0 ? (
                  <div className="rounded-lg border border-slate-100 px-3 py-3 text-sm text-slate-500">暂无显式协作者。</div>
                ) : permissionMembers.map((member) => (
                  <div key={member.id} className="grid gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm md:grid-cols-[1fr_150px_auto]">
                    <div className="min-w-0">{renderMemberMeta(member.subjectId)}</div>
                    <select
                      value={member.permissionLevel}
                      disabled={saving}
                      onChange={(event) => void handleUpdatePermission(member.id, event.target.value)}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-sm disabled:opacity-60"
                    >
                      <option value="view">可查看</option>
                      <option value="comment">可评论</option>
                      <option value="edit">可编辑</option>
                      <option value="full_access">可管理</option>
                    </select>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleDeletePermission(member.id)}
                      className="rounded-lg border border-rose-200 px-3 py-1 text-sm text-rose-600 disabled:opacity-60"
                    >
                      {saving ? "处理中..." : "删除"}
                    </button>
                  </div>
                ))}
              </div>
              {canTransferOwner ? (
                <div className="rounded-lg border border-amber-100 bg-amber-50/40 p-3">
                  <div className="text-sm font-medium text-slate-900">转移所有者</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    搜索并选择新所有者，确认后会写入权限审计记录。
                  </p>
                  <div className="mt-3 space-y-2">
                    <input
                      value={transferOwnerQuery}
                      onChange={(event) => {
                        setTransferOwnerQuery(event.target.value);
                        if (!event.target.value.trim()) {
                          setTransferOwnerId("");
                        }
                      }}
                      placeholder="搜索成员：姓名 / 邮箱 / 用户 ID"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                    />
                    {selectedTransferOwner ? (
                      <div className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-amber-700">
                        已选择：{selectedTransferOwner.name} · {selectedTransferOwner.email}
                      </div>
                    ) : null}
                    <div className="grid gap-2 md:grid-cols-2">
                      {transferableOwners.map((candidate) => (
                        <button
                          key={candidate.userId}
                          type="button"
                          onClick={() => {
                            setTransferOwnerId(candidate.userId);
                            setTransferOwnerQuery(candidate.name);
                          }}
                          className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                            transferOwnerId === candidate.userId
                              ? "border-amber-300 bg-amber-50 text-amber-800"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                          }`}
                        >
                          <div className="truncate font-medium">{candidate.name}</div>
                          <div className="truncate text-xs text-slate-400">{candidate.email}</div>
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={saving || !transferOwnerId.trim()}
                        onClick={() => void handleTransferOwner()}
                        className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-amber-700 disabled:opacity-60"
                      >
                        转移
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {activeTab === "share" ? <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-900">独立分享链接</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">
                  分享页复用同一套阅读组件，但强制只读，不允许编辑。
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                启用分享
              </label>
            </div>

            <div className={`space-y-3 rounded-lg border border-slate-200 p-4 ${enabled ? "bg-slate-50/60" : "bg-slate-50/30 opacity-65"}`}>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1.5">
                  <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">过期时间</div>
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    disabled={!enabled}
                    onChange={(event) => setExpiresAt(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
                  />
                </label>
                <label className="space-y-1.5">
                  <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">分享密码</div>
                  <input
                    type="text"
                    value={password}
                    disabled={!enabled}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={share?.requiresPassword ? "保持为空表示沿用当前密码" : "可选，留空则不设密码"}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={allowCopy}
                    disabled={!enabled}
                    onChange={(event) => setAllowCopy(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  允许复制内容
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={allowExport}
                    disabled={!enabled}
                    onChange={(event) => setAllowExport(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  允许导出
                </label>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600">
                {loading ? (
                  "正在加载分享设置..."
                ) : resolvedShareUrl ? (
                  <div className="space-y-2">
                    <div className="break-all font-medium text-slate-800">{resolvedShareUrl}</div>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>访问次数 {share?.accessCount ?? 0}</span>
                      {share?.lastAccessedAt ? <span>最近访问 {new Date(share.lastAccessedAt).toLocaleString("zh-CN")}</span> : null}
                      {share?.requiresPassword ? <span>已启用密码</span> : <span>未设密码</span>}
                    </div>
                  </div>
                ) : (
                  "保存后会生成独立分享链接。"
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!resolvedShareUrl || saving}
                  onClick={handleCopyShareLink}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:opacity-60"
                >
                  复制分享链接
                </button>
                <button
                  type="button"
                  disabled={!share?.token || !enabled || saving}
                  onClick={handleRotate}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:opacity-60"
                >
                  重新生成链接
                </button>
                <button
                  type="button"
                  disabled={!share?.token || saving}
                  onClick={handleDisableShare}
                  className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm text-rose-600 disabled:opacity-60"
                >
                  关闭分享
                </button>
              </div>
            </div>
          </section> : null}

          {activeTab === "security" && permissionSettings ? (
            <section className="grid gap-3 md:grid-cols-2">
              {[
                ["commentScope", "谁可以评论", [["disabled", "禁止评论"], ["can_view", "可查看者"], ["can_edit", "可编辑者"]]],
                ["shareCollaboratorScope", "谁可以管理协作者", [["owner", "所有者"], ["full_access", "可管理者"], ["edit", "可编辑者"]]],
                ["copyScope", "谁可以复制", [["disabled", "禁止"], ["can_view", "可查看者"], ["can_edit", "可编辑者"], ["full_access", "可管理者"]]],
                ["exportScope", "谁可以导出", [["disabled", "禁止"], ["can_view", "可查看者"], ["can_edit", "可编辑者"], ["full_access", "可管理者"]]],
                ["downloadScope", "谁可以下载", [["disabled", "禁止"], ["can_view", "可查看者"], ["can_edit", "可编辑者"], ["full_access", "可管理者"]]],
                ["printScope", "谁可以打印", [["disabled", "禁止"], ["can_view", "可查看者"], ["can_edit", "可编辑者"], ["full_access", "可管理者"]]],
              ].map(([key, label, options]) => (
                <label key={key as string} className="space-y-1.5">
                  <div className="text-sm font-medium text-slate-700">{label as string}</div>
                  <select
                    value={permissionSettings[key as keyof DocumentPermissionSettings] as string}
                    onChange={(event) => updateLocalPermissionSetting(key as keyof DocumentPermissionSettings, event.target.value as never)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    {(options as string[][]).map(([value, optionLabel]) => (
                      <option key={value} value={value}>{optionLabel}</option>
                    ))}
                  </select>
                </label>
              ))}
              <label className="flex items-center gap-2 rounded-lg border border-slate-100 p-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={permissionSettings.externalAccessEnabled}
                  onChange={(event) => updateLocalPermissionSetting("externalAccessEnabled", event.target.checked)}
                />
                允许组织外访问
              </label>
            </section>
          ) : null}

          {activeTab === "integrations" ? (
            <section className="space-y-3">
              <div>
                <div className="text-sm font-medium text-slate-900">可访问当前文档的开放接入</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  这里展示已经通过 Integration 作用域授权到当前文档的接入方。增删授权范围在个人设置页完成。
                </p>
              </div>
              {documentIntegrations.length === 0 ? (
                <div className="rounded-lg border border-slate-100 px-3 py-3 text-sm text-slate-500">
                  当前没有 Integration 可访问这篇文档。
                </div>
              ) : (
                <div className="space-y-2">
                  {documentIntegrations.map((integration) => (
                    <div key={integration.integrationId} className="rounded-lg border border-slate-100 px-3 py-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-800">{integration.integrationName}</div>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                            <span>状态 {integration.integrationStatus}</span>
                            <span>来源 {integration.accessSource}</span>
                            <span>权限 {integration.permissionLevel}</span>
                            <span>{integration.canWrite ? "可写入" : "只读"}</span>
                          </div>
                        </div>
                        <div className="text-xs text-slate-400">
                          {integration.recentAccessAt
                            ? `最近访问 ${new Date(integration.recentAccessAt).toLocaleString("zh-CN")}`
                            : "暂无访问记录"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {activeTab === "audit" ? (
            <section className="space-y-2">
              {auditLogs.length === 0 ? (
                <div className="rounded-lg border border-slate-100 px-3 py-3 text-sm text-slate-500">暂无权限操作记录。</div>
              ) : auditLogs.map((log) => (
                <div key={log.id} className="rounded-lg border border-slate-100 px-3 py-2 text-sm">
                  <div className="font-medium text-slate-800">{log.action}</div>
                  <div className="mt-1 text-xs text-slate-500">{new Date(log.createdAt).toLocaleString("zh-CN")} · {log.actorType}</div>
                </div>
              ))}
            </section>
          ) : null}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="text-sm text-slate-500">{notice}</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 disabled:opacity-70"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-70"
            >
              {saving ? "保存中..." : "保存设置"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
