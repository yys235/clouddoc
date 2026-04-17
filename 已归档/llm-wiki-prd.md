# CloudDoc LLM Wiki 产品需求文档

## 1. 背景

Karpathy 在 `LLM Wiki` 中提出了一种区别于传统 RAG 的知识管理模式：

- 传统 RAG 在提问时临时检索原始资料，再即时拼接答案。
- LLM Wiki 在资料进入系统时，就由 LLM 将资料持续整理为结构化、互相引用、可长期维护的 Wiki。
- Wiki 是持续积累的中间知识层，原始资料仍然保留为不可变事实来源。
- LLM 负责摘要、归档、交叉引用、冲突识别、索引维护和日志记录。
- 人负责选择资料、提出问题、审核方向和决定最终结论。

CloudDoc 当前已经具备以下基础能力：

- 多用户、组织、空间和权限体系
- 文档、PDF、文件夹、分享、评论、收藏、通知
- 块文档编辑器和统一只读/编辑渲染机制
- MCP 服务与 REST API
- 文档层级和文件夹体系
- 后端审计与用户身份上下文

因此，CloudDoc 可以在现有“在线文档系统”基础上，演进为“AI 原生知识库系统”：让 AI 不只是读取文档，而是持续维护知识结构。

## 2. 产品定位

### 2.1 一句话定位

CloudDoc LLM Wiki 是一个由 AI 持续维护的结构化知识库能力，用于把原始资料、用户提问和分析结果沉淀为可引用、可审计、可更新的知识文档体系。

### 2.2 核心差异

不是：

- 简单文档搜索
- 单次文件问答
- 上传文件后临时 RAG
- AI 聊天记录

而是：

- 原始资料长期保存
- AI 将资料编译为 Wiki 知识页
- 知识页之间有引用关系
- 结论可以随新资料更新
- 冲突和过期结论可被发现
- 每次 AI 维护都有日志和审计

## 3. 目标

### 3.1 产品目标

- 将 LLM Wiki 方法论引入 CloudDoc。
- 支持用户把资料导入 CloudDoc 后，由 AI 自动整理为知识库。
- 支持 AI 维护空间级索引、资料日志、主题页、实体页和分析页。
- 支持基于知识库提问，并将有价值回答沉淀为文档。
- 支持定期体检知识库，发现冲突、孤立页、缺失引用、过期结论。
- 保证 AI 操作受权限控制、可审计、可回滚。
- 支持每个用户配置自己的 AI Provider 和模型参数。
- 支持用户在指定空间或文件夹下创建独立的 LLM Wiki 工作区。
- 支持用户显式授权 AI 可读取的文档范围，避免默认读取全部有权限文档。

### 3.2 工程目标

- 尽量复用现有文档、文件夹、权限、MCP、审计模型。
- 优先以普通 CloudDoc 文档承载 Wiki 页面，避免过早引入复杂对象系统。
- 新增必要的关系表和元数据表，表达来源、引用、AI 操作和知识状态。
- 新增 AI Provider 配置、LLM Wiki 工作区、授权来源范围和运行任务表。
- REST API 与 MCP 继续共享 service 层和 permission service。
- 支持后续扩展到企业知识库、竞品研究、项目资料库、个人知识库。

## 4. 适用场景

### 4.1 个人知识库

用户持续导入文章、笔记、书摘、播客摘要、PDF，CloudDoc 自动维护：

- 主题页
- 人物页
- 读书笔记
- 观点索引
- 待验证问题

### 4.2 研究型项目

用户围绕一个研究主题持续导入论文、报告、网页和数据，系统维护：

- 研究综述
- 关键概念页
- 证据链
- 结论变化记录
- 资料可信度标记

### 4.3 企业内部知识库

团队将会议纪要、项目文档、客户反馈、Slack/飞书消息导入 CloudDoc，系统维护：

- 项目状态页
- 客户页
- 决策记录
- 风险清单
- 术语表

### 4.4 竞品分析

用户持续导入竞品官网、发布日志、新闻、产品截图、报价表，系统维护：

- 竞品实体页
- 功能对比页
- 价格变化页
- 风险和机会页
- 综合分析报告

## 5. 核心概念

### 5.1 Raw Sources 原始资料

原始资料是知识库的事实来源，原则上不可被 AI 修改。

来源类型包括：

- 上传 PDF
- 网页剪藏
- 图片
- Markdown 文件
- 会议纪要
- 外部链接
- 用户手动输入资料

产品要求：

- 原始资料必须保留来源信息。
- 原始资料可以被 AI 读取和引用。
- AI 不应直接覆盖原始资料。
- 原始资料可被用户删除，但删除前必须确认。

### 5.2 Wiki Pages 知识页

知识页由 AI 生成或维护，是对原始资料和用户问题的结构化整理。

典型类型：

- `overview` 总览页
- `topic` 主题页
- `entity` 实体页
- `concept` 概念页
- `comparison` 对比页
- `analysis` 分析页
- `index` 索引页
- `log` 日志页
- `question` 问答沉淀页

产品要求：

- 知识页本质仍是 CloudDoc 文档。
- 知识页需要显示“AI 维护”状态。
- 用户可以编辑知识页。
- AI 再次更新知识页时需要尊重用户编辑内容。
- 重要 AI 改动应可审计。

### 5.3 Schema 知识库规则

Schema 是指导 AI 维护知识库的规则文档。

可以表现为：

- 空间级系统文档
- 文件夹级规则文档
- 项目级 `AGENTS.md`
- 后端保存的结构化配置

规则内容包括：

- 目录结构
- 命名规范
- 页面模板
- 引用格式
- 来源可信度规则
- 导入流程
- 问答沉淀规则
- 体检规则

### 5.4 Index 索引页

索引页是面向 AI 和用户的知识导航入口。

内容包括：

- 页面列表
- 页面摘要
- 页面类型
- 最近更新时间
- 来源数量
- 关键标签
- 重要交叉引用

### 5.5 Log 日志页

日志页记录知识库演进过程。

内容包括：

- 资料导入记录
- AI 更新记录
- 用户确认记录
- 问答沉淀记录
- 体检记录
- 冲突处理记录

日志原则：

- 追加写入
- 可检索
- 可审计
- 可按时间回溯

### 5.6 个人 AI 配置

个人 AI 配置用于让每个用户接入自己的模型服务。

配置项包括：

- 是否启用 AI 功能
- Provider 类型：`openai`、`anthropic`、`ollama`、`openai_compatible`
- Provider 名称
- Base URL
- 默认模型
- API Key
- 最大上下文长度
- 默认写入模式
- 是否允许 AI 写入文档

产品要求：

- API Key 必须后端加密保存。
- 前端不能回显完整 API Key。
- 日志不能记录 API Key。
- 支持删除或替换 API Key。
- 支持测试连接。
- 用户未配置 AI Provider 时，不能创建需要模型调用的 LLM Wiki 任务。

### 5.7 LLM Wiki 工作区

LLM Wiki 工作区是把 LLM Wiki 方法论落到 CloudDoc 的核心产品对象。

它不是普通文件夹本身，而是一个包含配置、授权范围、输出位置和运行记录的业务对象。

工作区包含：

- 工作区名称
- 所属用户
- 所属空间
- 根文件夹
- 输出文件夹
- 索引文档
- 日志文档
- 使用的 AI Provider
- 授权读取范围
- 写入模式
- 自动维护开关

产品原则：

- 一个用户可以创建多个 LLM Wiki 工作区。
- 一个文件夹下可以创建一个或多个 LLM Wiki 工作区。
- 默认输出文件夹命名为 `llm-wiki`。
- 工作区读取范围必须由用户显式选择。
- 工作区不能因为用户拥有权限就默认读取全部文档。

### 5.8 授权读取范围

授权读取范围定义 AI 在某个 LLM Wiki 工作区内可以读取哪些内容。

范围类型：

- 指定文档
- 指定文件夹
- 指定空间

规则：

- AI 可读范围 = 当前用户可读权限 ∩ 用户显式授权范围。
- AI 可写范围 = 当前用户可写权限 ∩ 工作区输出文件夹。
- 团队空间文档即使用户有权限，也需要用户主动加入工作区后才能被 AI 读取。
- 分享链接访问者不能创建授权范围，不能触发写入型 AI 操作。

## 6. 核心工作流

### 6.0 创建 LLM Wiki 工作区

用户可以在空间或文件夹中创建 LLM Wiki 工作区。

流程：

1. 用户进入空间或文件夹。
2. 点击“创建 LLM Wiki”。
3. 选择 AI Provider。
4. 选择读取范围：当前文件夹、当前空间、手动选择文档。
5. 选择输出位置：当前文件夹下创建 `llm-wiki` 或选择已有文件夹。
6. 选择写入模式：用户确认后写入或自动写入。
7. 系统创建工作区配置。
8. 系统创建默认输出文件夹和系统文档。

默认创建结构：

```text
/llm-wiki
  /00 索引
    知识库索引
    操作日志
    待验证问题
  /01 原始资料摘要
  /02 主题
  /03 实体
  /04 分析报告
  /05 体检报告
```

第一版要求：

- 支持在当前文件夹下创建一个 `llm-wiki` 输出文件夹。
- 支持创建 `知识库索引`、`操作日志`、`待验证问题` 三篇系统文档。
- 支持配置读取范围。
- 支持配置写入模式。
- 支持关联用户自己的 AI Provider。

暂不要求：

- 自动扫描整个空间。
- 自动定时维护。
- 组织级共享 AI Provider。

### 6.1 Ingest 资料导入

用户将资料放入某个空间或文件夹后，可以触发“导入为知识库资料”。

流程：

1. 用户选择原始资料。
2. 用户选择目标 LLM Wiki 工作区。
3. AI 读取资料。
4. AI 生成资料摘要。
5. AI 判断应更新哪些知识页。
6. AI 创建或更新实体页、主题页、索引页。
7. AI 标记新资料与旧资料的冲突。
8. AI 写入日志。
9. 用户查看导入结果。

第一版要求：

- 支持单个资料导入。
- 资料必须属于当前工作区授权读取范围，或由用户在导入时显式加入。
- 支持用户确认后写入。
- 支持显示“本次将更新哪些文档”。
- 支持写入导入日志。

暂不要求：

- 大批量自动导入。
- 实时监听外部资料源。
- 完整自动冲突合并。

### 6.2 Query 知识库问答

用户针对某个空间、文件夹或知识库提问。

流程：

1. 用户输入问题。
2. AI 先读取索引页。
3. AI 选择相关知识页和原始资料。
4. AI 生成回答，并附带引用。
5. 用户可以选择“保存为知识页”。
6. 保存后系统更新索引页和日志页。

第一版要求：

- 支持基于指定文件夹/空间提问。
- 回答必须带引用。
- 支持保存回答为 CloudDoc 文档。
- 保存的回答要关联来源文档。

### 6.3 Lint 知识库体检

用户或系统定期触发知识库体检。

检查项：

- 页面之间是否存在矛盾。
- 是否有过期结论。
- 是否有孤立页面。
- 是否有重要概念未建页。
- 是否有资料未被索引。
- 是否有知识页缺少来源引用。
- 是否有 TODO 或待验证结论长期未处理。

输出：

- 体检报告
- 建议创建的页面
- 建议更新的页面
- 建议补充的资料
- 风险和冲突清单

第一版要求：

- 手动触发。
- 生成体检报告文档。
- 不自动修改已有知识页。

### 6.4 Compile 知识编译

知识编译是将多个资料和页面综合成一个更高层次页面。

典型输出：

- 竞品分析报告
- 项目周报
- 研究综述
- 决策备忘录
- 产品需求文档

第一版要求：

- 用户选择多个来源文档。
- AI 生成一个新的分析文档。
- 文档保留来源引用。
- 生成后写入日志。

## 7. 信息架构

### 7.1 文件夹建议结构

每个启用 LLM Wiki 的工作区建议创建独立输出文件夹。

如果用户从某个项目文件夹启用，建议结构为：

```text
/项目 A
  /llm-wiki
    /00 索引
      知识库索引
      操作日志
      待验证问题
    /01 原始资料摘要
    /02 主题
    /03 实体
    /04 分析报告
    /05 体检报告
```

说明：

- 该结构是默认建议，不强制用户必须使用。
- 用户可以自定义输出文件夹，但系统需要知道哪个文件夹是工作区输出位置。
- 不建议所有用户共用同一个全局 `llm-wiki` 文件夹。
- LLM Wiki 文件夹应尽量跟随项目或资料范围创建，便于权限和上下文隔离。
- 后续可以支持“知识库空间模板”。

### 7.2 文档标签

建议增加系统标签：

- `source`
- `wiki`
- `index`
- `log`
- `ai-generated`
- `ai-maintained`
- `needs-review`
- `verified`
- `conflict`
- `stale`

第一版可先通过文档 metadata 实现，不一定立即做完整标签系统。

## 8. 数据模型建议

### 8.0 user_ai_providers

用于保存用户自己的 AI Provider 配置。

字段建议：

- `id`
- `user_id`
- `provider_type`
- `display_name`
- `base_url`
- `default_model`
- `encrypted_api_key`
- `max_context_tokens`
- `is_enabled`
- `last_tested_at`
- `last_test_status`
- `created_at`
- `updated_at`

安全要求：

- `encrypted_api_key` 必须加密存储。
- API 返回中不得包含完整 API Key。
- 日志和审计中不得记录 API Key。
- 删除 Provider 时需要确认。

### 8.0.1 llm_wiki_workspaces

用于保存 LLM Wiki 工作区配置。

字段建议：

- `id`
- `owner_id`
- `space_id`
- `root_folder_id`
- `output_folder_id`
- `index_document_id`
- `log_document_id`
- `todo_document_id`
- `ai_provider_id`
- `name`
- `description`
- `status`
- `write_mode`
- `auto_maintain_enabled`
- `created_at`
- `updated_at`

可选值：

- `status`: `active | disabled | archived`
- `write_mode`: `manual_review | auto_write`

### 8.0.2 llm_wiki_sources

用于记录工作区授权读取范围。

字段建议：

- `id`
- `workspace_id`
- `source_type`
- `source_id`
- `include_children`
- `created_by`
- `created_at`

可选值：

- `source_type`: `document | folder | space`

说明：

- 该表表达“用户显式允许 AI 读取的范围”。
- 运行时仍然必须叠加 permission_service 判断。
- 如果用户失去某文档权限，即使该文档仍在授权范围内，AI 也不能读取。

### 8.0.3 llm_wiki_runs

用于记录每次 LLM Wiki 任务运行。

字段建议：

- `id`
- `workspace_id`
- `triggered_by`
- `run_type`
- `status`
- `input_snapshot`
- `read_document_ids`
- `created_document_ids`
- `updated_document_ids`
- `ai_provider_id`
- `model`
- `token_usage`
- `cost_estimate`
- `error_message`
- `created_at`
- `updated_at`

可选值：

- `run_type`: `ingest | query | lint | compile | index_update`
- `status`: `pending | running | waiting_review | completed | failed | cancelled`

### 8.1 documents 扩展

建议新增或预留字段：

- `knowledge_role`
- `ai_maintained`
- `source_kind`
- `review_status`

可选值示例：

- `knowledge_role`: `normal | source | wiki_page | index | log | report`
- `review_status`: `draft | needs_review | verified`

### 8.2 document_references

用于表达文档之间的引用关系。

字段建议：

- `id`
- `source_document_id`
- `target_document_id`
- `relation_type`
- `anchor_block_id`
- `anchor_text`
- `quote_text`
- `created_by`
- `created_by_type`
- `metadata`
- `created_at`

关系类型：

- `cites`
- `summarizes`
- `contradicts`
- `supports`
- `updates`
- `derived_from`
- `mentions`

### 8.3 source_ingestions

记录资料导入任务。

字段建议：

- `id`
- `space_id`
- `source_document_id`
- `status`
- `summary_document_id`
- `created_by`
- `created_by_type`
- `result_metadata`
- `error_message`
- `created_at`
- `updated_at`

### 8.4 ai_knowledge_operations

记录 AI 知识维护操作。

字段建议：

- `id`
- `operation_type`
- `space_id`
- `folder_id`
- `actor_user_id`
- `actor_type`
- `status`
- `input_document_ids`
- `changed_document_ids`
- `created_document_ids`
- `summary`
- `audit_payload`
- `created_at`
- `updated_at`

操作类型：

- `ingest`
- `query`
- `lint`
- `compile`
- `index_update`

### 8.5 与 mcp_audit_logs 的关系

`mcp_audit_logs` 记录 MCP 协议工具调用。

`ai_knowledge_operations` 记录业务语义上的知识维护任务。

两者关系：

- MCP 日志偏底层调用。
- AI 知识操作偏产品行为。
- 一个知识操作可能包含多个 MCP 工具调用。

## 9. 权限与安全

### 9.1 基本原则

- AI 不能绕过用户权限。
- AI 只能读取 actor 有权限读取且被显式授权给当前工作区的文档。
- AI 只能修改 actor 有权限修改且位于工作区输出范围内的文档。
- 私有文档不会因为进入知识库而自动变公开。
- 生成的新知识页默认继承目标文件夹或空间权限。
- AI 操作必须记录操作者和触发来源。
- 使用用户个人 API Key 调用第三方模型前，必须明确告知文档内容会发送到用户配置的模型服务。
- 默认不允许 AI 读取用户全部有权限文档。

### 9.2 原始资料权限

- 私有资料只能被拥有者或有权限成员导入。
- 公开资料可以被有访问权限的人引用。
- 分享链接访问者不能触发写入型知识维护。

### 9.3 AI 写入权限

AI 写入分两种模式：

- 草稿模式：AI 生成修改建议，不直接写入正式文档。
- 自动模式：AI 在权限允许范围内直接写入，并记录审计。

第一版建议只支持草稿模式或用户确认后写入。

### 9.4 个人 API Key 安全

- API Key 只能由用户本人创建、测试、替换和删除。
- API Key 必须加密存储。
- 后端只在调用模型时解密。
- 前端只能看到脱敏状态，例如“已配置”或尾号后四位。
- 审计日志中不能包含 API Key。
- 如果模型调用失败，错误信息不能泄漏 API Key。

### 9.5 组织级扩展

第一版只做个人 AI Provider。

后续可以扩展：

- 组织统一 Provider。
- 组织禁用外部模型。
- 组织限定可用模型。
- 私有化模型网关。
- 组织级费用统计和调用审计。

## 10. MCP 扩展需求

为了支持 LLM Wiki，MCP 需要扩展工具。

### 10.1 只读工具

- `clouddoc.list_knowledge_spaces`
- `clouddoc.list_llm_wiki_workspaces`
- `clouddoc.get_llm_wiki_workspace`
- `clouddoc.get_knowledge_index`
- `clouddoc.list_document_references`
- `clouddoc.search_wiki_pages`
- `clouddoc.get_source_context`

### 10.2 写入工具

- `clouddoc.create_llm_wiki_workspace`
- `clouddoc.update_llm_wiki_workspace`
- `clouddoc.add_llm_wiki_source`
- `clouddoc.remove_llm_wiki_source`
- `clouddoc.create_wiki_page`
- `clouddoc.update_wiki_page`
- `clouddoc.create_document_reference`
- `clouddoc.append_knowledge_log`
- `clouddoc.create_ingestion_task`
- `clouddoc.create_lint_report`

### 10.3 工作流工具

- `clouddoc.ingest_source`
- `clouddoc.query_knowledge_base`
- `clouddoc.lint_knowledge_base`
- `clouddoc.compile_knowledge_report`

实现原则：

- MCP 工具不直接拼复杂 SQL。
- MCP 工具调用 API service 层。
- 权限统一通过 ActorContext 和 permission_service。
- MCP 工具读取文档时必须叠加工作区授权范围。
- 写入工具必须写审计。

## 11. 前端功能需求

### 11.0 个人 AI 配置页

在个人配置页面增加 AI 配置区域。

功能：

- 启用或关闭 AI 功能。
- 新增 AI Provider。
- 配置 Provider 类型、Base URL、默认模型、API Key。
- 测试连接。
- 删除 Provider。
- 设置默认 Provider。

安全表现：

- API Key 输入后不回显。
- 已配置 Key 只显示脱敏状态。
- 删除 Key 必须弹窗确认。

### 11.1 知识库入口

在空间或文件夹页面增加“创建 LLM Wiki”入口。

启用后：

- 创建 LLM Wiki 工作区。
- 创建默认输出目录。
- 创建索引页。
- 创建日志页。
- 创建待验证问题页。
- 显示知识库面板。

创建弹窗字段：

- 工作区名称
- AI Provider
- 读取范围
- 输出位置
- 写入模式
- 是否启用自动维护

第一版默认：

- 写入模式为 `manual_review`。
- 自动维护关闭。
- 输出位置为当前文件夹下 `llm-wiki`。

### 11.2 资料导入面板

用户可以选择一个或多个文档，点击“导入知识库”。

面板显示：

- 资料名称
- 所属 LLM Wiki 工作区
- 导入范围
- 预计生成/更新页面
- 权限提示
- 是否需要用户确认

### 11.3 知识库问答面板

用户可以在空间或文件夹范围内提问。

能力：

- 选择范围
- 显示引用
- 保存回答为文档
- 追加到日志

### 11.4 体检报告页面

展示：

- 冲突
- 过期结论
- 孤立页面
- 缺失引用
- 建议补充资料
- 建议新建页面

## 12. AI 生成内容规范

AI 生成或维护的文档必须包含：

- 摘要
- 来源列表
- 关键结论
- 不确定点
- 最近更新时间
- 维护日志

涉及事实判断时必须：

- 标明来源
- 标明是否推断
- 标明冲突信息
- 避免无来源结论伪装成事实

## 13. 分期计划

### Phase 0：设计与基础约束

- 完成 PRD。
- 明确数据模型。
- 明确 MCP 工具边界。
- 明确权限与审计规则。
- 明确个人 API Key 加密和脱敏策略。
- 明确 LLM Wiki 工作区与普通文件夹的关系。

### Phase 1：个人 AI 配置与工作区骨架

- 增加用户 AI Provider 配置。
- 支持测试模型连接。
- 增加 LLM Wiki 工作区表。
- 增加工作区授权来源范围表。
- 支持在文件夹下创建 `llm-wiki` 输出文件夹。
- 增加知识库默认文件夹模板。
- 支持空间级索引页和日志页。
- 增加文档知识角色 metadata。
- 增加文档引用关系表。
- 增加 AI 操作日志表。

### Phase 2：手动导入资料

- 支持选择 LLM Wiki 工作区。
- 支持将文档加入工作区授权读取范围。
- 支持用户选择资料导入。
- AI 生成摘要页。
- AI 更新索引页。
- AI 写入日志。
- 支持用户确认后保存。

### Phase 3：知识库问答沉淀

- 支持空间/文件夹范围问答。
- 回答带引用。
- 支持保存回答为知识页。
- 自动更新索引和日志。

### Phase 4：知识库体检

- 支持手动 lint。
- 生成体检报告。
- 标记冲突、孤立页、过期结论。
- 暂不自动改正文档。

### Phase 5：自动维护与高级能力

- 支持组织级 AI Provider。
- 支持定期体检。
- 支持批量导入。
- 支持自动更新知识页。
- 支持用户审核 AI patch。
- 支持知识图谱视图。

## 14. 验收标准

### 14.1 Phase 1 验收

- 用户可以在个人配置页新增 AI Provider。
- API Key 后端加密保存，前端不回显完整 Key。
- 用户可以测试 AI Provider 连接。
- 用户可以在文件夹下创建 LLM Wiki 工作区。
- 系统自动创建 `llm-wiki` 输出文件夹。
- 系统自动创建索引页和日志页。
- 系统自动创建待验证问题页。
- 工作区可以配置授权读取范围。
- 文档可以标记为 source 或 wiki_page。
- 文档之间可以建立引用关系。
- 所有 AI 知识操作有审计记录。

### 14.2 Phase 2 验收

- 用户选择一个工作区和一篇资料后，可以生成摘要页。
- 如果资料不在授权范围内，需要用户明确加入后才能导入。
- 摘要页包含来源、结论和不确定点。
- 索引页自动更新。
- 日志页追加导入记录。
- 未授权用户不能导入无权限资料。

### 14.3 Phase 3 验收

- 用户可以基于指定范围提问。
- 回答包含引用。
- 用户可以将回答保存为知识页。
- 保存后索引和日志更新。

### 14.4 Phase 4 验收

- 用户可以触发知识库体检。
- 系统生成体检报告。
- 报告列出冲突、孤立页、缺失引用和过期结论。
- 体检过程不绕过权限。

## 15. 本期不做

- 自动持续监听外部数据源。
- 全自动无审核改写大量文档。
- 默认扫描用户全部有权限文档。
- 组织级统一 AI Provider。
- 企业级知识图谱可视化。
- 复杂引用级权限裁剪。
- 多模型评审机制。
- 端到端事实校验系统。

## 16. 风险

### 16.1 AI 生成错误

风险：

- AI 可能误读资料。
- AI 可能生成不存在的引用。
- AI 可能错误合并冲突信息。

缓解：

- 强制保留来源引用。
- 重要更新先生成草稿。
- 用户确认后写入。
- 保留 AI 操作日志。

### 16.2 权限泄漏

风险：

- AI 在生成知识页时引用了用户无权查看的内容。
- 用户有权限但未授权给工作区的团队文档被 AI 读取。
- 使用个人 API Key 时，敏感文档内容被发送到第三方模型服务。

缓解：

- 所有读取通过 permission_service。
- 所有读取叠加 llm_wiki_sources 显式授权范围。
- 知识页默认继承目标范围权限。
- 生成内容记录来源权限上下文。
- 模型调用前明确提示内容会发送到用户配置的 Provider。

### 16.3 知识污染

风险：

- 低质量资料进入知识库后污染已有结论。

缓解：

- 增加来源可信度。
- 标记未验证结论。
- 体检报告识别冲突。

### 16.4 维护成本失控

风险：

- 自动维护页面太多，用户难以理解 AI 改了什么。

缓解：

- 操作前预览变更范围。
- 操作后生成摘要。
- 日志可检索。
- 支持回滚。

## 17. 与现有 CloudDoc 能力的关系

- 文件夹：承载知识库目录结构。
- 个人配置：承载用户 AI Provider 和默认 AI 行为。
- 文档类型：承载 source、wiki、index、log 等角色。
- MCP：作为 AI 操作入口。
- 权限系统：决定 AI 能读写哪些资料。
- 评论：用于用户审核 AI 生成内容。
- 通知：用于提醒用户 AI 导入、体检、冲突发现。
- 版本历史：后续用于 AI 修改回滚。
- 分享：只读分享可以展示知识页，但不能触发写入型 AI 操作。

## 18. 结论

LLM Wiki 对 CloudDoc 的意义不是增加一个“AI 问答”按钮，而是引入一种新的知识组织方式：

- 原始资料保留事实来源。
- AI 将资料持续编译为结构化知识页。
- 用户问题和分析结果沉淀为长期资产。
- 索引、日志、引用、体检让知识库可维护。
- MCP 让外部 AI Agent 可以安全参与知识维护。

CloudDoc 后续应以“AI 原生知识库”为中长期方向，在现有在线文档系统基础上逐步增加知识编译、引用关系、AI 审计和知识库体检能力。
