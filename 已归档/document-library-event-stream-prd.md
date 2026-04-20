# CloudDoc 文档库事件流 SSE 产品需求文档

更新日期：2026-04-17

## 1. 背景

当前 CloudDoc 前端主要依赖页面初始加载和用户本机操作后的 `router.refresh()` 获取最新数据。  
如果文档、文件夹、评论、权限等内容由其他浏览器窗口、其他用户、MCP、REST API 或后台任务修改，当前页面无法实时感知，用户必须手动刷新页面才能看到变化。

本需求目标是引入 Server-Sent Events，简称 SSE，作为“文档库事件流”能力，让前端可以实时收到后端变更事件，并只更新变更影响的局部 UI，而不是像 F5 一样刷新整个页面。

## 2. 目标

### 2.1 产品目标

- 文档库、文件树、列表、通知和评论入口能实时感知后端变更。
- 文档新增、改名、删除、移动后，前端对应列表和文件树局部更新。
- 文件夹新增、改名、删除、移动后，前端对应树节点局部更新。
- 评论新增、删除、状态变化后，当前文档评论侧栏或评论计数局部更新。
- 权限变化后，前端能及时更新用户可见内容和操作能力。
- 当前正在编辑的文档收到外部变更时，不自动覆盖用户草稿，而是提示用户有外部更新。

### 2.2 工程目标

- 不使用整页刷新。
- 默认不调用 `window.location.reload()`。
- 尽量避免用 `router.refresh()` 作为常规事件处理方式。
- 前端以客户端状态更新为主，只更新受影响的数据片段。
- 后端事件发布逻辑集中管理，避免各业务服务散落拼事件。
- 与现有 REST API、MCP、权限服务兼容。
- 为未来 WebSocket 协同编辑预留边界，但本期不做多人实时协同编辑。

## 3. 非目标

本期不做：

- 多人实时协同编辑。
- 实时光标。
- 实时选区。
- 文档正文操作级增量合并。
- CRDT 或 OT。
- WebSocket 双向编辑协议。

说明：

SSE 只负责从后端向前端推送“发生了什么变化”。  
真正的多人协同编辑需要 WebSocket + CRDT/OT 或自研协同协议，不应和文档库事件流混在一起实现。

## 4. 使用场景

### 4.1 文档库列表

用户停留在“我的文档”页面时：

- 另一个窗口创建文档，当前列表自动出现新文档。
- MCP 创建文档，当前列表自动出现新文档。
- 文档被删除，当前列表移除该文档。
- 文档标题变化，当前列表对应项标题更新。

### 4.2 文件夹树

用户停留在文件夹工作台时：

- 新增文件夹后，树上自动插入文件夹节点。
- 文件夹改名后，树上对应节点更新名称。
- 文档移动到其他文件夹后，树节点移动位置。
- 同级排序变化后，仅调整对应父级下的顺序。

### 4.3 当前文档页

用户正在查看文档时：

- 文档标题被其他入口修改，顶部标题更新。
- 评论新增，右侧评论栏出现新评论。
- 权限被收回，页面提示权限已变化，并禁用不可用操作。

用户正在编辑文档时：

- 收到同一文档外部内容变更，不自动覆盖编辑区。
- 显示提示：“文档已在其他地方更新，点击查看更新。”
- 用户可选择手动刷新文档内容或继续编辑。

### 4.4 通知

收到评论、提及、权限变更、分享访问等通知时：

- 侧边栏通知红点自动更新。
- 通知页如果已打开，列表局部插入新通知。

## 5. 事件类型设计

### 5.1 文档事件

- `document.created`
- `document.updated`
- `document.renamed`
- `document.deleted`
- `document.restored`
- `document.moved`
- `document.reordered`
- `document.content_updated`
- `document.permission_changed`

### 5.2 文件夹事件

- `folder.created`
- `folder.updated`
- `folder.renamed`
- `folder.deleted`
- `folder.moved`
- `folder.reordered`

### 5.3 评论事件

- `comment.thread_created`
- `comment.created`
- `comment.updated`
- `comment.deleted`
- `comment.resolved`
- `comment.reopened`

### 5.4 通知事件

- `notification.created`
- `notification.read`
- `notification.read_all`

### 5.5 系统事件

- `heartbeat`
- `permission.revoked`
- `connection.ready`

## 6. 事件负载设计

### 6.1 通用字段

每条事件都应包含：

- `event_id`
- `event_type`
- `occurred_at`
- `actor_id`
- `actor_name`
- `space_id`
- `document_id`
- `folder_id`
- `target_type`
- `target_id`
- `revision`

### 6.2 示例：文档新增

```json
{
  "event_id": "evt_001",
  "event_type": "document.created",
  "occurred_at": "2026-04-16T18:00:00+08:00",
  "actor_id": "user_001",
  "actor_name": "Demo Owner",
  "space_id": "space_001",
  "folder_id": "folder_001",
  "document_id": "doc_001",
  "target_type": "document",
  "target_id": "doc_001",
  "revision": 1,
  "document": {
    "id": "doc_001",
    "title": "新文档",
    "document_type": "doc",
    "folder_id": "folder_001",
    "sort_order": 100,
    "updated_at": "2026-04-16T18:00:00+08:00"
  }
}
```

### 6.3 示例：文档移动

```json
{
  "event_id": "evt_002",
  "event_type": "document.moved",
  "occurred_at": "2026-04-16T18:01:00+08:00",
  "actor_id": "user_001",
  "space_id": "space_001",
  "document_id": "doc_001",
  "target_type": "document",
  "target_id": "doc_001",
  "revision": 2,
  "from": {
    "folder_id": "folder_a",
    "sort_order": 10
  },
  "to": {
    "folder_id": "folder_b",
    "sort_order": 20
  }
}
```

### 6.4 示例：当前文档内容被外部更新

```json
{
  "event_id": "evt_003",
  "event_type": "document.content_updated",
  "occurred_at": "2026-04-16T18:02:00+08:00",
  "actor_id": "user_002",
  "actor_name": "Other User",
  "space_id": "space_001",
  "document_id": "doc_001",
  "target_type": "document",
  "target_id": "doc_001",
  "revision": 8,
  "content_updated": true
}
```

## 7. 后端设计

### 7.1 SSE 接口

新增接口：

- `GET /api/events/stream`

请求要求：

- 必须带当前登录态 cookie。
- 未登录用户默认不开放文档库事件流。
- 后续可考虑分享页只订阅分享 token 相关事件，但本期不做。

响应：

- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`
- `Connection: keep-alive`

### 7.2 事件格式

SSE 输出示例：

```text
id: evt_001
event: document.created
data: {"event_id":"evt_001","event_type":"document.created","document":{"id":"doc_001","title":"新文档"}}

```

### 7.3 事件发布服务

新增服务：

- `event_stream_service.py`

职责：

- 生成事件 ID。
- 判断事件可见范围。
- 写入可选事件日志。
- 向在线连接发布事件。
- 提供 heartbeat。

业务服务只调用统一函数：

- `publish_document_event(...)`
- `publish_folder_event(...)`
- `publish_comment_event(...)`
- `publish_notification_event(...)`

### 7.4 事件可见性

事件必须经过权限过滤。

用户只能收到：

- 自己有权访问的文档事件。
- 自己有权访问的文件夹事件。
- 发给自己的通知事件。
- 与自己当前权限相关的权限变更事件。

不能因为 SSE 推送泄露：

- 私有文档标题。
- 私有文件夹名称。
- 他人评论内容。
- 没有权限的文档 ID。

### 7.5 断线恢复

首版实现：

- 前端断线后自动重连。
- 后端每 25 秒发送 `heartbeat`。
- 不保证历史事件补偿。

后续增强：

- 支持 `Last-Event-ID`。
- 事件短期落库。
- 断线后补发未消费事件。

### 7.6 横向扩展预留

单进程开发环境可用内存订阅列表。

生产环境需要预留：

- PostgreSQL `LISTEN/NOTIFY`
- Redis Pub/Sub
- 消息队列

首版建议：

- 先实现内存事件总线。
- 事件日志表作为后续断线补偿和审计基础。

## 8. 前端设计

### 8.1 连接管理

新增前端模块：

- `useDocumentEventStream`
- `document-event-store`

职责：

- 建立 `EventSource`。
- 监听连接状态。
- 自动重连。
- 分发事件到不同页面 store。
- 避免重复处理同一个 `event_id`。

### 8.2 局部更新原则

收到 SSE 事件后：

- 不调用 `window.location.reload()`。
- 默认不调用 `router.refresh()`。
- 能直接修改客户端状态的，直接局部更新。
- 如果当前页面没有对应状态缓存，再标记“有更新”，让用户主动刷新。

### 8.3 文件树更新

文件树应维护客户端状态：

- `folders`
- `documents`
- `expandedFolderIds`
- `selectedFolderId`
- `selectedDocumentId`

事件处理：

- `document.created`：插入对应文件夹。
- `document.renamed`：更新标题。
- `document.deleted`：移除节点。
- `document.moved`：从旧文件夹移除，插入新文件夹。
- `document.reordered`：只重排同一个父级下的节点。
- `folder.created`：插入文件夹节点。
- `folder.renamed`：更新文件夹名称。
- `folder.deleted`：移除文件夹节点。
- `folder.moved`：移动文件夹节点。

### 8.4 列表页更新

文档列表页应维护列表状态。

事件处理：

- 当前筛选条件匹配时插入或更新。
- 当前筛选条件不匹配时忽略。
- 删除或移动导致不匹配时移除。

### 8.5 文档页更新

阅读模式：

- 标题、状态、评论、权限能力可以局部更新。
- 正文内容如果收到 `document.content_updated`，可静默拉取最新文档内容并替换。

编辑模式：

- 不自动替换正文内容。
- 显示外部更新提示。
- 用户可点击“查看更新”或“稍后处理”。

### 8.6 通知更新

收到 `notification.created`：

- 侧边栏未读数 +1。
- 通知页已打开时，列表顶部插入通知。

收到 `notification.read`：

- 更新对应通知状态。
- 未读数 -1。

收到 `notification.read_all`：

- 清空未读数。
- 当前通知页全部置为已读。

## 9. 数据模型建议

### 9.1 event_logs

首版可选，但建议建立，方便排查问题和后续断线补偿。

字段：

- `id UUID PRIMARY KEY`
- `event_type VARCHAR(64) NOT NULL`
- `actor_id UUID NULL`
- `space_id UUID NULL`
- `document_id UUID NULL`
- `folder_id UUID NULL`
- `target_type VARCHAR(32) NOT NULL`
- `target_id UUID NULL`
- `payload JSONB NOT NULL`
- `visible_user_ids JSONB NULL`
- `created_at TIMESTAMPTZ NOT NULL`

### 9.2 是否必须落库

首版可以不依赖落库实现实时推送。

建议：

- 开发第一阶段用内存事件总线。
- 同时保留 `event_logs` 表结构。
- 后续实现 `Last-Event-ID` 补偿时再强依赖事件日志。

## 10. API 变更点

新增：

- `GET /api/events/stream`

可选新增：

- `GET /api/events/recent?after_id=...`

现有接口需要发布事件：

- 新建文档。
- 保存文档。
- 修改标题。
- 删除文档。
- 恢复文档。
- 移动文档。
- 重排文档。
- 新建文件夹。
- 修改文件夹。
- 删除文件夹。
- 移动文件夹。
- 重排文件夹。
- 新增评论。
- 删除评论。
- 更新评论状态。
- 创建通知。
- 标记通知已读。

## 11. 权限与安全

### 11.1 鉴权

SSE 连接必须绑定当前用户。

要求：

- 使用现有 session cookie。
- 连接建立时校验用户。
- 用户失效时关闭连接。

### 11.2 事件过滤

事件发布前或发送前必须过滤。

不能发送：

- 用户无权访问的文档信息。
- 用户无权访问的文件夹信息。
- 他人私有空间信息。
- 未授权评论内容。

### 11.3 权限变更

如果用户权限被收回：

- 发送 `permission.revoked`。
- 前端移除对应文档或文件夹。
- 当前正在查看无权限文档时显示权限失效提示。

## 12. 降级策略

如果 SSE 不可用：

- 前端显示非阻塞提示：“实时连接已断开，数据可能不是最新。”
- 自动重连。
- 重连失败超过阈值后，降级为 30 秒轮询关键列表。

如果后端不可用：

- 保持当前已有“后端接口不可用”提示。
- 不清空已有页面数据。

## 13. 开发计划

### Phase 1：后端事件流基础

交付：

- `GET /api/events/stream`
- 内存事件总线。
- heartbeat。
- session 鉴权。
- 基础事件 schema。

验收：

- 浏览器可建立 SSE 连接。
- 后端可推送 heartbeat。
- 未登录用户不能订阅。

### Phase 2：文档与文件夹事件

交付：

- 文档新增、更新、删除、恢复、移动、排序事件。
- 文件夹新增、更新、删除、移动、排序事件。
- 事件权限过滤。

验收：

- 另一个窗口创建文档，当前文件树自动出现。
- 另一个窗口删除文档，当前文件树自动移除。
- 移动文档后只影响对应文件夹。

### Phase 3：前端局部状态更新

交付：

- `useDocumentEventStream`。
- 文件树局部更新。
- 文档列表局部更新。
- 通知未读数局部更新。

验收：

- 不整页刷新。
- 不丢失当前展开的文件夹。
- 不丢失当前滚动位置。
- 不影响正在编辑的文档输入焦点。

### Phase 4：当前文档页事件

交付：

- 阅读模式收到正文更新后局部拉取并替换。
- 编辑模式收到正文更新后展示外部更新提示。
- 评论事件实时更新右侧评论栏。
- 权限收回事件实时禁用操作或退出页面。

验收：

- 编辑时不被外部事件打断输入。
- 阅读时可以看到最新评论。
- 权限被收回后不能继续操作。

### Phase 5：断线恢复增强

交付：

- `event_logs`。
- `Last-Event-ID`。
- 短期事件补偿。

验收：

- 短暂断线重连后能补齐事件。
- 重复事件不会重复插入列表。

## 14. 自动化测试计划

### 14.1 后端测试

- 未登录访问 SSE 被拒绝。
- 登录用户可建立事件流。
- heartbeat 正常输出。
- 文档创建时发布 `document.created`。
- 文档移动时发布 `document.moved`。
- 无权限用户收不到私有文档事件。
- 权限收回时发布 `permission.revoked`。

### 14.2 前端单元测试

- 事件 reducer 插入文档。
- 事件 reducer 更新文档标题。
- 事件 reducer 移动文档。
- 事件 reducer 删除文档。
- 重复 `event_id` 不重复处理。
- 当前编辑文档收到内容更新时只显示提示。

### 14.3 浏览器自动化测试

- 打开两个浏览器上下文。
- A 创建文档，B 文件树局部出现新文档。
- A 重命名文档，B 文件树标题更新。
- A 移动文档，B 文件树节点移动。
- A 删除文档，B 文件树节点消失。
- B 当前编辑文档时，A 保存同一文档，B 不丢焦点，只显示外部更新提示。

## 15. 当前实现状态

截至 2026-04-17，已完成首版 SSE 文档库事件流：

- 后端新增 `GET /api/events/stream`，使用登录态鉴权，返回 `text/event-stream`，并提供 `connection.ready` 和 25 秒心跳。
- 后端新增集中事件服务和 `event_logs` 表，文档、文件夹、评论、通知、权限变更均通过统一函数发布事件。
- 文档和文件夹事件已接入创建、更新、删除、恢复、移动、排序、正文更新、权限变更等关键写路径。
- 文件夹工作台已使用客户端状态处理文档/文件夹事件，避免整页刷新，并保留已展开节点状态。
- 文档页已监听正文外部更新、权限变更和评论事件；编辑模式下不会覆盖本地草稿，只展示外部更新提示。
- 通知已接入 `notification.created`、`notification.read`、`notification.read_all`；侧边栏未读角标和通知页列表可局部更新。
- 已补充自动化测试覆盖未登录 SSE 拒绝、SSE heartbeat 编码、通知事件落库和目标用户过滤。

仍作为后续增强项：

- `Last-Event-ID` 断线补偿。
- 事件去重 store 和统一前端 `useDocumentEventStream` 抽象。
- 多进程生产环境 Redis Pub/Sub 或 PostgreSQL LISTEN/NOTIFY。
- 跨浏览器的端到端 SSE 自动化用例。

## 16. 风险与约束

### 16.1 多进程部署

内存事件总线只适合单进程开发环境。  
生产多进程或多机器部署必须引入 Redis Pub/Sub、PostgreSQL LISTEN/NOTIFY 或消息队列。

### 16.2 事件乱序

前端必须使用 `revision` 或 `updated_at` 判断新旧，避免旧事件覆盖新状态。

### 16.3 正文冲突

SSE 不解决正文编辑冲突。  
编辑模式收到外部正文更新时只能提示，不能自动合并。

### 16.4 权限泄漏

事件负载必须经过权限过滤。  
尤其是文档标题、文件夹名称、评论内容都可能是敏感信息。

## 17. 结论

CloudDoc 应先实现 SSE 文档库事件流，解决“后端变更前端必须刷新才知道”的问题。  
该能力应聚焦文档库、文件树、列表、评论、通知和权限感知，使用局部状态更新，不做整页刷新，不做多人协同编辑。

推荐优先级：

1. 后端 SSE 基础连接和 heartbeat。
2. 文档/文件夹事件发布与权限过滤。
3. 前端文件树和列表局部更新。
4. 当前文档页外部更新提示。
5. 断线补偿与生产级消息总线。

## 18. 2026-04-17 删除事件补充

### 18.1 问题

用户在同一浏览器的一个标签页删除文档后，另一个标签页如果停留在该文档详情页，页面不会自动离开；如果 SSE 连接因后台标签页节流、临时断线或认证状态异常而未收到事件，列表页也可能短时间保留已删除文档。

### 18.2 处理规则

- 文档详情页必须监听 `document.deleted`。
- 当前打开的文档收到删除事件后，应关闭删除确认框和分享弹窗，退出编辑态，并自动跳转到父文件夹；没有父文件夹时跳转到当前空间文档列表。
- 文档列表、首页、最近访问、收藏、文件夹工作台继续通过 SSE 局部移除已删除文档，不做整页刷新。
- 同浏览器多标签页增加 `BroadcastChannel` + `localStorage` 兜底广播。当前标签页删除成功后，其他同源标签页即使 SSE 暂时不可用，也应立即移除该文档或跳转离开详情页。

### 18.3 边界

- BroadcastChannel 只作为同浏览器标签页兜底，不替代后端 SSE。
- 跨浏览器、跨设备仍依赖 SSE。
- 分享只读页不允许编辑，也不需要通过广播执行删除跳转。

## 19. 2026-04-20 3100 开发服务器 SSE 代理修正

### 19.1 问题

前端页面通过 `http://127.0.0.1:3100/api/events/stream` 建立 SSE 连接。

原实现依赖 Next.js 通用 rewrite 将 `/api/:path*` 转发到后端 `8000`，但该路径对 `text/event-stream` 存在缓冲或阻塞风险：后端 `8000/api/events/stream` 可以立即收到 `connection.ready` 和 `document.deleted`，而 `3100/api/events/stream` 不会实时下发事件。

这会导致用户在一个标签页删除文档后，另一个标签页仍显示旧文档或旧目录项，直到手动刷新才消失。

### 19.2 处理规则

- SSE 不再走通用 rewrite。
- Web 层必须提供专用 `/api/events/stream` route handler。
- 该 route handler 只做协议透传：转发 cookie、请求后端 `/api/events/stream`、直接返回后端 `ReadableStream`。
- 响应头必须保持流式语义：`Content-Type: text/event-stream`、`Cache-Control: no-cache, no-transform`、`Connection: keep-alive`、`X-Accel-Buffering: no`。
- 其他 REST API 继续走通用 rewrite，不受影响。

### 19.3 验收标准

- 通过 `3100/api/events/stream` 可以立即收到 `connection.ready`。
- 通过 `3100/api/events/stream` 订阅后，在另一个请求删除文档，可以立即收到 `document.deleted`。
- 前端仍使用相对地址 `/api/events/stream`，保证未来通过 Nginx 或其他网段代理访问时不需要改后端地址。
