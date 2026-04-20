"use client";

import { useState, useTransition } from "react";

import {
  createIntegration,
  createIntegrationScope,
  createIntegrationToken,
  createIntegrationWebhook,
  deleteIntegrationWebhook,
  deleteIntegrationScope,
  fetchIntegrationAuditLogs,
  fetchIntegrationScopes,
  fetchIntegrationWebhookDeliveries,
  fetchIntegrations,
  fetchIntegrationTokens,
  fetchIntegrationWebhooks,
  fetchSpaces,
  fetchSpaceTree,
  fetchTokenAuditLogs,
  revokeIntegrationToken,
  retryIntegrationWebhookDelivery,
  type DocumentTreeOpenMode,
  type IntegrationAuditLogSummary,
  type IntegrationScopeSummary,
  type IntegrationSummary,
  type IntegrationTokenSummary,
  type IntegrationWebhookSummary,
  type IntegrationWebhookDeliverySummary,
  type SpaceSummary,
  type TreeNode,
  type UserPreference,
  updateIntegrationWebhook,
  updateUserPreference,
} from "@/lib/api";

const DEFAULT_AI_SCOPES = ["documents:read", "folders:read", "comments:read", "search:read"];
const DEFAULT_WEBHOOK_EVENTS = ["document.created", "document.updated", "document.deleted"];

function flattenScopeTargets(nodes: TreeNode[]): Array<{ key: string; label: string; resourceType: string; resourceId: string; includeChildren: boolean }> {
  const result: Array<{ key: string; label: string; resourceType: string; resourceId: string; includeChildren: boolean }> = [];
  const walk = (items: TreeNode[], prefix = "") => {
    for (const item of items) {
      const label = prefix ? `${prefix} / ${item.title}` : item.title;
      result.push({
        key: `${item.nodeType}:${item.id}`,
        label,
        resourceType: item.nodeType,
        resourceId: item.id,
        includeChildren: item.nodeType === "folder",
      });
      if (item.children.length > 0) {
        walk(item.children, label);
      }
    }
  };
  walk(nodes);
  return result;
}

export function PersonalSettingsForm({
  preference,
}: {
  preference: UserPreference | null;
}) {
  const [documentTreeOpenMode, setDocumentTreeOpenMode] = useState<DocumentTreeOpenMode>(
    preference?.documentTreeOpenMode ?? "same-page",
  );
  const [notice, setNotice] = useState("");
  const [tokenName, setTokenName] = useState("个人 AI Token");
  const [newToken, setNewToken] = useState("");
  const [tokens, setTokens] = useState<IntegrationTokenSummary[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationSummary[]>([]);
  const [integrationName, setIntegrationName] = useState("AI Integration");
  const [spaces, setSpaces] = useState<SpaceSummary[]>([]);
  const [scopeTargets, setScopeTargets] = useState<Array<{ key: string; label: string; resourceType: string; resourceId: string; includeChildren: boolean }>>([]);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState("");
  const [selectedSpaceId, setSelectedSpaceId] = useState("");
  const [selectedScopeTarget, setSelectedScopeTarget] = useState("public_documents");
  const [scopePermissionLevel, setScopePermissionLevel] = useState("view");
  const [integrationScopes, setIntegrationScopes] = useState<IntegrationScopeSummary[]>([]);
  const [selectedAuditKind, setSelectedAuditKind] = useState<"integration" | "token">("integration");
  const [selectedAuditTargetId, setSelectedAuditTargetId] = useState("");
  const [auditLogs, setAuditLogs] = useState<IntegrationAuditLogSummary[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [newWebhookSecret, setNewWebhookSecret] = useState("");
  const [webhooks, setWebhooks] = useState<IntegrationWebhookSummary[]>([]);
  const [selectedWebhookId, setSelectedWebhookId] = useState("");
  const [webhookDeliveries, setWebhookDeliveries] = useState<IntegrationWebhookDeliverySummary[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isLoadingOpenAccess, setIsLoadingOpenAccess] = useState(false);

  const loadOpenAccess = () => {
    setIsLoadingOpenAccess(true);
    startTransition(async () => {
      try {
        const [tokenResult, integrationResult] = await Promise.all([fetchIntegrationTokens(), fetchIntegrations()]);
        setTokens(tokenResult.data);
        setIntegrations(integrationResult.data);
        if (integrationResult.data[0] && !selectedIntegrationId) {
          setSelectedIntegrationId(integrationResult.data[0].id);
        }
        if (integrationResult.data[0]) {
          const { data: webhooksResult } = await fetchIntegrationWebhooks(integrationResult.data[0].id);
          setWebhooks(webhooksResult);
          setSelectedWebhookId(webhooksResult[0]?.id ?? "");
        }
        if (!selectedAuditTargetId) {
          setSelectedAuditTargetId(integrationResult.data[0]?.id ?? tokenResult.data[0]?.id ?? "");
          setSelectedAuditKind(integrationResult.data[0] ? "integration" : "token");
        }
      } finally {
        setIsLoadingOpenAccess(false);
      }
    });
  };

  const loadScopeTargets = () => {
    startTransition(async () => {
      try {
        const { data: fetchedSpaces } = await fetchSpaces();
        setSpaces(fetchedSpaces);
        const nextSpaceId = selectedSpaceId || fetchedSpaces[0]?.id || "";
        setSelectedSpaceId(nextSpaceId);
        if (nextSpaceId) {
          const { data: tree } = await fetchSpaceTree(nextSpaceId);
          setScopeTargets(flattenScopeTargets(tree));
        }
        if (selectedIntegrationId) {
          const [scopesResult, webhooksResult] = await Promise.all([
            fetchIntegrationScopes(selectedIntegrationId),
            fetchIntegrationWebhooks(selectedIntegrationId),
          ]);
          setIntegrationScopes(scopesResult.data);
          setWebhooks(webhooksResult.data);
        }
      } catch {
        setNotice("加载授权范围失败");
      }
    });
  };

  const handleSpaceChange = (spaceId: string) => {
    setSelectedSpaceId(spaceId);
    startTransition(async () => {
      const { data: tree } = await fetchSpaceTree(spaceId);
      setScopeTargets(flattenScopeTargets(tree));
      setSelectedScopeTarget("space");
    });
  };

  const savePreference = () => {
    startTransition(async () => {
      try {
        setNotice("");
        await updateUserPreference({ documentTreeOpenMode });
        setNotice("个人配置已保存");
      } catch {
        setNotice("保存失败，请确认后端服务可用并且当前已登录");
      }
    });
  };

  const handleCreateToken = () => {
    startTransition(async () => {
      try {
        setNotice("");
        setNewToken("");
        const result = await createIntegrationToken({ name: tokenName.trim() || "个人 AI Token", scopes: DEFAULT_AI_SCOPES });
        setNewToken(result.token);
        setTokens((current) => [result.tokenSummary, ...current]);
        setNotice("Token 已创建，明文只显示一次");
      } catch {
        setNotice("创建 Token 失败");
      }
    });
  };

  const handleRevokeToken = (tokenId: string) => {
    startTransition(async () => {
      try {
        await revokeIntegrationToken(tokenId);
        setTokens((current) =>
          current.map((item) => (item.id === tokenId ? { ...item, revokedAt: new Date().toISOString() } : item)),
        );
        setNotice("Token 已禁用");
      } catch {
        setNotice("禁用 Token 失败");
      }
    });
  };

  const handleCreateIntegration = () => {
    startTransition(async () => {
      try {
        const integration = await createIntegration({ name: integrationName.trim() || "AI Integration" });
        setIntegrations((current) => [integration, ...current]);
        setSelectedIntegrationId(integration.id);
        setNotice("Integration 已创建，默认没有任何文档授权");
      } catch {
        setNotice("创建 Integration 失败");
      }
    });
  };

  const handleIntegrationChange = (integrationId: string) => {
    setSelectedIntegrationId(integrationId);
    startTransition(async () => {
      const [scopesResult, webhooksResult] = await Promise.all([
        fetchIntegrationScopes(integrationId),
        fetchIntegrationWebhooks(integrationId),
      ]);
      setIntegrationScopes(scopesResult.data);
      setWebhooks(webhooksResult.data);
      setSelectedWebhookId(webhooksResult.data[0]?.id ?? "");
      setWebhookDeliveries([]);
    });
  };

  const handleCreateScope = () => {
    if (!selectedIntegrationId) {
      setNotice("请先选择 Integration");
      return;
    }
    startTransition(async () => {
      try {
        const target = scopeTargets.find((item) => item.key === selectedScopeTarget);
        const payload =
          selectedScopeTarget === "public_documents"
            ? { resourceType: "public_documents", resourceId: undefined, includeChildren: false }
            : selectedScopeTarget === "space"
              ? { resourceType: "space", resourceId: selectedSpaceId, includeChildren: true }
              : {
                  resourceType: target?.resourceType ?? "space",
                  resourceId: target?.resourceId ?? selectedSpaceId,
                  includeChildren: target?.includeChildren ?? true,
                };
        const scope = await createIntegrationScope({
          integrationId: selectedIntegrationId,
          ...payload,
          permissionLevel: scopePermissionLevel,
        });
        setIntegrationScopes((current) => [scope, ...current]);
        setNotice("授权范围已添加");
      } catch {
        setNotice("添加授权范围失败");
      }
    });
  };

  const handleDeleteScope = (scopeId: string) => {
    if (!selectedIntegrationId) return;
    startTransition(async () => {
      try {
        await deleteIntegrationScope(selectedIntegrationId, scopeId);
        setIntegrationScopes((current) => current.filter((item) => item.id !== scopeId));
        setNotice("授权范围已移除");
      } catch {
        setNotice("移除授权范围失败");
      }
    });
  };

  const handleLoadAuditLogs = () => {
    if (!selectedAuditTargetId) {
      setNotice("请先选择要查看日志的 Token 或 Integration");
      return;
    }
    startTransition(async () => {
      try {
        const result =
          selectedAuditKind === "integration"
            ? await fetchIntegrationAuditLogs(selectedAuditTargetId)
            : await fetchTokenAuditLogs(selectedAuditTargetId);
        setAuditLogs(result.data);
        setNotice("审计日志已加载");
      } catch {
        setNotice("加载审计日志失败");
      }
    });
  };

  const handleCreateWebhook = () => {
    if (!selectedIntegrationId || !webhookUrl.trim()) {
      setNotice("请先选择 Integration 并填写 Webhook URL");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createIntegrationWebhook({
          integrationId: selectedIntegrationId,
          url: webhookUrl.trim(),
          eventTypes: DEFAULT_WEBHOOK_EVENTS,
        });
        setWebhooks((current) => [result.webhook, ...current]);
        setSelectedWebhookId(result.webhook.id);
        setWebhookUrl("");
        setNewWebhookSecret(result.secret);
        setNotice("Webhook 已创建，secret 仅显示一次");
      } catch {
        setNotice("创建 Webhook 失败");
      }
    });
  };

  const handleToggleWebhook = (webhook: IntegrationWebhookSummary) => {
    if (!selectedIntegrationId) {
      return;
    }
    startTransition(async () => {
      try {
        const updated = await updateIntegrationWebhook({
          integrationId: selectedIntegrationId,
          webhookId: webhook.id,
          status: webhook.status === "active" ? "disabled" : "active",
        });
        setWebhooks((current) => current.map((item) => (item.id === webhook.id ? updated : item)));
        setSelectedWebhookId(updated.id);
        setNotice(updated.status === "active" ? "Webhook 已启用" : "Webhook 已禁用");
      } catch {
        setNotice("更新 Webhook 状态失败");
      }
    });
  };

  const handleDeleteWebhook = (webhookId: string) => {
    if (!selectedIntegrationId) {
      return;
    }
    if (!window.confirm("确认删除这个 Webhook 吗？删除后服务端将不再接收该 endpoint 的事件。")) {
      return;
    }
    startTransition(async () => {
      try {
        await deleteIntegrationWebhook(selectedIntegrationId, webhookId);
        setWebhooks((current) => {
          const next = current.filter((item) => item.id !== webhookId);
          setSelectedWebhookId(next[0]?.id ?? "");
          return next;
        });
        setWebhookDeliveries([]);
        setNotice("Webhook 已删除");
      } catch {
        setNotice("删除 Webhook 失败");
      }
    });
  };

  const handleLoadWebhookDeliveries = () => {
    if (!selectedIntegrationId || !selectedWebhookId) {
      setNotice("请先选择一个 Webhook");
      return;
    }
    startTransition(async () => {
      try {
        const result = await fetchIntegrationWebhookDeliveries(selectedIntegrationId, selectedWebhookId);
        setWebhookDeliveries(result.data);
        setNotice("Webhook 投递日志已加载");
      } catch {
        setNotice("加载 Webhook 投递日志失败");
      }
    });
  };

  const handleRetryWebhookDelivery = (deliveryId: string) => {
    if (!selectedIntegrationId || !selectedWebhookId) {
      setNotice("请先选择 Webhook");
      return;
    }
    startTransition(async () => {
      try {
        const retried = await retryIntegrationWebhookDelivery({
          integrationId: selectedIntegrationId,
          webhookId: selectedWebhookId,
          deliveryId,
        });
        setWebhookDeliveries((current) => [retried, ...current]);
        setNotice("Webhook 投递已重新触发");
      } catch {
        setNotice("重试 Webhook 投递失败");
      }
    });
  };

  return (
    <section className="space-y-3">
      <div className="border border-slate-200 bg-white px-5 py-4 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-accent">Personal Settings</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">个人配置</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            这里保存个人使用习惯，配置会写入后端并跟随账号生效。
          </p>
        </div>
      </div>

      <div className="mt-4 max-w-2xl border border-slate-200 p-3">
        <div className="text-base font-semibold text-slate-900">文件树打开方式</div>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          控制从左侧文档树点击文档时，是在当前页面打开，还是打开新的浏览器标签/窗口。
        </p>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          <label
            className={`cursor-pointer border px-3 py-2.5 transition ${
              documentTreeOpenMode === "same-page" ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"
            }`}
          >
            <input
              type="radio"
              name="documentTreeOpenMode"
              value="same-page"
              checked={documentTreeOpenMode === "same-page"}
              onChange={() => setDocumentTreeOpenMode("same-page")}
              className="sr-only"
            />
            <div className="text-sm font-medium text-slate-900">本页打开</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">适合连续浏览同一目录下的文档。</div>
          </label>
          <label
            className={`cursor-pointer border px-3 py-2.5 transition ${
              documentTreeOpenMode === "new-window" ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"
            }`}
          >
            <input
              type="radio"
              name="documentTreeOpenMode"
              value="new-window"
              checked={documentTreeOpenMode === "new-window"}
              onChange={() => setDocumentTreeOpenMode("new-window")}
              className="sr-only"
            />
            <div className="text-sm font-medium text-slate-900">新窗口打开</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">适合保留目录页，同时并行查看多个文档。</div>
          </label>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={savePreference}
          disabled={isPending}
          className="bg-accent px-4 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "保存中..." : "保存配置"}
        </button>
        {notice ? <div className="text-sm text-slate-600">{notice}</div> : null}
      </div>

      <div className="mt-5 border-t border-slate-200 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-slate-900">AI 与开放接入</div>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              管理给 AI 工具和外部自动化使用的访问凭证。Token 明文只在创建后显示一次。
            </p>
          </div>
          <button
            type="button"
            onClick={loadOpenAccess}
            disabled={isLoadingOpenAccess || isPending}
            className="border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-60"
          >
            {isLoadingOpenAccess ? "加载中..." : "加载开放接入"}
          </button>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="border border-slate-200 p-3">
            <div className="text-sm font-semibold text-slate-900">Personal Access Token</div>
            <div className="mt-2 flex gap-2">
              <input
                value={tokenName}
                onChange={(event) => setTokenName(event.target.value)}
                className="min-w-0 flex-1 border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="Token 名称"
              />
              <button
                type="button"
                onClick={handleCreateToken}
                disabled={isPending}
                className="bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
              >
                创建
              </button>
            </div>
            {newToken ? (
              <div className="mt-2 border border-amber-300 bg-amber-50 p-2 text-xs leading-5 text-amber-900">
                <div className="font-semibold">请立即复制，刷新后不再显示：</div>
                <code className="mt-1 block break-all">{newToken}</code>
              </div>
            ) : null}
            <div className="mt-3 space-y-1.5">
              {tokens.length === 0 ? (
                <div className="text-sm text-slate-500">暂无 Token。点击“加载开放接入”查看已有配置。</div>
              ) : (
                tokens.map((token) => (
                  <div key={token.id} className="flex items-center justify-between border border-slate-200 px-2 py-1.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900">{token.name}</div>
                      <div className="text-xs text-slate-500">
                        {token.tokenPrefix} · {token.revokedAt ? "已禁用" : "可用"} · {token.scopes.join(", ")}
                      </div>
                    </div>
                    {!token.revokedAt ? (
                      <button
                        type="button"
                        onClick={() => handleRevokeToken(token.id)}
                        disabled={isPending}
                        className="border border-red-200 px-2 py-1 text-xs font-medium text-red-600 disabled:opacity-60"
                      >
                        禁用
                      </button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="border border-slate-200 p-3">
            <div className="text-sm font-semibold text-slate-900">Integration</div>
            <p className="mt-1 text-xs leading-5 text-slate-500">Integration 默认无任何文档授权，需要后续在授权范围中显式添加。</p>
            <div className="mt-2 flex gap-2">
              <input
                value={integrationName}
                onChange={(event) => setIntegrationName(event.target.value)}
                className="min-w-0 flex-1 border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="Integration 名称"
              />
              <button
                type="button"
                onClick={handleCreateIntegration}
                disabled={isPending}
                className="bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
              >
                创建
              </button>
            </div>
            <div className="mt-3 space-y-1.5">
              {integrations.length === 0 ? (
                <div className="text-sm text-slate-500">暂无 Integration。</div>
              ) : (
                integrations.map((integration) => (
                  <div key={integration.id} className="border border-slate-200 px-2 py-1.5">
                    <div className="text-sm font-medium text-slate-900">{integration.name}</div>
                    <div className="text-xs text-slate-500">
                      {integration.status} · client_id: {integration.clientId}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 border border-slate-200 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Integration 授权范围</div>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Integration 默认无权限。这里显式授权公开文档、空间、文件夹或文档，并选择只读或可编辑。
              </p>
            </div>
            <button
              type="button"
              onClick={loadScopeTargets}
              disabled={isPending}
              className="border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-60"
            >
              加载授权数据
            </button>
          </div>

          <div className="mt-3 grid gap-2 lg:grid-cols-4">
            <label className="text-xs font-medium text-slate-600">
              Integration
              <select
                value={selectedIntegrationId}
                onChange={(event) => handleIntegrationChange(event.target.value)}
                className="mt-1 w-full border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">请选择</option>
                {integrations.map((integration) => (
                  <option key={integration.id} value={integration.id}>
                    {integration.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              空间
              <select
                value={selectedSpaceId}
                onChange={(event) => handleSpaceChange(event.target.value)}
                className="mt-1 w-full border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">请选择</option>
                {spaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              资源
              <select
                value={selectedScopeTarget}
                onChange={(event) => setSelectedScopeTarget(event.target.value)}
                className="mt-1 w-full border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="public_documents">公开文档</option>
                <option value="space">当前空间</option>
                {scopeTargets.map((target) => (
                  <option key={target.key} value={target.key}>
                    {target.resourceType === "folder" ? "文件夹" : "文档"} · {target.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              权限
              <select
                value={scopePermissionLevel}
                onChange={(event) => setScopePermissionLevel(event.target.value)}
                className="mt-1 w-full border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="view">只读</option>
                <option value="edit">可编辑</option>
              </select>
            </label>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreateScope}
              disabled={isPending || !selectedIntegrationId}
              className="bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              添加授权范围
            </button>
            {scopePermissionLevel === "edit" ? (
              <span className="text-xs text-amber-700">可编辑授权会允许 AI 修改授权范围内的文档。</span>
            ) : null}
          </div>

          <div className="mt-3 space-y-1.5">
            {integrationScopes.length === 0 ? (
              <div className="text-sm text-slate-500">当前 Integration 暂无授权范围。</div>
            ) : (
              integrationScopes.map((scope) => (
                <div key={scope.id} className="flex items-center justify-between border border-slate-200 px-2 py-1.5">
                  <div className="text-sm text-slate-700">
                    {scope.resourceType} · {scope.resourceId ?? "all-public"} · {scope.permissionLevel}
                    {scope.includeChildren ? " · 含子级" : ""}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteScope(scope.id)}
                    disabled={isPending}
                    className="border border-red-200 px-2 py-1 text-xs font-medium text-red-600 disabled:opacity-60"
                  >
                    移除
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-3 border border-slate-200 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Webhook Endpoint</div>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                为 Integration 配置服务端事件回调地址。当前先提供创建、启停、删除和一次性 secret 返回，后续再接签名投递与重试。
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={webhookUrl}
              onChange={(event) => setWebhookUrl(event.target.value)}
              className="min-w-0 flex-1 border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="https://example.com/webhooks/clouddoc"
            />
            <button
              type="button"
              onClick={handleCreateWebhook}
              disabled={isPending || !selectedIntegrationId}
              className="bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              创建 Webhook
            </button>
          </div>
          {newWebhookSecret ? (
            <div className="mt-2 border border-amber-300 bg-amber-50 p-2 text-xs leading-5 text-amber-900">
              <div className="font-semibold">Webhook Secret 仅显示一次：</div>
              <code className="mt-1 block break-all">{newWebhookSecret}</code>
            </div>
          ) : null}
          <div className="mt-3 space-y-1.5">
            {webhooks.length === 0 ? (
              <div className="text-sm text-slate-500">当前 Integration 暂无 Webhook endpoint。</div>
            ) : (
              webhooks.map((webhook) => (
                <div key={webhook.id} className="border border-slate-200 px-2 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900">{webhook.url}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {webhook.status} · {webhook.eventTypes.join(", ")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleWebhook(webhook)}
                        disabled={isPending}
                        className="border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-60"
                      >
                        {webhook.status === "active" ? "禁用" : "启用"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteWebhook(webhook.id)}
                        disabled={isPending}
                        className="border border-red-200 px-2 py-1 text-xs font-medium text-red-600 disabled:opacity-60"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-3 border-t border-slate-200 pt-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-900">投递日志</div>
              <button
                type="button"
                onClick={handleLoadWebhookDeliveries}
                disabled={isPending || !selectedWebhookId}
                className="border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-60"
              >
                加载投递日志
              </button>
            </div>
            <div className="mt-2">
              <select
                value={selectedWebhookId}
                onChange={(event) => {
                  setSelectedWebhookId(event.target.value);
                  setWebhookDeliveries([]);
                }}
                className="w-full border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">请选择 Webhook</option>
                {webhooks.map((webhook) => (
                  <option key={webhook.id} value={webhook.id}>
                    {webhook.url}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 space-y-1.5">
              {webhookDeliveries.length === 0 ? (
                <div className="text-sm text-slate-500">暂无投递日志，或尚未加载。</div>
              ) : (
                webhookDeliveries.map((delivery) => (
                  <div key={delivery.id} className="border border-slate-200 px-2 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium text-slate-900">
                        {delivery.eventType} · {delivery.responseStatus ?? "pending"}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-slate-400">{new Date(delivery.createdAt).toLocaleString("zh-CN")}</div>
                        <button
                          type="button"
                          onClick={() => handleRetryWebhookDelivery(delivery.id)}
                          disabled={isPending}
                          className="border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-60"
                        >
                          重放
                        </button>
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span>尝试 {delivery.attemptCount}</span>
                      {delivery.deliveredAt ? <span>成功 {new Date(delivery.deliveredAt).toLocaleString("zh-CN")}</span> : null}
                      {delivery.nextRetryAt ? <span>下次重试 {new Date(delivery.nextRetryAt).toLocaleString("zh-CN")}</span> : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 border border-slate-200 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">开放平台审计日志</div>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                查看 Token 或 Integration 最近的开放接口 / MCP 访问记录，定位谁在读写、读写了什么、是否成功。
              </p>
            </div>
            <button
              type="button"
              onClick={handleLoadAuditLogs}
              disabled={isPending || !selectedAuditTargetId}
              className="border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-60"
            >
              加载日志
            </button>
          </div>

          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            <label className="text-xs font-medium text-slate-600">
              类型
              <select
                value={selectedAuditKind}
                onChange={(event) => {
                  const nextKind = event.target.value as "integration" | "token";
                  setSelectedAuditKind(nextKind);
                  setSelectedAuditTargetId(nextKind === "integration" ? integrations[0]?.id ?? "" : tokens[0]?.id ?? "");
                  setAuditLogs([]);
                }}
                className="mt-1 w-full border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="integration">Integration</option>
                <option value="token">Token</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              对象
              <select
                value={selectedAuditTargetId}
                onChange={(event) => setSelectedAuditTargetId(event.target.value)}
                className="mt-1 w-full border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">请选择</option>
                {(selectedAuditKind === "integration" ? integrations : tokens).map((item) => (
                  <option key={item.id} value={item.id}>
                    {"clientId" in item ? item.name : `${item.name} (${item.tokenPrefix})`}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 space-y-1.5">
            {auditLogs.length === 0 ? (
              <div className="text-sm text-slate-500">暂无审计日志，或尚未加载。</div>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="border border-slate-200 px-2 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium text-slate-900">
                      {log.operation} · {log.responseStatus}
                    </div>
                    <div className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString("zh-CN")}</div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>来源 {log.source}</span>
                    <span>目标 {log.targetType ?? "unknown"} / {log.targetId ?? "-"}</span>
                    <span>actor {log.actorType}</span>
                    {log.ipAddress ? <span>IP {log.ipAddress}</span> : null}
                  </div>
                  {log.errorMessage ? (
                    <div className="mt-1 text-xs text-rose-600">{log.errorMessage}</div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}
