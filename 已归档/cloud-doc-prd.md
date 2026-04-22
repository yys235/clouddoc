# 在线云文档产品设计文档

## 文档说明

本文档包含两部分内容：
- 飞书文档可直接粘贴版
- 可开发版 PRD

当前版本基于以下产品范围：
- V1 不做实时协同编辑
- V1 仅支持云文档，不支持多维表格和电子表格
- 系统底层需预留多文档类型扩展能力

---

## 第一部分：飞书文档可直接粘贴版

## 1. 项目背景

当前在线云文档产品已经从“在线编辑工具”演进为“内容创作、知识沉淀、权限管理、组织协作”的基础设施。飞书云文档、Notion、Google Docs、石墨文档等产品都证明，文档系统不仅是编辑器，更是团队信息管理入口。

本项目计划建设一款在线云文档产品。第一版本不追求实时协同编辑，而是优先实现完整的云文档产品闭环，包括文档创建、编辑、管理、权限、分享、搜索、版本、模板等核心能力。同时，系统底层需预留多文档类型扩展能力，为后续支持表格、白板、表单等类型做好架构准备。

## 2. 产品定位

一款面向个人与团队的在线云文档产品，支持文档创作、文档管理、知识沉淀、分享与权限控制。V1 聚焦单一“文本文档”类型，不做实时协同，但产品架构需支持未来拓展为多文档类型平台。

## 3. 产品目标

V1 的目标如下：
- 提供完整的云文档产品能力闭环
- 支持个人空间与团队空间
- 支持富文本编辑、模板、历史版本、全文搜索、分享与权限
- 不做实时协同编辑
- 底层设计支持未来扩展为多文档类型平台

## 4. 目标用户

- 中小团队成员
- 个人知识管理用户
- 产品、研发、运营、人事、行政等需要经常编写和沉淀文档的角色
- 需要统一存放制度文档、项目文档、会议纪要、方案文档的团队

## 5. 核心使用场景

- 用户创建和编辑日常工作文档
- 用户使用模板快速生成会议纪要、需求文档、周报等内容
- 团队在空间中沉淀知识文档
- 管理员统一管理文档访问权限
- 用户通过搜索快速定位文档内容
- 用户通过历史版本回溯和恢复误修改内容
- 用户通过分享链接将文档发送给内部或外部读者

## 6. 产品范围

### 6.1 V1 必做

- 登录注册
- 个人空间、团队空间
- 富文本编辑器
- 文档新建、编辑、移动、删除、复制
- 文件夹/目录树
- 收藏、最近访问、回收站
- 模板中心
- 文档分享
- 文档权限控制
- 全文搜索
- 导入导出
- 文档类型字段与平台化扩展设计
- 版本数据模型预留与自动保存快照沉淀

### 6.2 V1 不做

- 多人实时协同编辑
- 历史版本查询、预览、对比和恢复功能入口
- 多维表格
- 电子表格
- 白板
- 幻灯片
- AI 功能
- 即时消息联动
- 自动化工作流
- 开放 API

## 7. 核心功能需求

### 7.1 账号与空间

- 支持邮箱或手机号注册登录
- 支持创建个人空间
- 支持创建团队空间
- 支持团队成员加入与退出
- 支持基础角色：所有者、管理员、成员、访客

### 7.2 文档编辑器

- 支持标题与正文编辑
- 支持标题层级
- 支持加粗、斜体、下划线、删除线
- 支持无序列表、有序列表、任务列表
- 支持引用、代码块、分割线
- 支持图片、表格块、超链接
- 支持文档大纲
- 支持快捷命令输入 `/`
- 支持自动保存
- 支持编辑器内插入模板内容

编辑器模型说明：
- 表现层采用连续文档式阅读与编辑体验，整体风格对齐飞书云文档
- 交互层支持段落、标题、列表、图片、表格、代码块等块级操作
- 存储层采用结构化文档树，不使用单一 HTML 或 Markdown 大字符串作为唯一内容源
- 首版不做强卡片化、强积木化的 Notion 式块表现

### 7.3 文档管理

- 新建文档
- 复制文档
- 删除文档
- 恢复回收站文档
- 移动文档到文件夹或空间
- 收藏文档
- 查看最近访问文档
- 支持文档树状组织结构
- 支持父子页面关系

### 7.4 模板中心

- 提供空白文档模板
- 提供会议纪要模板
- 提供需求文档模板
- 提供项目周报模板
- 提供复盘模板
- 支持团队自定义模板

### 7.5 权限与分享

- 文档所有者可管理权限
- 支持查看、编辑、管理三类权限
- 支持组织内可见、指定成员可见、公开可见
- 支持分享链接生成与失效
- 支持控制是否允许复制
- 支持控制是否允许导出

### 7.6 版本管理

当前阶段先作为后续需求记录，暂不实现产品功能入口。

已确认的需求方向：
- 底层保留 `document_contents` 与 `document_versions`，每次保存可沉淀内容快照
- 后续支持查看历史版本列表
- 后续支持打开某个历史版本进行只读预览
- 后续支持恢复到指定版本，恢复时复制旧内容生成新版本，不直接覆盖旧版本
- 后续支持展示版本时间、操作人、版本备注
- 后续可扩展版本对比能力

当前不实现范围：
- 不提供前端历史版本面板
- 不提供版本列表/版本详情/版本恢复 API
- 不提供版本对比 UI
- 不提供手动命名版本入口

### 7.7 搜索

- 支持标题搜索
- 支持正文全文搜索
- 支持按空间、标签、更新时间筛选
- 支持结果高亮
- 搜索结果需经过权限过滤

### 7.8 导入导出

- 支持导入 Markdown、Docx；Docx 已支持 `.docx` 标题、正文、标题层级、基础列表和表格内容转换为可编辑普通文档
- 支持导出 Markdown、PDF、Docx
- 图片和附件在导出时尽可能保留结构

## 8. 关键设计原则

- V1 不做协同，但保留后续接入协同能力的空间
- 平台能力必须与具体文档类型解耦
- 文档只是首个上线类型，不应在模型中写死为唯一类型
- 权限、版本、搜索、回收站、收藏等能力应作为统一平台能力存在

## 9. 文档类型扩展设计

虽然 V1 仅支持 `doc`，但底层必须支持 `document_type` 字段。

建议预留类型如下：
- `doc`：文本文档
- `sheet`：电子表格
- `board`：白板
- `form`：表单
- `database`：结构化内容页

未来新增类型时，应共享以下平台能力：
- 空间归属
- 权限体系
- 分享体系
- 搜索
- 版本
- 收藏
- 回收站

不同类型可以拥有不同的：
- 编辑器
- 预览器
- 内容结构
- 元数据配置

## 10. 非功能需求

- 核心页面稳定可用
- 文档自动保存可靠
- 搜索响应快
- 权限校验严格
- 支持主流现代浏览器
- 支持文档版本恢复
- 支持中型团队规模使用

## 11. 版本规划

### V1

- 完整文档闭环
- 单一文档类型 `doc`
- 无实时协同
- 版本底层快照可沉淀，但历史版本查询/预览/恢复暂缓实现

### V1.5

- 模板增强
- 评论/审阅能力
- 更完整的知识库能力
- 历史版本查询、预览、恢复与版本备注

### V2

- 实时协同
- 多文档类型支持
- 更丰富的嵌入能力与开放能力

## 12. 总结

本产品第一阶段应聚焦打造“功能完整的在线云文档系统”，而不是一开始做成完整 Office 套件。V1 以文档编辑、管理、权限、版本、搜索、模板为核心，同时底层按多文档类型平台设计，为未来扩展保留清晰路径。

---

## 第二部分：可开发版 PRD

## 1. 产品范围定义

产品名称暂定：`CloudDoc`

版本目标：`V1`

版本边界：
- 只支持 `doc` 类型
- 不支持多人实时协同
- 支持个人与团队场景
- 支持文档全生命周期管理
- 支持平台扩展到更多文档类型

## 2. 信息架构

建议一级结构如下：
- 工作台
- 最近访问
- 我的文档
- 团队空间
- 收藏
- 模板中心
- 回收站
- 设置

文档详情结构：
- 顶部工具栏
- 左侧目录树/大纲
- 中间编辑区
- 右侧属性面板（可选）
- 分享与权限弹窗
- 历史版本面板

## 3. 页面清单

### P0 页面

- 登录页
- 注册页
- 工作台首页
- 文档列表页
- 文档详情编辑页
- 模板中心页
- 收藏页
- 最近访问页
- 回收站页
- 团队空间管理页
- 分享权限弹窗
- 历史版本页
- 搜索结果页
- 个人设置页

### P1 页面

- 模板详情页
- 文档移动弹窗
- 文档导入页
- 文档导出设置弹窗
- 标签管理页
- 成员权限管理页

## 4. 功能模块拆分

### 4.1 用户与组织模块

- 注册登录
- 用户资料
- 团队创建
- 成员邀请
- 角色管理

### 4.2 空间与目录模块

- 个人空间
- 团队空间
- 文件夹树
- 页面层级
- 文档移动
- 排序规则

### 4.3 文档模块

- 新建文档
- 编辑文档
- 删除/恢复文档
- 复制文档
- 收藏/取消收藏
- 最近访问
- 文档封面/图标
- 标签

### 4.4 编辑器模块

- 结构化富文本编辑
- 块菜单 `/`
- 图片块
- 表格块
- 引用块
- 代码块
- 任务列表
- 文档大纲
- 自动保存

### 4.5 模板模块

- 官方模板
- 团队模板
- 用文档创建模板
- 按模板新建文档

### 4.6 权限与分享模块

- 文档 ACL
- 分享链接
- 公开/私有控制
- 可复制/可导出开关

### 4.7 搜索模块

- 全文索引
- 标题索引
- 标签筛选
- 空间过滤
- 权限过滤

### 4.8 版本模块

- 版本快照
- 版本备注
- 版本回滚
- 差异展示

### 4.9 导入导出模块

- Markdown 导入导出
- Docx 导入导出；导入后生成新的普通 `doc` 文档并进入可编辑状态
- PDF 导出

## 5. 核心数据模型

### 5.1 users

- `id`
- `name`
- `email`
- `phone`
- `avatar`
- `status`
- `created_at`
- `updated_at`

### 5.2 organizations

- `id`
- `name`
- `owner_id`
- `plan_type`
- `created_at`
- `updated_at`

### 5.3 organization_members

- `id`
- `organization_id`
- `user_id`
- `role`
- `status`
- `joined_at`

### 5.4 spaces

- `id`
- `organization_id`
- `name`
- `space_type`
- `owner_id`
- `visibility`
- `created_at`
- `updated_at`

`space_type` 建议支持：
- `personal`
- `team`

### 5.5 documents

- `id`
- `space_id`
- `parent_id`
- `creator_id`
- `owner_id`
- `title`
- `document_type`
- `status`
- `current_version_id`
- `icon`
- `cover_url`
- `summary`
- `is_deleted`
- `deleted_at`
- `created_at`
- `updated_at`

`document_type` 首版只有：
- `doc`

但模型要允许未来扩展：
- `sheet`
- `board`
- `form`

### 5.6 document_contents

- `id`
- `document_id`
- `version_no`
- `content_json`
- `plain_text`
- `editor_schema_version`
- `created_by`
- `created_at`

说明：
- `content_json` 存结构化文档树数据
- `plain_text` 用于搜索和摘要
- 后续不同类型可以扩展不同 schema

内容模型建议：
- 顶层采用文档树结构
- 段落、标题、列表、图片、表格、代码块等作为结构节点存储
- 加粗、斜体、链接等作为行内样式或行内节点存储
- 整体编辑体验保持连续文档形态，而不是强块卡片形态

### 5.7 document_versions

- `id`
- `document_id`
- `version_no`
- `content_id`
- `message`
- `created_by`
- `created_at`

### 5.8 document_permissions

- `id`
- `document_id`
- `subject_type`
- `subject_id`
- `permission_level`
- `created_at`

`subject_type`：
- `user`
- `organization`
- `link`

`permission_level`：
- `view`
- `edit`
- `manage`

### 5.9 shares

- `id`
- `document_id`
- `token`
- `access_scope`
- `permission_level`
- `expires_at`
- `allow_copy`
- `allow_export`
- `created_by`
- `created_at`

### 5.10 templates

- `id`
- `organization_id`
- `source_document_id`
- `name`
- `category`
- `preview_image`
- `content_json`
- `status`
- `created_by`
- `created_at`

### 5.11 favorites

- `id`
- `user_id`
- `document_id`
- `created_at`

### 5.12 recent_views

- `id`
- `user_id`
- `document_id`
- `last_viewed_at`

### 5.13 tags

- `id`
- `space_id`
- `name`
- `color`
- `created_at`

### 5.14 document_tags

- `id`
- `document_id`
- `tag_id`

## 6. 接口草案

### 用户与组织

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/me`
- `POST /api/organizations`
- `POST /api/organizations/{id}/invite`
- `GET /api/organizations/{id}/members`

### 空间

- `GET /api/spaces`
- `POST /api/spaces`
- `GET /api/spaces/{id}`
- `PATCH /api/spaces/{id}`

### 文档

- `GET /api/documents`
- `POST /api/documents`
- `GET /api/documents/{id}`
- `PATCH /api/documents/{id}`
- `DELETE /api/documents/{id}`
- `POST /api/documents/{id}/copy`
- `POST /api/documents/{id}/move`
- `POST /api/documents/{id}/restore`

### 文档内容

- `GET /api/documents/{id}/content`
- `PUT /api/documents/{id}/content`
- `POST /api/documents/{id}/autosave`

### 版本

- `GET /api/documents/{id}/versions`
- `POST /api/documents/{id}/versions`
- `POST /api/documents/{id}/versions/{versionId}/restore`

### 权限与分享

- `GET /api/documents/{id}/permissions`
- `PUT /api/documents/{id}/permissions`
- `POST /api/documents/{id}/shares`
- `DELETE /api/shares/{id}`
- `GET /api/share/{token}`

### 模板

- `GET /api/templates`
- `POST /api/templates`
- `POST /api/templates/{id}/instantiate`

### 搜索

- `GET /api/search?q=`
- `GET /api/search/suggest?q=`

### 收藏与最近访问

- `POST /api/documents/{id}/favorite`
- `DELETE /api/documents/{id}/favorite`
- `GET /api/recent-views`

### 导入导出

- `POST /api/import/docx`
- `POST /api/import/markdown`
- `GET /api/documents/{id}/export?format=pdf`
- `GET /api/documents/{id}/export?format=docx`

## 7. 关键业务规则

- 删除文档默认进入回收站，不立即物理删除
- 文档标题允许为空时自动生成“未命名文档”
- 每次自动保存不一定都生成正式版本
- 正式版本由手动保存版本或关键节点触发
- 搜索结果必须先做权限过滤
- 文档移动时要校验目标空间权限
- 分享链接的访问权限不能高于文档本身权限策略
- 首版不允许两个用户同时编辑同一文档时做冲突合并
- 首版可采用“编辑锁”或“最后保存覆盖并提示”的简化策略，但更推荐编辑锁

## 8. 首版建议的编辑策略

因为 V1 不做协同，建议使用以下策略：
- 文档打开时允许只读访问
- 进入编辑态时尝试获取编辑锁
- 锁被占用时，其他用户只能只读
- 锁释放后其他用户才能编辑

这样可以显著降低复杂度，同时不破坏后续升级到协同编辑的路径。

## 9. 技术实现建议

- 前端：React / Next.js
- 编辑器：TipTap / ProseMirror
- 后端：Node.js / Java / Go 均可
- 搜索：先用数据库全文检索，规模上来后切 Elasticsearch / OpenSearch
- 存储：结构化 JSON + 对象存储
- 权限：RBAC + 文档 ACL
- 版本：快照式版本管理

编辑器实现建议：
- 采用 ProseMirror / TipTap 的结构化节点模型
- 节点按块组织，但 UI 呈现保持连续文档阅读体验
- 工具栏和块菜单保留块级插入能力
- 避免首版做成强 Notion 风格的显式卡片块系统

### 9.1 开发环境数据库连接信息

当前开发环境 PostgreSQL 连接信息如下：

- 类型：`PostgreSQL`
- Host：`localhost`
- Port：`5432`
- Username：`<your_db_user>`
- Password：`<your_db_password>`

连接串示例：

```text
postgresql://<your_db_user>:<your_db_password>@localhost:5432/clouddoc
```

说明：
- 当前文档仅记录连接信息，实际库名后续可按项目初始化结果调整
- 后续数据库建表、迁移、查询和调试可直接使用以上连接配置
- 该信息属于开发环境敏感信息，后续若进入正式仓库或对外协作环境，建议改为环境变量管理

## 10. 开发优先级

### P0

- 登录注册
- 空间与目录
- 文档 CRUD
- 富文本编辑
- 自动保存
- 权限与分享
- 搜索
- 历史版本
- 回收站
- 模板中心

### P1

- 导入导出
- 标签
- 文档封面
- 更细的权限控制
- 团队模板

### P2

- 评论
- 审阅
- 更多块类型
- 外链嵌入

## 11. 风险点

- 编辑器选型一旦错误，后续扩展成本会很高
- 如果 `documents` 和 `document_contents` 不分离，版本和多类型扩展会很痛苦
- 如果权限写死在文档表，后续分享和组织策略会变复杂
- 如果没有提前设计 `document_type`，后续扩展新类型会牵一发动全身

## 12. 推荐结论

V1 最合适的产品定义是：

“一个功能完整、非实时协同、可扩展的在线云文档平台，首版只支持文本文档，但底层按多文档类型平台设计。”
