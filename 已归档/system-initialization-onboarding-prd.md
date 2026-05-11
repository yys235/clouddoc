# CloudDoc 首次部署系统初始化引导 PRD

## 1. 背景

CloudDoc 当前已经具备完整的本地部署能力，但首次部署体验仍偏工程化：

- 部署者需要自己理解 `.env`、数据库连接、后端启动、前端启动、MCP 服务等步骤。
- 空数据库启动后，系统会依赖后端运行态建表和开发示例数据种子逻辑，生产环境边界不够清晰。
- 首个管理员、组织、空间、默认文件夹、公开访问策略、AI/MCP 开关等核心配置缺少可视化确认。
- 部署成功和系统可用之间没有明确的状态提示，普通用户容易误以为“页面能打开就是配置完成”。

因此需要增加“首次部署系统初始化引导”，让新部署者在第一次打开系统时，通过向导完成最小可用生产配置。

## 2. 产品定位

首次部署系统初始化引导，是 CloudDoc 在空库或未初始化状态下的系统级 onboarding 流程。

它的目标不是替代运维脚本，而是把“首次可用配置”变成安全、可检查、可恢复的一次性产品流程：

- 确认系统依赖是否正常。
- 创建第一个系统管理员。
- 创建默认组织、空间和根目录。
- 配置基础安全策略。
- 可选启用示例数据、AI/MCP、开放 API、上传存储等能力。
- 初始化完成后锁定向导，后续只能在管理员后台修改配置。

## 3. 目标

### 3.1 首版目标

- 空库首次访问时自动进入初始化向导。
- 初始化前普通业务页面不可访问，只显示初始化状态和引导入口。
- 支持创建首个系统管理员账号。
- 支持创建默认组织和默认空间。
- 支持选择是否导入示例文档。
- 支持显示数据库、上传目录、API、前端代理、MCP 可选项的健康检查结果。
- 初始化完成后写入系统初始化状态，禁止重复初始化。
- 初始化操作全程有审计记录。

### 3.2 中期目标

- 支持管理员后台查看初始化摘要。
- 支持初始化后补配邮件、对象存储、AI Provider、MCP 服务地址。
- 支持部署诊断页面，帮助排查 Nginx、上传路径、SSE、MCP 连接问题。
- 支持通过环境变量启用“无人值守初始化”。

### 3.3 长期目标

- 支持多租户部署模板。
- 支持企业部署检查清单和合规配置导出。
- 支持 Kubernetes/Docker Compose 健康状态联动。

## 4. 非目标

首版不做以下内容：

- 不做完整安装器，不负责安装 PostgreSQL、Node.js、Python。
- 不直接修改服务器文件系统中的 `.env`。
- 不自动生成公网 TLS 证书。
- 不做完整邮件服务配置向导。
- 不做复杂 LDAP/SSO 接入。
- 不做组织级复杂权限模板。
- 不支持已有生产库的破坏性重置。

## 5. 用户角色

### 5.1 部署者

负责第一次部署 CloudDoc，可能是开发者、个人用户或小团队管理员。

核心诉求：

- 知道系统是否部署成功。
- 不需要直接理解所有数据库和后端细节。
- 能快速创建管理员并进入系统。

### 5.2 系统管理员

初始化完成后的第一个超级管理员。

核心诉求：

- 能管理组织、空间、用户、安全策略和 AI 接入。
- 能看到初始化时选择了哪些配置。

### 5.3 普通用户

初始化完成后被邀请或注册进入系统。

核心诉求：

- 不会看到部署配置页面。
- 只进入正常文档系统。

## 6. 触发条件

系统需要根据后端状态判断是否进入初始化模式。

进入初始化模式的条件：

- 数据库连接正常。
- `system_settings.initialized` 不存在或为 `false`。
- 不存在任何 `is_super_admin = true` 的启用用户。

不进入初始化模式的条件：

- 系统已初始化。
- 已存在启用的超级管理员。
- 环境变量显式禁用 Web 初始化。

异常状态：

- 数据库不可连接：前端显示部署诊断错误，不进入创建管理员步骤。
- schema 不完整：后端尝试运行建表/运行态补丁；失败则显示错误详情和日志建议。
- 检测到历史 demo 数据但未初始化：允许向导选择“保留 demo 数据并转为正式空间”或“清理 demo 数据”。

## 7. 核心用户流程

### 7.1 首次访问

1. 用户打开 `http://host:3100`。
2. 前端请求 `GET /api/system/bootstrap/status`。
3. 如果返回 `initialized=false`，跳转到 `/setup`。
4. `/setup` 页面展示部署检查结果和初始化步骤。

### 7.2 初始化步骤

步骤一：系统检查

- 数据库连接状态。
- 当前 schema 版本。
- 上传目录可写状态。
- 后端 API 地址。
- 前端代理 `/api` 状态。
- SSE 事件流状态。
- MCP 服务状态，首版可标记为可选。

步骤二：创建系统管理员

- 姓名。
- 邮箱。
- 密码。
- 确认密码。
- 可选：是否允许公开注册。

步骤三：创建组织与空间

- 组织名称。
- 默认空间名称。
- 默认空间可见性：私有 / 组织内可见。
- 默认文件夹结构：
  - `newdoc`
  - `clouddoc`
  - 可选示例目录。

步骤四：基础安全策略

- 是否允许公开文档。
- 是否允许创建分享链接。
- 分享链接默认是否需要密码。
- 是否允许游客读取公开文档。
- 是否启用 demo 账号。

步骤五：可选能力

- 是否导入示例文档。
- 是否启用 MCP 服务提示。
- 是否启用开放 API 管理页面。
- 是否允许用户创建 Personal Access Token。
- 是否启用上传目录检查。

步骤六：确认并执行

- 显示初始化摘要。
- 二次确认“创建首个管理员并锁定初始化向导”。
- 执行初始化事务。
- 成功后跳转登录或直接建立管理员会话进入工作台。

## 8. 功能需求

### 8.1 初始化状态接口

新增接口：

```text
GET /api/system/bootstrap/status
```

返回：

- `initialized`
- `needs_setup`
- `has_super_admin`
- `database_ok`
- `schema_ok`
- `uploads_ok`
- `api_version`
- `setup_allowed`
- `checks[]`

接口必须允许未登录访问，但不能暴露敏感连接字符串和服务器路径完整值。

### 8.2 初始化提交接口

新增接口：

```text
POST /api/system/bootstrap/initialize
```

请求内容：

- 管理员信息。
- 组织/空间信息。
- 安全策略。
- 示例数据选择。
- 可选能力开关。
- 初始化确认 token。

执行规则：

- 必须在数据库事务中完成。
- 创建首个用户并设置 `is_super_admin = true`。
- 创建默认组织、成员关系、空间、根文件夹。
- 创建系统设置记录。
- 创建初始化审计记录。
- 如果任意步骤失败，整体回滚。
- 如果系统已初始化，返回 `409 Conflict`。

### 8.3 初始化访问保护

初始化完成前：

- `/setup` 可访问。
- `/api/system/bootstrap/status` 可访问。
- `/api/system/bootstrap/initialize` 可访问。
- 其他业务 API 返回 `423 Locked` 或结构化错误 `system_not_initialized`。
- 前端业务页面统一跳转 `/setup`。

初始化完成后：

- `/setup` 显示“系统已初始化”，提供返回首页按钮。
- 初始化提交接口返回 `409 Conflict`。

### 8.4 安全机制

首版必须至少满足：

- 初始化只能在未初始化状态执行。
- 如果存在超级管理员，禁止再次初始化。
- 可配置 `CLOUDDOC_SETUP_TOKEN`，配置后提交初始化必须输入 token。
- 未配置 token 时，仅允许本机访问或显示明确安全警告。
- 管理员密码必须满足最低强度。
- 初始化接口限流，防止暴力尝试。
- 初始化日志不能记录管理员明文密码。

### 8.5 Demo 数据策略

需要把当前开发态 demo seed 和生产初始化拆开：

- 开发环境允许自动创建 demo 用户和示例文档。
- 生产环境默认不自动创建 demo 用户。
- 初始化向导提供“导入示例数据”选项。
- 如果导入示例数据，示例数据归属于首个管理员和默认组织。
- MCP guest 用户仍可自动存在，但必须无组织成员身份、无私有文档权限。

### 8.6 系统设置

建议新增 `system_settings` 表或等价配置存储。

字段建议：

- `id`
- `initialized`
- `initialized_at`
- `initialized_by`
- `product_name`
- `allow_public_documents`
- `allow_share_links`
- `share_password_required_by_default`
- `allow_guest_public_read`
- `allow_user_pat`
- `allow_open_api`
- `allow_demo_data`
- `schema_version`
- `created_at`
- `updated_at`

### 8.7 审计记录

建议新增 `system_audit_logs` 表，或复用统一审计表。

初始化时记录：

- `system.bootstrap.initialized`
- actor 类型：`setup`
- 创建的管理员 ID。
- 创建的组织 ID。
- 创建的空间 ID。
- 是否导入示例数据。
- 请求 IP 和 user agent。

## 9. 页面设计

### 9.1 `/setup` 页面结构

整体风格应和当前专业化云文档 UI 一致：

- 左侧：CloudDoc 标识、初始化步骤导航、当前状态。
- 中间：当前步骤表单。
- 右侧：部署检查摘要和帮助说明。
- 移动端：步骤纵向排列，检查摘要折叠。

### 9.2 视觉原则

- 不使用大圆角卡片，保持当前项目要求的专业、紧凑风格。
- 错误状态直接显示可操作建议。
- 成功状态显示明确下一步。
- 敏感项只显示状态，不显示完整密钥或连接串。

### 9.3 关键状态

- 数据库不可用：红色错误，阻断下一步。
- schema 可自动修复：黄色提示，允许重试。
- 上传目录不可写：黄色提示，允许跳过但提醒图片/PDF 可能不可用。
- MCP 未启动：灰色可选提示，不阻断初始化。
- 已初始化：显示只读完成页。

## 10. 后端设计

### 10.1 服务拆分

新增服务建议：

- `system_service.py`
  - `get_bootstrap_status`
  - `initialize_system`
  - `ensure_system_settings`
  - `assert_system_initialized`

- `health_service.py`
  - `check_database`
  - `check_schema`
  - `check_uploads`
  - `check_event_stream`
  - `check_mcp_optional`

### 10.2 中间件

新增系统初始化保护中间件：

- 对未初始化系统拦截普通业务 API。
- 放行 health、bootstrap、静态上传读取、登录页必要接口。
- 返回统一错误结构，前端可识别跳转。

### 10.3 与现有启动逻辑关系

现有逻辑：

- `Base.metadata.create_all`
- `ensure_runtime_schema`
- `ensure_mcp_guest_user`
- `seed_demo_data`

调整建议：

- 保留 `create_all` 和 `ensure_runtime_schema`。
- `ensure_mcp_guest_user` 保留，但确保无权限。
- `seed_demo_data` 改为只在开发环境或初始化向导选择示例数据时执行。
- 新增 `ensure_system_settings`，如果不存在则创建 `initialized=false`。

## 11. 前端设计

### 11.1 路由

新增页面：

```text
/setup
```

新增前端 API：

- `fetchBootstrapStatus`
- `initializeSystem`

### 11.2 全局处理

当业务 API 返回 `system_not_initialized`：

- 服务端渲染页面应跳转 `/setup`。
- 客户端请求应显示初始化提示并跳转。
- 不应显示“数据丢失”类错误。

### 11.3 表单交互

- 每一步保存到本地组件状态，不提前落库。
- 最后一步统一提交。
- 后端返回字段级错误时定位到对应步骤。
- 提交按钮必须有 loading 状态和防重复提交。

## 12. 权限规则

初始化前：

- 没有普通用户权限体系。
- 只有 bootstrap 流程可执行。

初始化后：

- 首个管理员拥有超级管理员权限。
- 管理员可进入个人配置/系统配置页面。
- 普通用户不能访问初始化状态详情中的敏感检查项。

## 13. 配置项

建议新增环境变量：

```env
CLOUDDOC_ENV=development|production
CLOUDDOC_SETUP_ENABLED=true
CLOUDDOC_SETUP_TOKEN=
CLOUDDOC_AUTO_SEED_DEMO=false
```

默认策略：

- development：允许自动 demo seed。
- production：不自动 demo seed，必须走初始化向导。
- 如果 `CLOUDDOC_SETUP_ENABLED=false` 且未初始化，API 返回明确错误，提示使用 CLI 初始化。

## 14. CLI 初始化补充

为无人值守部署预留 CLI：

```bash
uv run python -m app.cli init-system \
  --admin-email admin@example.com \
  --admin-name Admin \
  --organization "CloudDoc" \
  --space "产品空间"
```

首版可以先只做 Web 初始化，CLI 作为后续阶段。

## 15. API 返回示例

### 15.1 status

```json
{
  "initialized": false,
  "needs_setup": true,
  "has_super_admin": false,
  "database_ok": true,
  "schema_ok": true,
  "uploads_ok": true,
  "setup_allowed": true,
  "checks": [
    {"key": "database", "status": "ok", "message": "PostgreSQL connected"},
    {"key": "schema", "status": "ok", "message": "Schema is ready"},
    {"key": "mcp", "status": "optional", "message": "MCP service not checked"}
  ]
}
```

### 15.2 initialized response

```json
{
  "initialized": true,
  "admin_user_id": "uuid",
  "organization_id": "uuid",
  "space_id": "uuid",
  "next_url": "/documents"
}
```

## 16. 验收标准

### 16.1 空库首启

- 空库启动后访问首页自动进入 `/setup`。
- `/setup` 能展示数据库和 schema 检查结果。
- 完成向导后创建管理员、组织、空间和根目录。
- 初始化完成后进入正常文档系统。

### 16.2 重复初始化防护

- 初始化完成后再次访问 `/setup` 不能重新提交。
- 再次调用初始化 API 返回 `409 Conflict`。
- 如果数据库已有超级管理员，即使 `system_settings` 丢失，也不允许无确认重建初始化。

### 16.3 安全

- 未初始化状态下业务 API 不泄露文档数据。
- 管理员密码不进入日志。
- setup token 配置后，错误 token 无法初始化。
- 初始化审计记录存在。

### 16.4 兼容

- 已有开发环境 demo 流程不被破坏。
- 当前 `guest@clouddoc.local` 仍保持无权限。
- MCP/Open API 表和权限体系不受影响。

## 17. 测试计划

### 17.1 后端测试

- 空库 `GET /api/system/bootstrap/status` 返回 `needs_setup=true`。
- 初始化成功后生成 admin、organization、space、folder、system_settings。
- 重复初始化返回 409。
- setup token 缺失/错误返回 403。
- 初始化前普通文档 API 返回 `system_not_initialized`。
- 初始化后普通 API 恢复正常。
- demo seed 只在开发环境或显式选择时执行。

### 17.2 前端测试

- 未初始化访问 `/documents` 自动跳转 `/setup`。
- setup 多步骤表单可填写和返回修改。
- 数据库错误时阻断下一步。
- 上传目录警告不阻断。
- 初始化提交 loading 防重复点击。
- 初始化完成跳转 `/documents`。

### 17.3 自动化浏览器测试

- 启动临时测试库。
- 打开首页。
- 完成初始化表单。
- 登录/进入系统。
- 创建一篇文档验证系统可用。
- 刷新后确认不再进入 setup。

## 18. 实施拆分

### 阶段一：后端状态与数据模型

- 新增 `system_settings`。
- 新增系统初始化状态接口。
- 新增初始化事务服务。
- 调整 demo seed 策略。
- 补齐测试。

### 阶段二：Web 初始化页面

- 新增 `/setup`。
- 新增步骤表单和状态检查 UI。
- 接入初始化提交接口。
- 处理未初始化 API 错误跳转。

### 阶段三：安全与部署体验

- 增加 setup token 校验。
- 增加初始化审计。
- 增加 README 部署说明。
- 增加生产/开发环境配置差异说明。

### 阶段四：可选增强

- CLI 初始化。
- 邮件/对象存储/AI Provider 配置向导。
- 初始化摘要后台页面。

## 19. 风险与处理

### 19.1 误判未初始化

风险：老库缺少 `system_settings`，但已有真实用户。

处理：只要存在超级管理员或真实用户数据，不能直接进入可破坏初始化；需要提示管理员执行迁移确认。

### 19.2 生产环境 demo 数据

风险：生产首启自动创建 demo 用户。

处理：拆分 demo seed 和生产初始化，生产默认禁用 demo。

### 19.3 初始化中断

风险：初始化执行到一半失败。

处理：初始化必须事务化，失败回滚。

### 19.4 安全暴露

风险：公网部署后任何人先打开系统并创建管理员。

处理：生产环境强烈建议配置 `CLOUDDOC_SETUP_TOKEN`；未配置时显示高风险提示，并可限制本机/内网初始化。

## 20. 当前项目适配结论

CloudDoc 现在已经具备实现该 PRD 的基础：

- 数据库基线 SQL 已补齐。
- 后端已有用户、组织、空间、文件夹、权限模型。
- 前端已有 API 不可用状态处理和全局布局。
- MCP guest 用户无权限策略已经明确。

下一步开发重点不是大规模重构，而是把现有启动/seed 逻辑收束成明确的初始化状态机，并提供 `/setup` 可视化流程。

## 21. 实施状态（2026-05-08）

### 21.1 已完成

- 新增 `system_settings` 和 `system_audit_logs` 数据模型。
- 更新运行态 schema 补丁和 `apps/api/sql/001_init.sql` 基线脚本。
- 新增 `GET /api/system/bootstrap/status` 初始化状态接口。
- 新增 `POST /api/system/bootstrap/initialize` 初始化提交接口。
- 初始化接口支持创建首个超级管理员、默认组织、默认空间、`newdoc` 与 `clouddoc` 根文件夹。
- 初始化接口支持基础安全策略、开放 API、Personal Access Token、示例数据开关字段。
- 新增初始化审计记录 `system.bootstrap.initialized`。
- 选择导入示例数据时，会在默认 `clouddoc` 文件夹下创建 `CloudDoc 使用示例` 文档。
- 新增 API 初始化保护中间件，未初始化时普通业务 API 返回 `423 system_not_initialized`。
- development 环境保留自动 demo seed，demo 用户升级为超级管理员并写入已初始化状态，避免破坏本地开发体验。
- production 环境默认不自动 seed demo，空库会进入初始化向导。
- 新增前端 `/setup` 页面，包含系统检查、管理员、组织空间、安全策略、可选能力、确认执行六步。
- 新增 Next middleware，未初始化访问普通页面时自动跳转 `/setup`。
- 新增 `python -m app.cli init-system` 无人值守初始化命令，适合 Docker/CI/运维脚本部署。
- 新增 `GET /api/system/settings` 超级管理员系统初始化摘要接口。
- 个人配置页对超级管理员显示初始化状态、初始化管理员、系统策略和最近系统审计。
- README 已增加首次部署初始化说明和生产环境 setup token 建议。

### 21.2 已验证

- `001_init.sql` 通过 SQLAlchemy/psycopg 事务内执行并回滚校验。
- 初始化 API 专项测试通过。
- CLI 初始化专项测试通过。
- 完整 API 测试通过。
- 前端 `next build` 通过。
- 真实 Chrome/Playwright smoke 验证 `/setup` 和 `/documents` 正常渲染。

### 21.3 后续增强

- 邮件、对象存储、AI Provider 的初始化后补配页面仍未实现。
- 初始化页面目前是首版功能型 UI，后续可继续优化诊断详情和部署帮助文案。
