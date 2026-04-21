# CloudDoc MCP 接入设计文档

## 当前实现状态

- Phase 1 只读 MCP 已实现。
- Phase 2 受控写入 MCP 已实现。
- MCP 包目录：`apps/mcp`
- MCP server 入口：`clouddoc_mcp.server:main`
- 可执行命令：`clouddoc-mcp`
- 当前传输方式：Streamable HTTP
- 默认地址：`http://127.0.0.1:8010/mcp`
- 当前已开放只读工具：
  - `clouddoc.list_documents`
  - `clouddoc.search_documents`
  - `clouddoc.get_document`
  - `clouddoc.get_comments`
  - `clouddoc.list_spaces`
  - `clouddoc.list_folders`
  - `clouddoc.get_folder_tree`
  - `clouddoc.get_integration_context`
  - `clouddoc.list_authorized_scopes`
  - `clouddoc.get_shared_document`
- 当前已开放受控写入工具：
  - `clouddoc.create_document`
  - `clouddoc.create_folder`
  - `clouddoc.update_document_content`
  - `clouddoc.create_document_from_markdown`
  - `clouddoc.update_document_from_markdown`
  - `clouddoc.append_document_markdown`
  - `clouddoc.delete_document`
  - `clouddoc.restore_document`
  - `clouddoc.create_comment`
  - `clouddoc.reply_comment`
  - `clouddoc.update_comment`
  - `clouddoc.delete_comment`
  - `clouddoc.favorite_document`
- 写入工具会写入 `mcp_audit_logs` 审计记录。
- 普通 MCP 文档/评论工具只能访问 actor 自己创建或拥有的文档；评论更新和删除只能操作 actor 自己写的评论。分享 token 读取工具保持只读例外。
- 当前结构约束目标：
  - `apps/api` 继续作为主业务后端，保留 REST API。
  - `apps/mcp` 继续作为独立 MCP 协议服务，只负责 MCP transport、工具参数适配、工具返回格式和 MCP 审计。
  - REST API 与 MCP 工具必须共享 `apps/api/app/services/*` 中的业务服务。
  - 权限判断集中到 `apps/api/app/services/permission_service.py`。
  - REST 当前用户与 MCP actor 都统一收敛为 `ActorContext`，再交给权限服务判断。
  - MCP bridge 不维护独立文档权限规则；“是否可读、是否可写、是否可删除”的条件不能散落在 bridge 中。
  - MCP bridge 可以保留协议级错误映射、MCP 审计、MCP actor 解析，但复杂列表、搜索、详情读取和业务权限必须下沉到 API service 层。

## 1. 文档目标

本文档定义 CloudDoc 的 MCP 接入方案，用于让 AI Agent、IDE 助手、自动化工作流和外部 MCP Client 能以统一协议访问 CloudDoc。

目标不是替代现有 REST API，而是在现有服务层之上增加一层更适合 AI 使用的能力暴露层。

本文档优先考虑当前项目现状：

- CloudDoc 已具备文档、评论、通知、分享、用户、组织与权限模型
- 文档系统已有统一内容模型与只读/编辑能力控制
- 后端以 FastAPI + service 层组织
- 前端与后端已通过权限和分享链路完成一轮闭环

MCP 设计要遵守两个原则：

- 复用现有业务服务，不重复实现权限逻辑
- 默认最小权限，只读优先，写入能力后开

---

## 2. 为什么要做 MCP

如果目标是“让 AI 方便读取或接入 CloudDoc”，MCP 比直接开放一组零散 HTTP API 更合适。

原因：

- MCP 对 Agent 更友好，工具边界更清晰
- 可以把 CloudDoc 能力按“任务语义”暴露，而不是按 HTTP 端点暴露
- 可以在工具级做权限控制和审计
- 更适合后续扩展为知识库、AI Wiki、知识编译工作流

建议最终形态：

- 外部应用：继续使用 REST API
- AI / Agent：使用 MCP Server
- MCP Server 与 REST API 共用同一套 service 层

---

## 3. 适用场景

### 3.1 只读场景

- 按标题或关键词搜索文档
- 拉取某篇文档内容
- 拉取文档评论与通知
- 读取分享文档
- 读取团队空间中的文档列表

### 3.2 写入场景

- 新建文档
- 更新文档内容
- 创建评论 / 回复评论
- 收藏文档

### 3.3 高阶知识场景

- 从原始资料生成总结文档
- 将文档整理为知识页
- 维护主题索引页
- 为知识库建立引用关系

---

## 4. 设计原则

### 4.1 先只读，后写入

第一阶段优先做只读 MCP，降低安全和权限复杂度。

### 4.2 权限只在后端决定

MCP 工具不直接绕过权限判断。所有工具最终都调用后端 service 层，由 service 层决定：

- 谁能读
- 谁能写
- 谁能删
- 谁能管理分享

实现约束：

- 权限入口统一放在 `permission_service.py`。
- 业务 service 可以提供兼容函数，例如 `can_view_document(db, document, user_id)`，但内部必须委托 `permission_service.py`。
- MCP 独有读范围，例如“可读 actor 自己创建/拥有的文档和 public 文档”，也必须用 `permission_service.py` 中的明确函数表达，不能在 MCP bridge 中重复拼 `owner_id == actor_id`。
- 分享链接读取是独立只读入口，成功分享访问不等于获得原文档编辑、评论、删除或管理权限。

### 4.3 不让 MCP 去调用本系统自己的 HTTP API

推荐结构：

- REST API -> service
- MCP Server -> service

而不是：

- MCP Server -> 自己再请求本机 HTTP API

这样做的好处：

- 少一层网络开销
- 减少重复鉴权
- 更易测试
- 错误边界更清楚

### 4.4 工具要任务化

不要把工具设计成“任意 SQL / 任意字段写入”。

工具应该按明确任务暴露，例如：

- `get_document`
- `search_documents`
- `create_comment`
- `update_document_content`

而不是让模型自己拼装内部数据结构。

### 4.5 全量审计

所有 MCP 写操作都需要记录：

- 调用者身份
- 调用工具名
- 目标文档 / 评论 / 空间 ID
- 调用时间
- 调用结果

---

## 5. 总体架构

推荐新增目录：

```text
apps/mcp/
```

建议结构：

```text
apps/mcp/
  pyproject.toml
  app/
    server.py
    auth.py
    tool_registry.py
    tools/
      documents.py
      comments.py
      spaces.py
      shares.py
      notifications.py
    schemas/
      common.py
      documents.py
      comments.py
    services/
      bridge.py
```

整体调用路径：

```text
MCP Client
  -> Streamable HTTP MCP Server
    -> CloudDoc service 层
      -> PostgreSQL / 文件存储
```

后端共用建议：

- 直接从 `apps/api/app/services/*` 调用
- 共用 `SessionLocal`
- 共用用户上下文解析逻辑
- 共用文档、评论、分享、权限 service

当前落地结构：

```text
apps/api/app/services/
  actor_context.py        # REST 用户、MCP 用户、guest/anonymous 的统一 actor 表达
  permission_service.py   # 文档、评论、空间、文件夹权限判断
  document_service.py     # 文档业务和 MCP 文档查询服务
  comment_service.py      # 评论业务
  folder_service.py       # 文件夹业务
  share_service.py        # 分享业务

apps/mcp/clouddoc_mcp/
  server.py               # MCP transport 和工具注册
  bridge.py               # MCP 参数适配、actor 解析、审计、错误映射
```

边界要求：

- `server.py` 不包含业务逻辑。
- `bridge.py` 不维护独立权限规则。
- `bridge.py` 可以打开数据库 session，但查询文档/评论/权限时优先调用 API service。
- `mcp_audit_logs` 只记录 MCP 写操作，不影响 REST API 审计策略。

---

## 6. MCP 能力分阶段设计

## 6.1 Phase 1：只读 MCP

第一版只开放只读能力。

建议工具：

- `clouddoc.list_documents`
- `clouddoc.search_documents`
- `clouddoc.get_document`
- `clouddoc.get_comments`
- `clouddoc.list_spaces`
- `clouddoc.get_notifications`
- `clouddoc.get_shared_document`

目标：

- 让 AI 能搜索、读取、理解 CloudDoc 内容
- 不引入写权限风险

## 6.2 Phase 2：受控写入 MCP

第二版增加有限写入能力。

建议工具：

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

目标：

- 支持 Agent 辅助创作和协作
- 但仍然不开放危险的任意写操作，删除和恢复必须限制在 actor 自己创建或拥有的文档内

## 6.3 Phase 3：知识编译 MCP

第三版增加更高层能力。

建议工具：

- `clouddoc.summarize_document`
- `clouddoc.create_knowledge_page`
- `clouddoc.update_index_page`
- `clouddoc.link_related_documents`
- `clouddoc.ingest_source_to_doc`

目标：

- 从“读文档”升级到“维护知识库”

---

## 7. 工具设计

## 7.1 `clouddoc.list_documents`

用途：

- 获取当前用户可访问的文档列表

输入：

- `state`: `active | trash | all`
- `space_id` 可选
- `limit` 可选

输出：

- 文档摘要数组：
  - `id`
  - `title`
  - `document_type`
  - `visibility`
  - `updated_at`
  - `can_edit`
  - `can_manage`

## 7.2 `clouddoc.search_documents`

用途：

- 基于标题和正文搜索

输入：

- `query`
- `limit` 可选

输出：

- 搜索结果数组：
  - `id`
  - `title`
  - `excerpt`
  - `document_type`
  - `updated_at`

## 7.3 `clouddoc.get_document`

用途：

- 获取文档内容，默认返回适合 AI 阅读的 Markdown

输入：

- `document_id`
- `format` 可选，默认 `markdown`

输出：

- `format=markdown`：
  - 元数据
  - `markdown`
  - 能力标志：
    - `can_edit`
    - `can_manage`
    - `can_comment`
- `format=plain_text`：
  - 元数据
  - `plain_text`
- `format=content_json`：
  - 元数据
  - `content_json`
- `format=full`：
  - 元数据
  - 原始 `content`
  - `markdown`

格式选择原则：

- AI 阅读、摘要、问答、上下文注入优先使用 `markdown`
- 搜索、轻量摘要或低 token 上下文可使用 `plain_text`
- AI 需要精确编辑、块级插入、保留评论锚点或保留结构时使用 `content_json`
- 调试和兼容旧客户端时使用 `full`

## 7.4 `clouddoc.get_comments`

用途：

- 拉取文档评论线程

输入：

- `document_id`

输出：

- 评论线程列表
- 每个线程包含锚点、状态、评论列表、父子回复关系

## 7.5 `clouddoc.get_shared_document`

用途：

- 读取分享文档

输入：

- `token`
- `password` 可选

输出：

- 分享状态：
  - `ok`
  - `password_required`
  - `expired`
  - `disabled`
  - `not_found`
- 如果成功，返回只读文档详情

## 7.6 `clouddoc.create_document`

用途：

- 在指定空间创建文档

输入：

- `space_id`
- `title`
- `document_type`
- `visibility`

输出：

- 新建文档详情

## 7.7 `clouddoc.update_document_content`

用途：

- 更新文档内容

输入：

- `document_id`
- `title`
- `content_json`
- `plain_text`

输出：

- 更新后的文档详情

注意：

- 必须受正常编辑权限控制
- 不允许通过 MCP 绕过分享只读限制

---

## 8. 鉴权与身份设计

MCP 至少要支持两种身份模式。

## 8.1 用户身份模式

适用于：

- 桌面 Agent
- 个人 AI 助手
- IDE 内登录后的用户操作

实现方式建议：

- 复用当前 session/cookie 体系
- 或基于 access token 换取当前用户上下文

特点：

- 权限最精确
- 能直接复用当前用户视角

## 8.2 Service Token 模式

适用于：

- 服务间调用
- 后台知识整理任务
- 企业级自动化工作流

建议新增：

- `mcp_clients`
- `mcp_tokens`

字段建议：

- `id`
- `name`
- `token_hash`
- `scope`
- `status`
- `created_by`
- `expires_at`

作用：

- 给自动化任务一个明确身份
- 不混用真实用户密码

## 8.3 推荐落地顺序

第一版优先：

- 使用固定开发 token 或 service token

第二版再做：

- 真实用户登录态映射

## 8.4 ActorContext

为了避免 REST API 和 MCP 使用两套身份语义，后端统一使用 `ActorContext` 表达调用者。

字段：

- `actor_type`: `user | guest | anonymous | service`
- `user_id`: 关联 `users.id`，匿名时为空
- `email`: 用户邮箱，可选
- `is_authenticated`: 是否有有效身份
- `is_guest`: 是否为内置访客身份

转换规则：

- REST 登录用户：`ActorContext.from_user(current_user)`
- REST 未登录：`ActorContext.anonymous()`
- MCP 显式 `user_email`：查找启用用户并生成 `ActorContext.from_user(user)`
- MCP `CLOUDDOC_MCP_ACTOR_EMAIL`：同上
- MCP 未指定用户：使用 `guest@clouddoc.local`，生成 guest actor；guest 不加入组织、不继承默认 demo 用户权限

业务 service 仍可以在函数签名中接收 `user_id` 以兼容现有代码，但权限判断前必须转换为 `ActorContext` 或委托支持 actor 的权限函数。

---

## 9. 权限控制规则

MCP 工具必须复用 CloudDoc 后端已有权限判断。

例如：

- 读取文档 -> `can_view_document`
- 编辑文档 -> `can_edit_document`
- 管理文档分享 -> `can_manage_document`
- 创建评论 -> `can_comment_document`

关键原则：

- 分享访问成功，不等于拥有原文档权限
- 私有文档不能因为 MCP 工具存在而被绕过
- `share` 相关工具不能返回编辑能力
- 未显式传递 `CLOUDDOC_MCP_ACTOR_EMAIL` 时，只能使用内置 `guest@clouddoc.local` 访客身份；guest 不加入组织、不拥有文档授权，不能回退到数据库中的第一个启用用户

### 9.1 REST 普通文档权限

- 普通 REST 文档详情、编辑、删除、恢复、收藏：只允许文档 owner/creator。
- 普通 REST 不因为 `visibility=public` 就开放原文档详情。公开对外访问必须使用分享链接，避免原链接泄漏绕过分享控制。
- 评论创建与读取沿用普通文档访问权限。

### 9.2 MCP 普通文档权限

- MCP 读取文档：允许 actor 自己创建/拥有的文档，以及 `visibility=public` 的文档。
- MCP 读取文档默认输出 `markdown`，外部 AI 可按需请求 `plain_text`、`content_json` 或 `full`。
- MCP 修改、删除、恢复、创建评论、回复评论、收藏：只允许 actor 自己创建/拥有的文档。
- MCP 更新/删除评论：只允许评论作者本人，并且目标评论所在文档也必须是 actor 自己创建/拥有的文档。
- MCP 未指定 actor 时使用 guest；guest 只能读取 public 文档和分享文档，不能写入普通文档。

### 9.3 分享文档权限

- 分享 token 读取只返回只读文档详情。
- 分享 token 不授予普通文档权限。
- 分享 token 访问结果必须强制 `can_edit=false`、`can_manage=false`、`can_comment=false`。

---

## 10. 审计与日志

建议新增一张 MCP 调用审计表：

- `mcp_audit_logs`

建议字段：

- `id`
- `actor_type`
  - `user`
  - `service`
- `actor_id`
- `tool_name`
- `target_type`
- `target_id`
- `request_payload`
- `response_status`
- `error_message`
- `created_at`

至少记录：

- 谁调用了什么工具
- 读了什么文档
- 改了什么文档
- 是否成功

---

## 11. 错误模型

MCP 返回应尽量结构化。

建议统一错误分类：

- `unauthenticated`
- `unauthorized`
- `not_found`
- `invalid_input`
- `conflict`
- `rate_limited`
- `internal_error`

避免把原始 traceback 直接暴露给客户端。

---

## 12. 与当前 CloudDoc 的集成建议

## 12.1 可直接复用的能力

当前项目里已经可以直接复用：

- 文档 service
- 评论 service
- 分享 service
- 当前用户解析
- 组织与成员模型
- 权限模型

这意味着 MCP 第一版不需要重写业务，只需要：

- 包装工具输入输出
- 统一身份
- 统一错误响应

## 12.2 推荐先不做的事

第一版不要做：

- 任意 SQL 查询
- 任意文件系统访问
- 批量危险写入
- 跨用户删除类工具
- 任意分享配置修改

原因：

- 这些能力一旦暴露给 Agent，风险高

---

## 13. 开发计划

### Phase 1：只读 MCP Server

实现：

- `apps/mcp` 骨架
- service token 鉴权
- 只读工具：
  - `list_documents`
  - `search_documents`
  - `get_document`
  - `get_comments`
  - `list_spaces`
  - `get_shared_document`

交付标准：

- AI 可以安全读取 CloudDoc 内容
- 所有权限仍由后端控制

### Phase 2：受控写入 MCP

实现：

- `create_document`
- `update_document_content`
- `delete_document`
- `restore_document`
- `create_comment`
- `reply_comment`
- `update_comment`
- `delete_comment`

交付标准：

- AI 能在 actor 自己创建或拥有的文档范围内进行有限增删改查
- 评论更新/删除只能操作 actor 自己写的评论
- 写入和删除全量审计

### Phase 3：知识工作流工具

实现：

- 文档总结
- 知识页创建
- 索引页更新
- 资料入库

交付标准：

- MCP 不只是“读写文档”，而是“维护知识系统”

---

## 14. 测试计划概要

### 14.1 鉴权测试

- 无 token 访问失败
- 过期 token 访问失败
- 权限不足时返回 `unauthorized`

### 14.2 文档读取测试

- 公开文档可读
- 私有文档未授权不可读
- 分享文档按 token / 密码规则访问

### 14.3 写入测试

- 无编辑权限时不能更新文档
- 分享文档永远不能写
- 评论权限正确生效

### 14.4 审计测试

- 每次 MCP 写入都有日志
- 错误调用也有失败记录

---

## 15. 结论

CloudDoc 适合做 MCP 接入，而且应尽快做，但应按以下顺序落地：

1. 先做只读 MCP
2. 再做受控写入
3. 最后做知识编译工作流

这样可以在控制安全风险的前提下，让 AI 真正接入 CloudDoc，而不是只停留在“外部调接口”层面。
