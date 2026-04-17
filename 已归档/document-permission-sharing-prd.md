# 文档权限与分享专项需求文档

更新日期：2026-04-17

## 1. 背景

CloudDoc 当前已经具备用户系统、文档所有者、基础可见性、分享链接、评论、文件夹和 MCP 接入能力。现有权限设计主要解决“私有/公开/分享链接只读访问”的基础问题，但还没有形成接近飞书云文档的完整权限体系。

本次 PRD 的目标是参考飞书云文档权限能力，把 CloudDoc 权限体系从“文档可见性 + 分享链接”升级为“文档权限设置 + 权限成员 + 分享链接 + 安全策略 + 审计记录”的可扩展模型。

## 2. 飞书云文档权限能力调研摘要

飞书云文档的权限能力可以拆成两大类：

- 权限成员：给具体用户、群、部门等主体分配查看、编辑、管理等权限。
- 权限设置：控制链接分享、组织外访问、评论、复制、下载、打印、协作者管理等全局策略。

### 2.1 权限成员能力

飞书开放平台的云文档权限成员接口支持新增、查询、更新、删除协作者，并支持批量增加协作者和转移所有者。成员主体不只限于单个用户，还可以是群、部门等组织实体。

CloudDoc 应吸收以下能力：

- 支持文档所有者。
- 支持显式添加协作者。
- 支持角色分级：所有者、可管理、可编辑、可评论、可查看。
- 支持批量授权。
- 支持未来扩展到团队、部门、群组、空间角色。
- 支持转移所有者，但必须有二次确认和审计。

### 2.2 权限设置能力

飞书的权限设置不是单个公开开关，而是一组独立策略，包括：

- 是否允许组织外访问。
- 链接分享范围，例如关闭链接分享、组织内可读、组织内可编辑、互联网上获得链接的人可读等。
- 谁可以评论。
- 谁可以添加或管理协作者。
- 谁可以复制、下载、打印。
- 外部邀请控制。
- 安全实体控制。

CloudDoc 应把这些设置抽象为独立字段，避免把所有规则塞进 `visibility` 一个字段里。

### 2.3 分享链接能力

CloudDoc 当前采用“独立分享链接 `/share/{token}`”方案，比直接暴露原文档链接更安全。这个方向应保留。

需要继续强化：

- 分享链接不等于文档原链接。
- 分享链接默认只读。
- 分享链接可设置密码、有效期、启用状态。
- 分享链接访问不能获得原文档编辑权限。
- 私有文档原链接泄漏时仍必须经过权限校验。

### 2.4 对 CloudDoc 的启发

CloudDoc 不应只做一个“公开/私有”的简单开关，而应形成五层权限判断：

1. 用户身份与文档所有权。
2. 显式权限成员。
3. 团队、文件夹、组织等继承权限。
4. 文档全局权限设置。
5. 分享链接临时访问通道。

## 3. 产品目标

### 3.1 用户目标

- 用户可以明确知道谁能看、谁能编辑、谁能评论、谁能管理文档。
- 用户可以安全地把私有文档分享给指定人或外部人员。
- 用户可以限制复制、下载、打印、导出等高风险操作。
- 用户可以查看权限变更和分享访问记录。
- 管理员可以排查权限问题，但不能绕过审计。

### 3.2 工程目标

- 权限判断必须统一在后端收口。
- REST API、MCP、分享页必须共用同一套权限服务。
- 前端只负责展示能力标记，不做最终权限裁决。
- 阅读模式、编辑模式、分享只读模式必须复用同一套文档渲染机制。
- 分享 token 不得被用来反推或绕过原文档权限。

## 4. 范围

### 4.1 本轮纳入范围

- 文档私有/公开可见性。
- 文档所有者与协作者角色。
- 分享链接密码、有效期、启用、重置。
- 文档权限设置弹窗。
- 评论权限、复制权限、导出权限、协作者管理权限。
- 权限变更审计。
- REST API 与 MCP 共用权限判断。
- 管理员可查看所有文档，但操作仍写审计。

### 4.2 暂不实现但预留

- 企业组织架构同步。
- 部门、群组、空间角色的真实授权 UI。
- 水印、敏感词、DLP。
- 高级审批流。
- 历史版本权限快照。

## 5. 术语定义

### 5.1 文档主体

- Owner：文档所有者，拥有最高业务权限。
- Collaborator：被显式授权的协作者。
- Public Visitor：通过公开文档原链接访问的用户。
- Share Visitor：通过分享链接访问的用户。
- Admin：系统管理员，可查看所有文档并管理异常权限，但所有操作必须审计。
- MCP Actor：MCP 访问时映射出的用户身份。

### 5.2 权限角色

- `owner`：所有者，可管理所有权限，可转移所有权。
- `full_access`：可管理，能编辑、评论、添加协作者、调整权限设置，但不能转移所有权，除非另行授权。
- `edit`：可编辑正文，可评论。
- `comment`：可阅读和评论，不能编辑正文。
- `view`：仅可阅读。

角色继承关系：

`owner > full_access > edit > comment > view`

### 5.3 文档可见性

- `private`：私有文档，仅所有者、管理员、显式授权用户、有效分享链接访问者可访问。
- `public`：公开文档，登录用户或允许匿名访问时可读，但编辑仍需要显式权限。

## 6. 权限模型

### 6.1 权限判断顺序

访问文档时按以下顺序计算最终能力：

1. 如果是系统管理员，授予管理可见性能力，但写入操作仍按管理员审计。
2. 如果是文档所有者，授予 `owner`。
3. 查询显式权限成员，得到用户、团队、文件夹继承权限中的最高权限。
4. 如果文档是公开文档，授予至少 `view`。
5. 如果通过分享链接访问，按分享链接状态授予临时 `view`。
6. 叠加文档权限设置，例如评论、复制、导出、协作者管理限制。
7. 如果安全策略禁止某操作，则拒绝。

### 6.2 能力标记

后端返回文档时必须返回能力标记：

- `can_view`
- `can_edit`
- `can_comment`
- `can_manage_permissions`
- `can_share`
- `can_copy`
- `can_export`
- `can_delete`
- `can_transfer_owner`
- `access_mode`

前端所有按钮和交互只读取这些能力标记。

### 6.3 API 与 MCP 一致性

REST API、MCP、后台任务必须统一调用 `permission_service.py`，禁止各自写权限 SQL。

统一输入：

- `ActorContext`
- `document_id`
- `operation`

统一输出：

- `PermissionDecision`
- `allowed`
- `reason`
- `effective_role`
- `capabilities`

## 7. 数据模型设计

### 7.1 documents

新增或确认字段：

- `owner_id UUID NOT NULL`
- `visibility VARCHAR(16) NOT NULL DEFAULT 'private'`
- `created_by UUID NOT NULL`
- `updated_by UUID NULL`
- `deleted_at TIMESTAMPTZ NULL`

### 7.2 document_permissions

用于显式协作者授权。

字段建议：

- `id UUID PRIMARY KEY`
- `document_id UUID NOT NULL`
- `subject_type VARCHAR(32) NOT NULL`
- `subject_id VARCHAR(128) NOT NULL`
- `permission_level VARCHAR(32) NOT NULL`
- `invited_by UUID NULL`
- `notify BOOLEAN NOT NULL DEFAULT false`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

`subject_type` 首版支持：

- `user`

预留：

- `team`
- `department`
- `group`
- `folder`
- `space_role`

### 7.3 document_permission_settings

用于保存文档级全局权限策略。

字段建议：

- `document_id UUID PRIMARY KEY`
- `link_share_scope VARCHAR(32) NOT NULL DEFAULT 'closed'`
- `external_access_enabled BOOLEAN NOT NULL DEFAULT false`
- `comment_scope VARCHAR(32) NOT NULL DEFAULT 'can_edit'`
- `share_collaborator_scope VARCHAR(32) NOT NULL DEFAULT 'full_access'`
- `copy_scope VARCHAR(32) NOT NULL DEFAULT 'can_view'`
- `export_scope VARCHAR(32) NOT NULL DEFAULT 'full_access'`
- `print_scope VARCHAR(32) NOT NULL DEFAULT 'full_access'`
- `download_scope VARCHAR(32) NOT NULL DEFAULT 'full_access'`
- `allow_search_index BOOLEAN NOT NULL DEFAULT false`
- `watermark_enabled BOOLEAN NOT NULL DEFAULT false`
- `updated_by UUID NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

### 7.4 share_links

保留现有独立分享链接模型，并明确语义。

字段建议：

- `id UUID PRIMARY KEY`
- `document_id UUID NOT NULL`
- `token TEXT UNIQUE NOT NULL`
- `permission_level VARCHAR(32) NOT NULL DEFAULT 'view'`
- `password_hash TEXT NULL`
- `expires_at TIMESTAMPTZ NULL`
- `is_active BOOLEAN NOT NULL DEFAULT true`
- `allow_copy BOOLEAN NOT NULL DEFAULT false`
- `allow_export BOOLEAN NOT NULL DEFAULT false`
- `access_count INTEGER NOT NULL DEFAULT 0`
- `last_accessed_at TIMESTAMPTZ NULL`
- `created_by UUID NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

### 7.5 document_permission_audit_logs

所有权限和分享相关变更都要写审计。

字段建议：

- `id UUID PRIMARY KEY`
- `document_id UUID NOT NULL`
- `actor_id UUID NULL`
- `actor_type VARCHAR(32) NOT NULL`
- `action VARCHAR(64) NOT NULL`
- `target_type VARCHAR(32) NULL`
- `target_id VARCHAR(128) NULL`
- `before_json JSONB NULL`
- `after_json JSONB NULL`
- `reason TEXT NULL`
- `ip_address TEXT NULL`
- `user_agent TEXT NULL`
- `created_at TIMESTAMPTZ NOT NULL`

## 8. 权限设置规则

### 8.1 链接分享范围

`link_share_scope` 可选值：

- `closed`：关闭链接分享。
- `tenant_readable`：组织内获得链接的人可读。
- `tenant_editable`：组织内获得链接的人可编辑。
- `anyone_readable`：互联网上获得链接的人可读。

首版不开放 `anyone_editable`，因为风险过高。

### 8.2 组织外访问

`external_access_enabled = false` 时：

- 不允许生成互联网公开分享链接。
- 不允许邀请外部用户。
- 已存在外部分享链接应立即失效或降级为组织内访问。

### 8.3 评论权限

`comment_scope` 可选值：

- `disabled`
- `can_view`
- `can_edit`

含义：

- `disabled`：任何非管理用户都不能评论。
- `can_view`：有查看权限即可评论。
- `can_edit`：只有可编辑用户可评论。

### 8.4 协作者管理权限

`share_collaborator_scope` 可选值：

- `owner`
- `full_access`
- `edit`

默认建议：

- `full_access`

### 8.5 复制、导出、下载、打印

每个操作独立配置，取值：

- `disabled`
- `can_view`
- `can_edit`
- `full_access`

分享页默认：

- 复制：按 `share_links.allow_copy`
- 导出：按 `share_links.allow_export`
- 下载和打印：首版默认禁止

## 9. 页面与交互设计

### 9.1 权限入口

文档页顶部保留“分享”或“权限”入口，点击后打开统一弹窗。

弹窗分为五个标签：

- 文档可见性
- 协作者
- 分享链接
- 安全设置
- 操作记录

### 9.2 文档可见性

展示：

- 当前文档是私有还是公开。
- 私有文档说明：只有你和被授权的人可访问。
- 公开文档说明：拥有链接的用户可查看，编辑仍需要授权。

操作：

- 私有/公开切换。
- 切换为公开时弹出风险确认。

### 9.3 协作者

能力：

- 搜索用户。
- 添加协作者。
- 批量添加协作者。
- 修改协作者角色。
- 删除协作者。
- 查看谁邀请的、何时邀请。
- 可选发送通知。

限制：

- 不能删除文档所有者。
- 不能把自己的权限降到失去管理能力，除非仍有其他所有者或管理员可恢复。

### 9.4 分享链接

能力：

- 启用或关闭分享。
- 设置分享密码。
- 设置过期时间。
- 设置是否允许复制。
- 设置是否允许导出。
- 复制分享链接。
- 重新生成链接。
- 查看访问次数和最近访问时间。

规则：

- 分享链接必须使用 `/share/{token}`。
- 分享页强制只读。
- 分享访问不暴露原文档 ID 的编辑能力。

### 9.5 安全设置

能力：

- 谁可以评论。
- 谁可以复制。
- 谁可以导出。
- 谁可以下载。
- 谁可以打印。
- 谁可以添加协作者。
- 是否允许组织外访问。

### 9.6 操作记录

展示：

- 权限变更。
- 分享开启、关闭、重置。
- 密码变更。
- 有效期变更。
- 所有者转移。
- 管理员操作。

## 10. 分享页设计

分享页继续使用：

- `/share/{token}`

分享页必须复用普通文档显示组件。

强制能力：

- `can_view = true`
- `can_edit = false`
- `can_comment = false`
- `can_delete = false`
- `can_share = false`
- `can_manage_permissions = false`

禁止能力：

- 编辑模式切换。
- 自动保存。
- 评论创建。
- 评论删除。
- 图片上传。
- 块拖拽。
- 块菜单。
- 新建块。
- 删除文档。
- 再分享。

## 11. API 设计

### 11.1 文档权限能力

- `GET /api/documents/{document_id}/capabilities`
- `GET /api/documents/{document_id}/permission-settings`
- `PUT /api/documents/{document_id}/permission-settings`

### 11.2 协作者

- `GET /api/documents/{document_id}/permissions`
- `POST /api/documents/{document_id}/permissions`
- `POST /api/documents/{document_id}/permissions/batch`
- `PATCH /api/documents/{document_id}/permissions/{permission_id}`
- `DELETE /api/documents/{document_id}/permissions/{permission_id}`

### 11.3 所有权

- `POST /api/documents/{document_id}/transfer-owner`

要求：

- 只有所有者或管理员可以转移。
- 必须写审计。
- 前端必须二次确认。

### 11.4 分享链接

- `GET /api/documents/{document_id}/share-link`
- `POST /api/documents/{document_id}/share-link`
- `PATCH /api/documents/{document_id}/share-link`
- `POST /api/documents/{document_id}/share-link/rotate`
- `DELETE /api/documents/{document_id}/share-link`
- `GET /api/share/{token}`
- `POST /api/share/{token}/verify-password`

### 11.5 审计

- `GET /api/documents/{document_id}/permission-audit-logs`

## 12. 后端实现要求

### 12.1 权限服务统一

新增或强化：

- `permission_service.py`
- `actor_context.py`
- `permission_audit_service.py`

禁止：

- REST 路由直接拼权限 SQL。
- MCP 服务直接拼复杂权限 SQL。
- 前端通过隐藏按钮代替后端鉴权。

### 12.2 ActorContext

统一身份上下文：

- Web 登录用户。
- MCP 传入用户。
- Guest 用户。
- Admin 用户。
- Share token 访问者。

示例字段：

- `actor_id`
- `actor_email`
- `actor_type`
- `is_admin`
- `source`
- `share_token`

### 12.3 PermissionDecision

统一返回：

- `allowed`
- `effective_role`
- `capabilities`
- `deny_reason`
- `audit_required`

### 12.4 管理员规则

管理员可以：

- 查看所有文档。
- 修复权限配置。
- 删除违规分享链接。
- 查看审计。

管理员不应静默绕过：

- 删除文档。
- 转移所有者。
- 修改分享范围。

这些操作必须写审计。

## 13. 前端实现要求

### 13.1 能力驱动 UI

所有权限相关 UI 都读取后端能力标记。

例如：

- 编辑下拉是否可用取 `can_edit`。
- 评论入口是否显示取 `can_comment`。
- 分享按钮是否可用取 `can_share`。
- 删除按钮是否可用取 `can_delete`。
- 权限弹窗是否可编辑取 `can_manage_permissions`。

### 13.2 分享页与原文档页一致

分享页和普通阅读页必须共用同一套文档组件。

只通过以下开关切换：

- `editable`
- `capabilities`
- `access_mode`

### 13.3 错误提示

权限拒绝要明确展示原因：

- 文档不存在。
- 你没有访问权限。
- 分享链接已关闭。
- 分享链接已过期。
- 密码错误。
- 当前文档禁止复制。
- 当前文档禁止导出。

## 14. 开发计划

### Phase 1：权限服务收口

交付内容：

- 抽象 `ActorContext`。
- 抽象 `PermissionDecision`。
- REST 与 MCP 共用 `permission_service.py`。
- 所有文档读取、编辑、删除、评论、分享接口接入统一权限判断。

验收标准：

- 私有文档原链接泄漏也无法越权访问。
- MCP 不能越权读写他人私有文档。
- 前端 API 失败时显示明确权限错误。

### Phase 2：协作者权限

交付内容：

- `document_permissions` 模型升级。
- 协作者列表。
- 添加、批量添加、修改、删除协作者。
- 角色：查看、评论、编辑、可管理。

验收标准：

- 被授权用户可以按角色访问。
- 未授权用户不能访问私有文档。
- 角色降级后立即生效。

### Phase 3：权限设置

交付内容：

- `document_permission_settings`。
- 评论、复制、导出、下载、打印、协作者管理开关。
- 组织外访问开关。

验收标准：

- 禁止评论后前后端都不能创建评论。
- 禁止复制/导出后按钮隐藏且 API 拒绝。
- 关闭组织外访问后外部分享失效。

### Phase 4：分享链接增强

交付内容：

- 分享链接密码、有效期、启用、关闭、重置。
- 分享访问统计。
- 分享页只读能力锁死。

验收标准：

- 旧 token 重置后立即失效。
- 过期链接不可访问。
- 分享页无法进入编辑。

### Phase 5：审计与所有者转移

交付内容：

- 权限审计日志。
- 分享审计日志。
- 所有者转移。
- 管理员权限操作审计。

验收标准：

- 每次权限变更都有记录。
- 所有者转移后新所有者拥有 owner 权限。
- 管理员操作可追溯。

## 15. 测试计划

### 15.1 后端权限测试

- owner 可读写删。
- edit 可读写但不能管理权限。
- comment 可读和评论但不能编辑正文。
- view 只能阅读。
- 未授权用户不能访问私有文档。
- public 文档可读但不可编辑。
- admin 可查看所有文档，写操作有审计。
- MCP actor 只能按身份权限访问。

### 15.2 分享测试

- 开启分享后可通过 `/share/{token}` 访问。
- 关闭分享后不可访问。
- 过期分享不可访问。
- 密码错误不可访问。
- 重置 token 后旧链接不可访问。
- 分享页不可编辑、不可评论、不可删除。

### 15.3 权限设置测试

- 禁止评论时 UI 和 API 都拒绝评论。
- 禁止复制时前端不显示复制入口。
- 禁止导出时 API 拒绝导出。
- 组织外访问关闭时互联网分享不可创建。
- 协作者管理范围变更后立即生效。

### 15.4 前端自动化测试

- 权限弹窗打开和切换标签。
- 添加协作者。
- 修改协作者角色。
- 删除协作者必须弹确认。
- 私有文档越权访问提示清晰。
- 分享链接密码流程。
- 分享页和普通阅读页显示一致。

## 16. 当前实现状态

截至 2026-04-17，已完成权限与分享首版增强：

- 后端已新增 `document_permission_settings`、`document_permission_audit_logs`，并扩展 `document_permissions` 的协作者字段和唯一约束。
- 后端已提供能力接口、权限设置接口、协作者增删改查与批量添加接口、所有者转移接口、权限审计查询接口。
- `permission_service.py` 已统一计算文档角色和能力，文档详情、列表、评论、分享、MCP 读取边界均接入统一权限判断。
- 文档详情和列表已返回 `can_share`、`can_copy`、`can_export`、`can_delete`、`can_transfer_owner`、`effective_role` 等能力字段。
- 权限/分享弹窗已包含可见性、协作者、分享链接、安全设置、操作记录五个标签页；协作者删除和所有者转移均带确认。
- 权限弹窗的协作者选择已接入组织成员搜索，可按姓名、邮箱或用户 ID 检索并点选添加协作者；已有协作者和所有者转移选择也显示成员姓名和邮箱，不再要求手填裸用户 ID。
- 分享链接仍使用独立 `/share/{token}`，支持启用、关闭、重置、密码、有效期、复制/导出开关，并锁死分享页编辑能力。
- 权限设置、协作者变更、所有者转移会写入审计，并发布 `document.permission_changed` SSE 事件。
- 已补充后端自动化测试覆盖协作者授权/撤销、权限设置、能力变化、权限审计、SSE 事件与通知事件。

仍作为后续增强项：

- 批量协作者添加的前端 UI。
- 导出、下载、打印等具体操作 API 与 UI 的完整落地。
- 组织外访问策略对所有分享链接的强制降级和失效流程。
- 管理员权限修复操作的专门 UI。

## 17. 风险与决策

### 17.1 不做前端权限裁决

前端隐藏按钮只能改善体验，不能作为安全边界。

### 17.2 不开放互联网可编辑链接

飞书支持更复杂的链接编辑策略，但 CloudDoc 首版不开放 `anyone_editable`，避免匿名写入和审计困难。

### 17.3 分享链接继续独立于原文档链接

这比直接开放原文档链接更安全，也更符合当前 CloudDoc 已实现的方向。

### 17.4 权限服务必须先重构

如果继续让 REST、MCP、分享页各自判断权限，后续一定会出现越权漏洞。权限服务收口应作为最高优先级。

## 18. 结论

CloudDoc 权限体系应从“文档是否公开”升级为“谁能访问 + 能做什么 + 通过什么入口访问 + 是否允许外发 + 操作是否可审计”的完整模型。

优先级建议：

1. 先收口统一权限服务，修复所有越权访问风险。
2. 再做协作者和权限设置 UI。
3. 最后完善所有者转移、批量授权、审计和组织级扩展。
