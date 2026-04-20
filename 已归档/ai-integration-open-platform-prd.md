# CloudDoc AI 接入与开放平台 PRD

## 1. 背景

CloudDoc 当前已经具备基础 AI 接入能力：

- 块级文档模型：文档内容以 `content_json` 存储。
- REST API：已覆盖文档、文件夹、评论、权限、分享、搜索等核心对象。
- MCP 服务：已支持 Streamable HTTP，AI 工具可以通过 MCP 读取、搜索、创建、更新文档和评论。
- 权限服务：REST 与 MCP 已开始收敛到统一 `permission_service.py` 和 `ActorContext`。
- Markdown 输出：`clouddoc.get_document` 默认支持 `format=markdown`，适合 AI 阅读。
- MCP 审计：MCP 写入和删除操作记录到 `mcp_audit_logs`。

这些能力已经构成“AI 可接入 CloudDoc”的技术底座，但还没有形成类似 Notion 的第三方 Integration 体验。

Notion 被大量 AI 工具支持的核心原因不是某个单一协议，而是它具备：

- 第三方应用授权模型。
- 可选择授权页面或数据库。
- 稳定 API Token / OAuth 接入。
- 结构化块文档模型。
- 页面和数据库的统一 API。
- 清晰的权限边界。
- 易于转换为 Markdown 或结构化 JSON 的内容格式。

CloudDoc 下一阶段目标是从“本地 MCP 服务可用”升级为“可被外部 AI 工具安全接入的开放文档系统”。

## 2. 产品定位

CloudDoc AI 接入与开放平台，是让个人 AI 助手、IDE Agent、自动化工作流和第三方 AI 应用在用户授权范围内安全读取、搜索、写入、评论和维护 CloudDoc 文档的开放能力。

它不是单纯增加一个 AI 聊天按钮，而是为 CloudDoc 建立一套标准外部接入能力：

- 用户可以创建或安装 AI Integration。
- 用户可以明确授权 AI Integration 可访问哪些空间、文件夹或文档。
- AI 可以通过 MCP 或 REST API 在授权范围内读取和写入。
- AI 写入必须受权限、审计、限流和撤销机制约束。
- 文档内容可以用 Markdown、纯文本或结构化块格式导出给 AI。

## 3. 目标

### 3.1 短期目标

- 支持 Personal Access Token，用于用户自己的 AI 工具接入。
- 支持 Integration Token，用于第三方工具或独立服务长期访问。
- 支持 Integration 授权范围，限定可访问的空间、文件夹和文档。
- MCP 和 REST API 都支持 token 认证，并统一转换为 `ActorContext`。
- 增加 Markdown 写入能力，让 AI 可以直接创建或更新文档。
- 完善 MCP 工具的权限边界、审计和错误返回。

### 3.2 中期目标

- 支持 OAuth 第三方应用安装流程。
- 支持类似 Notion 的“选择授权页面/文件夹”体验。
- 支持 Webhook 或事件订阅，让外部 AI 工具感知文档变更。
- 支持开发者文档和 API Explorer。
- 支持 AI 操作日志、用户可见的 Integration 活动记录。

### 3.3 长期目标

- 支持 CloudDoc 作为 AI 原生知识库被外部 Agent 长期维护。
- 支持 Embedding/RAG 索引服务，提升外部 AI 检索效率。
- 支持组织级 Integration 管理、审批和风控。
- 支持细粒度能力授权，例如只读、评论、创建文档、更新指定文件夹。

## 4. 非目标

首版不做以下能力：

- 不做完整公开应用市场。
- 不允许匿名写入。
- 不开放互联网可编辑链接。
- 不允许 Integration 绕过用户权限访问私有文档。
- 不做多人实时协同编辑。
- 不做所有第三方 AI 平台的专用插件适配。
- 不在首版实现完整 OAuth 应用审核流程。

## 5. 用户角色

### 5.1 普通用户

希望把自己的 AI 助手接入 CloudDoc，用于读取、总结、整理和写入自己的文档。

### 5.2 团队成员

希望 AI 能读取被授权的团队文档，但不能越权访问未授权内容。

### 5.3 空间管理员

希望管理哪些 Integration 可以访问团队空间，查看 Integration 活动记录。

### 5.4 第三方 AI 工具开发者

希望通过标准 API、MCP 或 OAuth 接入 CloudDoc。

### 5.5 系统管理员

希望控制开放能力的启用范围、审计日志、限流和安全策略。

## 6. 核心用户故事

1. 作为用户，我可以创建一个 Personal Access Token，配置到自己的 AI 工具中。
2. 作为用户，我可以创建一个 Integration，并选择它可以访问的文件夹或文档。
3. 作为用户，我可以随时禁用或删除某个 Token，让外部工具立即失效。
4. 作为用户，我可以查看某个 AI 工具最近读取、创建、更新或删除了哪些内容。
5. 作为用户，我可以让 AI 读取某个文件夹下的文档并生成总结。
6. 作为用户，我可以让 AI 用 Markdown 创建一篇新 CloudDoc 文档。
7. 作为用户，我可以让 AI 只在某个输出文件夹内写入，不能修改原始资料。
8. 作为团队管理员，我可以禁止某些 Integration 访问团队空间。
9. 作为第三方工具开发者，我可以通过 MCP 获取文档 Markdown，也可以获取 `content_json` 做精确编辑。
10. 作为系统管理员，我可以查看 Integration 审计日志并定位越权尝试。

## 7. 产品范围

## 7.1 Token 与 Integration 管理

新增两类外部接入凭证：

### Personal Access Token

用于个人自用 AI 工具。

特性：

- 归属于单个用户。
- 默认只继承该用户可访问权限。
- 可设置过期时间。
- 可设置能力范围。
- 可随时禁用或删除。
- 创建后只展示一次明文 token。

### Integration Token

用于第三方应用、团队自动化或独立 MCP 服务。

特性：

- 归属于一个 Integration。
- Integration 有名称、描述、图标、创建者、所属组织。
- Integration 必须配置授权范围。
- Integration 可被启用、停用、删除。
- Integration 的访问行为需要独立审计。

## 7.2 授权范围

授权范围用于控制 AI 工具能访问哪些资源。

支持范围：

- 全部自己创建的文档。
- 指定空间。
- 指定文件夹及其子级。
- 指定文档。
- 公开文档。
- 分享链接只读访问。

权限计算规则：

```text
AI 实际权限
= 用户自身权限
∩ Integration 授权范围
∩ Token 能力范围
∩ 资源当前状态
```

如果用户后来失去某个文档权限，Integration 即使曾经被授权，也不能继续访问该文档。

## 7.3 能力范围

Token 和 Integration 都需要声明能力范围。

首版能力：

- `documents:read`
- `documents:create`
- `documents:update`
- `documents:delete`
- `folders:read`
- `folders:create`
- `comments:read`
- `comments:create`
- `comments:update`
- `comments:delete`
- `search:read`
- `shares:read`

危险能力需要明确提示：

- `documents:update`
- `documents:delete`
- `comments:delete`

## 7.4 MCP 接入增强

当前 MCP 服务已实现基础读写工具，下一阶段需要增强为开放平台级接入。

新增或调整工具：

- `clouddoc.create_document_from_markdown`
- `clouddoc.update_document_from_markdown`
- `clouddoc.append_document_markdown`
- `clouddoc.list_folders`
- `clouddoc.get_folder_tree`
- `clouddoc.get_integration_context`
- `clouddoc.list_authorized_scopes`

现有工具保持：

- `clouddoc.list_documents`
- `clouddoc.search_documents`
- `clouddoc.get_document`
- `clouddoc.get_comments`
- `clouddoc.list_spaces`
- `clouddoc.get_shared_document`
- `clouddoc.create_document`
- `clouddoc.create_folder`
- `clouddoc.update_document_content`
- `clouddoc.delete_document`
- `clouddoc.restore_document`
- `clouddoc.create_comment`
- `clouddoc.reply_comment`
- `clouddoc.update_comment`
- `clouddoc.delete_comment`
- `clouddoc.favorite_document`

MCP 工具认证方式：

- 环境变量 actor 邮箱仅保留为本地开发模式。
- 生产环境优先使用 Token。
- Token 解析后生成 `ActorContext`。
- MCP 服务不得直接拼权限 SQL。
- MCP 所有业务判断必须复用 API service 层和 `permission_service.py`。

## 7.5 REST API 开放能力

新增开放 API 分组：

```text
/api/integrations
/api/tokens
/api/integration-scopes
/api/open/documents
/api/open/folders
/api/open/comments
/api/open/search
```

开放 API 与内部 API 的关系：

- 内部 API 面向 CloudDoc Web。
- 开放 API 面向第三方和自动化。
- 两者底层复用同一 service。
- 开放 API 默认返回更稳定、版本化的响应结构。

## 7.6 Markdown 写入

AI 工具更擅长生成 Markdown，而不是直接生成 CloudDoc `content_json`。

需要新增 Markdown 转块能力：

- Markdown heading 转 heading block。
- paragraph 转 paragraph block。
- bullet list 转 list block。
- ordered list 转 list block。
- task list 转 checklist block。
- blockquote 转 quote block。
- code fence 转 code block。
- image markdown 转 image block。
- link markdown 保留为 inline link 或 link block。

首版只要求常见 Markdown 语法稳定转换，不要求完全兼容 GitHub Flavored Markdown 的所有边界。

## 7.7 Webhook / 事件订阅

当前前端已有 SSE 文档库事件流，但外部 AI 工具需要服务端到服务端的事件通知。

中期新增 Webhook：

- `document.created`
- `document.updated`
- `document.deleted`
- `folder.created`
- `folder.updated`
- `comment.created`
- `comment.deleted`
- `permission.changed`

Webhook 要求：

- 每个 Integration 可配置多个 webhook endpoint。
- 支持签名校验。
- 支持失败重试。
- 支持禁用。
- 支持事件日志查询。

## 7.8 审计日志

现有 `mcp_audit_logs` 只记录 MCP 写入和删除，后续需要扩展为 Integration 级审计。

审计内容：

- actor 用户。
- token / integration。
- 操作来源：MCP、REST Open API、Webhook callback。
- 工具或接口名称。
- 资源类型和资源 ID。
- 请求摘要。
- 响应状态。
- 错误信息。
- IP、User-Agent。
- 时间。

用户视图：

- 个人配置页可查看自己 Token 的最近活动。
- 文档权限页可查看哪些 Integration 访问过该文档。
- 管理员可查看组织级 Integration 活动。

## 8. 页面与交互

## 8.1 个人配置：AI 与开放接入

在个人配置页面增加“AI 与开放接入”分区。

功能：

- 查看 Personal Access Token 列表。
- 创建 Token。
- 设置 Token 名称、过期时间、能力范围。
- 复制一次性 token。
- 禁用 Token。
- 删除 Token。
- 查看最近调用记录。

## 8.2 Integration 管理页

新增 Integration 管理页面。

功能：

- 创建 Integration。
- 编辑名称、描述、图标。
- 查看 client id。
- 管理 Integration Token。
- 管理授权范围。
- 管理能力范围。
- 查看审计日志。
- 禁用 Integration。

## 8.3 授权范围选择器

授权范围选择器需要复用当前文件夹树。

能力：

- 选择空间。
- 选择文件夹。
- 选择文档。
- 显示当前选择数量。
- 支持搜索文档。
- 显示风险提示。

交互原则：

- 默认不授权全部文档。
- 默认只读。
- 写入权限必须明确选择。
- 删除权限必须二次确认。

## 8.4 文档权限页集成

文档权限弹窗增加“开放接入”或“Integration”标签。

显示：

- 哪些 Integration 可以访问当前文档。
- 访问来源是直接授权、文件夹继承还是空间授权。
- 最近访问时间。
- 是否有写入能力。
- 可一键移除当前文档授权。

## 9. 权限与安全

## 9.1 权限总原则

- AI 工具不能获得超过用户自身权限的能力。
- Integration 授权范围必须显式配置。
- Token 能力必须显式配置。
- 写入操作必须可审计。
- 删除操作必须可追踪，必要时可恢复。
- guest 用户不能写入。
- 分享链接视图不能触发写入型 AI 操作。

## 9.2 Token 存储

- 明文 token 只在创建时展示一次。
- 数据库只保存 token hash。
- 支持 token 前缀用于定位。
- 支持过期时间。
- 支持 revoked 状态。
- 支持最后使用时间。

## 9.3 限流

首版限流维度：

- 每个 Token 每分钟请求数。
- 每个用户每分钟请求数。
- 每个 IP 每分钟请求数。
- 写入操作单独限流。

被限流时返回结构化错误，MCP 也要返回可被 AI 理解的错误信息。

## 9.4 数据泄漏防护

- 搜索结果只返回授权范围内的文档。
- 文件夹树只返回授权范围内可见节点。
- `content_json` 只返回有读取权限的文档。
- 分享链接读取只按分享规则，不继承用户登录态写权限。
- Integration 不能通过原文档 URL 绕过授权范围。

## 10. 数据模型

## 10.1 `integrations`

字段：

- `id`
- `organization_id`
- `created_by`
- `name`
- `description`
- `icon_url`
- `status`
- `client_id`
- `created_at`
- `updated_at`

## 10.2 `integration_tokens`

字段：

- `id`
- `integration_id`
- `user_id`
- `token_prefix`
- `token_hash`
- `name`
- `scopes`
- `expires_at`
- `revoked_at`
- `last_used_at`
- `created_at`
- `updated_at`

## 10.3 `integration_resource_scopes`

字段：

- `id`
- `integration_id`
- `resource_type`
- `resource_id`
- `include_children`
- `permission_level`
- `created_by`
- `created_at`

`resource_type` 可选：

- `space`
- `folder`
- `document`
- `public_documents`

## 10.4 `integration_audit_logs`

字段：

- `id`
- `integration_id`
- `token_id`
- `actor_id`
- `actor_type`
- `source`
- `operation`
- `target_type`
- `target_id`
- `request_summary`
- `response_status`
- `error_message`
- `ip_address`
- `user_agent`
- `created_at`

## 10.5 `integration_webhooks`

字段：

- `id`
- `integration_id`
- `url`
- `secret_hash`
- `event_types`
- `status`
- `created_at`
- `updated_at`

## 10.6 `integration_webhook_deliveries`

字段：

- `id`
- `webhook_id`
- `event_type`
- `payload`
- `response_status`
- `attempt_count`
- `next_retry_at`
- `delivered_at`
- `created_at`

## 11. API 设计草案

## 11.1 Token 管理

```text
GET    /api/tokens
POST   /api/tokens
PATCH  /api/tokens/{token_id}
DELETE /api/tokens/{token_id}
GET    /api/tokens/{token_id}/audit-logs
```

## 11.2 Integration 管理

```text
GET    /api/integrations
POST   /api/integrations
GET    /api/integrations/{integration_id}
PATCH  /api/integrations/{integration_id}
DELETE /api/integrations/{integration_id}
```

## 11.3 授权范围

```text
GET    /api/integrations/{integration_id}/scopes
POST   /api/integrations/{integration_id}/scopes
DELETE /api/integrations/{integration_id}/scopes/{scope_id}
```

## 11.4 开放文档 API

```text
GET  /api/open/documents
GET  /api/open/documents/{document_id}
POST /api/open/documents
PUT  /api/open/documents/{document_id}/content
POST /api/open/documents/from-markdown
PUT  /api/open/documents/{document_id}/from-markdown
```

## 11.5 开放搜索 API

```text
GET /api/open/search?q=keyword
```

## 12. MCP 返回格式要求

MCP 返回必须面向 AI 友好：

- 成功返回 `status: "ok"`。
- 失败返回 `status: "error"`、`code`、`message`。
- 权限失败使用 `unauthorized`。
- 找不到使用 `not_found`。
- 输入错误使用 `invalid_input`。
- 限流使用 `rate_limited`。

文档读取建议返回：

```json
{
  "status": "ok",
  "document": {
    "id": "doc_id",
    "title": "文档标题",
    "format": "markdown",
    "markdown": "# 文档标题\\n\\n正文",
    "updated_at": "2026-04-20T00:00:00Z",
    "permissions": {
      "can_edit": true,
      "can_comment": true
    }
  }
}
```

## 13. 开发阶段

## Phase 1：Personal Access Token 与 Markdown 写入

目标：让用户自己的 AI 工具安全接入。

需求：

- 新增 token 数据表。
- 新增 token 管理 API。
- 新增个人配置页 token 管理。
- REST 和 MCP 支持 token 认证。
- 增加 Markdown 转 `content_json` 服务。
- 增加 MCP Markdown 创建/更新工具。
- 增加审计日志。
- 增加限流基础能力。

验收：

- 用户可以创建 token。
- token 明文只展示一次。
- token 可以读取用户授权范围内文档。
- token 禁用后立即不可用。
- AI 可以用 Markdown 创建文档。
- AI 不能读取未授权私有文档。
- AI 写入有审计记录。

## Phase 2：Integration 与资源授权范围

目标：让用户能创建长期 Integration，并精确限定访问范围。

需求：

- 新增 Integration 管理。
- 新增 Integration Token。
- 新增资源授权范围。
- 增加授权范围选择器。
- MCP/REST 权限叠加 Integration 范围。
- 文档权限页展示 Integration 访问来源。

验收：

- Integration 默认没有任何文档权限。
- 用户授权某个文件夹后，Integration 可以读取该文件夹及子级。
- 用户取消授权后，Integration 立即失去访问。
- Integration 写入只能发生在具备写权限的授权范围内。
- 审计日志可以按 Integration 查询。

## Phase 3：Webhook 与事件订阅

目标：让外部 AI 工具可以感知 CloudDoc 变更。

需求：

- 新增 webhook 配置。
- 支持事件签名。
- 支持失败重试。
- 支持事件投递日志。
- 复用现有文档库事件发布机制。

验收：

- 文档更新后 webhook 收到 `document.updated`。
- webhook 签名可验证。
- webhook 失败后按策略重试。
- 禁用 webhook 后不再投递。

## Phase 4：OAuth 与第三方应用安装

目标：形成类 Notion 的第三方应用安装体验。

需求：

- 新增 OAuth App。
- 支持授权页。
- 支持选择授权资源。
- 支持授权码换 token。
- 支持 refresh token。
- 支持撤销授权。

验收：

- 第三方应用可以发起授权。
- 用户可以选择授权文件夹或文档。
- 第三方应用只能访问授权范围。
- 用户可以撤销授权。

## Phase 5：AI 知识库增强

目标：将开放接入与 LLM Wiki、RAG、知识编译能力结合。

需求：

- 文档 Embedding 索引。
- Integration 可配置检索范围。
- MCP 支持知识库查询工具。
- AI 操作与 LLM Wiki 工作区联动。

验收：

- AI 可以在授权范围内进行语义检索。
- 语义检索不能返回未授权文档。
- 知识库操作有引用和审计。

## 14. 测试计划

### 14.1 后端测试

- Token 创建、禁用、过期。
- Token hash 校验。
- Integration 授权范围计算。
- 文档读取权限叠加授权范围。
- 文档写入权限叠加能力范围。
- Markdown 转块。
- MCP token 认证。
- 审计日志写入。
- 限流。

### 14.2 前端测试

- Token 创建弹窗。
- token 明文只展示一次。
- Token 列表和禁用。
- Integration 创建。
- 授权范围选择器。
- 文档权限页 Integration 标签。
- 错误提示和 loading 状态。

### 14.3 MCP 测试

- 无 token guest 只读 public。
- token 可读授权文档。
- token 不可读未授权私有文档。
- Markdown 创建文档。
- Markdown 更新文档。
- 无写 scope 时更新失败。
- 删除权限缺失时删除失败。

### 14.4 安全测试

- token 泄漏后的禁用。
- 资源授权取消后的访问失败。
- 文件夹授权不影响无关文件夹。
- 分享链接不能触发写入。
- 原文档 URL 不能绕过权限。
- 被删除文档不能继续读取。

## 15. 风险与对策

### 15.1 AI 越权读取

风险：Integration 范围与用户权限合并逻辑错误，导致越权读取。

对策：

- 权限计算统一收口到 `permission_service.py`。
- 编写矩阵测试。
- MCP 和 REST Open API 不允许写独立权限 SQL。

### 15.2 AI 误写或误删

风险：AI 自动更新文档造成内容损坏。

对策：

- 删除能力默认关闭。
- 更新能力明确授权。
- 写入审计。
- 后续接入版本恢复。
- 重要写入支持草稿模式。

### 15.3 Token 泄漏

风险：外部工具配置泄漏 token。

对策：

- token hash 存储。
- 支持过期。
- 支持快速吊销。
- 支持最后使用时间和 IP 展示。
- 高风险操作二次限制。

### 15.4 开放 API 与内部 API 分叉

风险：两套 API 逻辑不一致。

对策：

- API route 只做参数适配。
- 所有业务逻辑复用 service。
- 权限统一使用 `ActorContext`。

## 16. 成功指标

- 用户可以在 5 分钟内创建 token 并接入一个 MCP 客户端。
- AI 工具可以读取授权文档并返回 Markdown。
- AI 工具可以通过 Markdown 创建 CloudDoc 文档。
- 未授权私有文档读取拦截率 100%。
- 所有写入操作审计覆盖率 100%。
- token 禁用后 1 秒内失效。
- 开放 API 和 MCP 权限测试覆盖核心读写路径。

## 17. 与现有系统关系

### 17.1 与 MCP 设计文档

本 PRD 定义产品能力和开放平台路线，`clouddoc-mcp-design.md` 继续作为 MCP 技术设计文档。

### 17.2 与权限 PRD

Integration 授权必须复用文档权限与分享 PRD 中的权限模型，不另起一套权限。

### 17.3 与 LLM Wiki PRD

LLM Wiki 是 AI 使用 CloudDoc 的一个产品场景；本 PRD 是更底层的外部 AI 接入能力。LLM Wiki 可以使用本 PRD 中的 token、scope、audit、Markdown 写入和 MCP 扩展能力。

### 17.4 与 SSE PRD

SSE 面向 CloudDoc 前端实时感知，Webhook 面向外部系统服务端事件通知。两者应共享事件源，但传输机制不同。

## 18. 结论

CloudDoc 当前已经具备 AI 接入 MVP：

- MCP 服务可用。
- Markdown 读取可用。
- 块模型可用。
- 基础权限和审计可用。

下一阶段重点不是继续堆 MCP 工具数量，而是补齐开放平台基础设施：

1. Token。
2. Integration。
3. 授权范围。
4. Markdown 写入。
5. 审计与限流。
6. Webhook。
7. OAuth。

完成这些能力后，CloudDoc 才能从“本项目自己的 AI 可接入”升级为“第三方 AI 工具可以像接 Notion 一样接入 CloudDoc”。

## 19. 2026-04-20 第一轮实现状态

### 19.1 已完成

- 新增开放平台基础数据模型：`integrations`、`integration_tokens`、`integration_resource_scopes`、`integration_audit_logs`、`integration_webhooks`、`integration_webhook_deliveries`。
- 新增 Personal Access Token 管理 API：创建、列表、禁用、审计日志查询。
- 新增 Integration 管理 API：创建、列表、更新、删除。
- 新增 Integration 授权范围 API：添加、列表、删除。
- 新增 `/api/open/documents`、`/api/open/documents/{document_id}`、`/api/open/documents/from-markdown`、`/api/open/documents/{document_id}/from-markdown`、`/api/open/search`、`/api/open/folders/tree/{space_id}`。
- 新增 Bearer Token 认证，token 明文只在创建时返回，数据库只保存 hash。
- 新增基础限流：按 token 区分读写请求窗口。
- 新增 Integration 授权范围与用户自身权限的交集校验。Integration 默认没有任何文档权限。
- 新增 Markdown 转 CloudDoc `content_json` 能力，覆盖 heading、paragraph、bullet list、ordered list、task list、blockquote、code fence、image、link block。
- MCP 新增 `clouddoc.create_document_from_markdown` 和 `clouddoc.update_document_from_markdown`。
- MCP `clouddoc.list_documents` 和 `clouddoc.get_document` 支持通过 `CLOUDDOC_MCP_TOKEN` 或工具参数 `mcp_token` 走开放平台 token 认证。
- 个人配置页新增“AI 与开放接入”区域，支持加载 Token/Integration、创建 PAT、显示一次性 token、禁用 token、创建 Integration。
- 个人配置页新增 Integration 授权范围管理，支持选择公开文档、空间、文件夹、文档，并设置 view/edit 权限；文件夹授权可包含子级。
- 文档权限弹窗新增“开放接入”标签，文档所有者/权限管理员可以直接查看当前文档被哪些 Integration 通过何种 scope 来源授权访问，并看到最近访问时间与只读/可写状态。
- 新增 Integration Webhook endpoint 管理：支持列表、创建、一次性返回 secret、启用/禁用、删除；个人配置页已提供基础管理界面。
- 新增 Webhook 首轮签名投递与投递日志：文档事件会匹配具备 scope 的 active webhook，按 `X-CloudDoc-*` 头和 `sha256=` 签名同步投递一次，并记录 `integration_webhook_deliveries` 供前端查看最近投递结果。
- 新增 Webhook 手动重放能力：可针对单条 delivery 重新触发一次投递，便于对方服务恢复后人工补发。

### 19.2 已验证

- PAT 可以通过 Markdown 创建文档，创建后有审计记录。
- PAT 禁用后，开放 API 立即返回 401。
- Integration 默认无法读取私有文档。
- Integration 授权指定文档 view 后可以读取。
- Integration 只有 view scope 时不能写入。
- Integration 授权指定文档 edit 后可以通过 Markdown 更新。
- MCP 可以通过 Markdown 创建和更新文档。
- 自动化测试：`apps/api .venv/bin/pytest -q` 通过，`apps/mcp ../api/.venv/bin/pytest -q` 通过，`apps/web npm run build` 通过。

### 19.3 剩余工作

- Web 端还需要补开放平台审计日志展示和更细的授权范围搜索体验。
- Webhook 还缺后台失败重试执行器、投递日志筛选能力，以及更完善的失败详情展示。
- OAuth 第三方应用安装流程仍未实现。
- Embedding/RAG 与 LLM Wiki 联动仍未实现。
