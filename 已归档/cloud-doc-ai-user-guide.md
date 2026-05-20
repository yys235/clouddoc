# CloudDoc AI 功能与使用指南

## 1. 这份文档解决什么问题

这份文档面向第一次使用 CloudDoc AI 接入能力的用户。

读完以后，你应该能理解：

- CloudDoc 当前有哪些 AI 相关功能。
- AI 能帮你对 CloudDoc 做什么。
- 如何把 AI 工具连接到 CloudDoc。
- 如何控制 AI 能读取和修改哪些文档。
- 遇到常见问题时应该检查哪里。

## 2. 当前系统的 AI 能力是什么

CloudDoc 当前的 AI 能力不是内置聊天机器人，而是提供一套安全接入能力，让外部 AI 工具可以在你授权的范围内访问 CloudDoc。

当前已支持三类接入方式：

- MCP 服务：适合 Claude、IDE Agent、自动化 Agent 等支持 MCP 的 AI 工具。
- Personal Access Token：适合你自己的脚本、工作流或个人 AI 工具。
- Integration Token / Open API：适合第三方工具、团队自动化服务或后续 OAuth 接入。

AI 工具接入后，可以做这些事情：

- 搜索文档。
- 读取文档内容。
- 读取画板结构。
- 读取评论。
- 创建文档。
- 创建文件夹。
- 用 Markdown 创建或更新文档。
- 给文档追加内容。
- 创建评论或回复评论。
- 收藏文档。
- 在权限允许时删除或恢复自己拥有的文档。

## 3. 推荐使用方式

如果你只是想让自己的 AI 助手读取和整理 CloudDoc，推荐先使用 MCP。

推荐路径：

1. 启动 CloudDoc 后端和前端。
2. 启动 CloudDoc MCP 服务。
3. 在 AI 工具里添加 MCP 服务地址。
4. 让 AI 搜索、读取、总结或写入文档。

如果你是开发者，或者要接入自己的程序，再使用 Personal Access Token 或 Integration Token。

## 4. AI 能读懂哪些内容

### 4.1 普通文档

普通文档推荐给 AI 使用 Markdown 格式。

MCP 工具：

```text
clouddoc.get_document(format="markdown")
```

适合场景：

- 总结文档。
- 提取待办。
- 重写文档。
- 根据文档回答问题。
- 把多个文档整理成一篇新文档。

### 4.2 画板文档

画板文档推荐给 AI 使用 `ai` 格式。

MCP 工具：

```text
clouddoc.get_document(format="ai")
```

这个格式会把画板转换成 AI 更容易理解的结构，包括：

- 节点列表。
- 节点文字。
- 节点位置。
- 连接线关系。
- 表格形状内容。
- 入边和出边关系。
- 未连接节点。

适合场景：

- 让 AI 解释流程图。
- 让 AI 检查流程是否有断点。
- 让 AI 根据画板生成说明文档。
- 让 AI 找出没有连接的节点。

## 5. 准备工作

### 5.1 启动 CloudDoc

启动后端：

```bash
cd apps/api
uv sync
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

启动前端：

```bash
cd apps/web
npm install
npm run dev -- --hostname 127.0.0.1 --port 3100
```

打开：

```text
http://127.0.0.1:3100
```

### 5.2 确认登录用户

打开 CloudDoc 后，先用你的账号登录。

后续 AI 通过 MCP 访问文档时，需要映射成一个 CloudDoc 用户身份。

如果你只是本地测试，可以使用演示账号：

```text
demo@clouddoc.local
```

## 6. 使用 MCP 连接 AI

### 6.1 启动 MCP 服务

安装 MCP 包：

```bash
apps/api/.venv/bin/python -m pip install -e apps/mcp
```

启动 MCP：

```bash
CLOUDDOC_MCP_ACTOR_EMAIL=demo@clouddoc.local apps/api/.venv/bin/clouddoc-mcp
```

默认 MCP 服务地址：

```text
http://127.0.0.1:8010/mcp
```

默认传输方式：

```text
Streamable HTTP
```

### 6.2 MCP 用户身份是什么意思

`CLOUDDOC_MCP_ACTOR_EMAIL` 表示 AI 以哪个 CloudDoc 用户身份访问文档。

例如：

```bash
CLOUDDOC_MCP_ACTOR_EMAIL=demo@clouddoc.local
```

表示 AI 看到的权限和 `demo@clouddoc.local` 这个用户一致。

如果不配置 `CLOUDDOC_MCP_ACTOR_EMAIL`，系统会使用内置访客：

```text
guest@clouddoc.local
```

访客没有私有文档权限，只能读取公开文档或分享链接可访问的内容。

### 6.3 在 AI 工具里怎么填

如果你的 AI 工具支持 Streamable HTTP MCP，填写：

```text
Name: CloudDoc
URL: http://127.0.0.1:8010/mcp
Transport: Streamable HTTP
```

如果你的 AI 工具只支持本地命令形式的 MCP，需要用该工具支持的 HTTP MCP 适配方式，把它连接到：

```text
http://127.0.0.1:8010/mcp
```

不同 AI 工具的界面名称会不一样，但核心只有两项：

- MCP 服务地址。
- 访问 CloudDoc 的用户身份。

## 7. 让 AI 做事的常用说法

### 7.1 搜索文档

可以这样对 AI 说：

```text
请在 CloudDoc 中搜索“项目部署”，列出相关文档标题和更新时间。
```

AI 通常会调用：

```text
clouddoc.search_documents
```

### 7.2 总结一篇文档

可以这样说：

```text
请读取 CloudDoc 里的《CloudDoc MCP 接入设计文档》，总结它的核心设计和待办事项。
```

AI 通常会调用：

```text
clouddoc.get_document(format="markdown")
```

### 7.3 根据文档生成新文档

可以这样说：

```text
请读取 clouddoc 文件夹下和 MCP 有关的文档，生成一篇《MCP 接入使用手册》。
```

AI 可能会调用：

```text
clouddoc.search_documents
clouddoc.get_document
clouddoc.create_document_from_markdown
```

### 7.4 更新已有文档

可以这样说：

```text
请把这段部署说明追加到《CloudDoc AI 功能与使用指南》的末尾。
```

AI 可能会调用：

```text
clouddoc.append_document_markdown
```

### 7.5 分析画板

可以这样说：

```text
请读取这个 CloudDoc 画板，解释每个节点和连接线关系，并指出是否有未连接节点。
```

AI 通常会调用：

```text
clouddoc.get_document(format="ai")
```

## 8. 使用 Personal Access Token

如果你的工具不支持 MCP，但可以调用 HTTP API，可以使用 Personal Access Token。

适合场景：

- 自己写脚本读取 CloudDoc。
- 自动把外部资料写入 CloudDoc。
- 用工作流平台定期生成总结。

操作路径：

1. 打开 CloudDoc。
2. 进入个人配置。
3. 找到 AI 与开放接入。
4. 创建 Personal Access Token。
5. 复制创建时显示的 token。
6. 在你的脚本或工具里使用这个 token 调用 `/api/open/*` 接口。

注意：

- token 明文只在创建时显示一次。
- 不要把 token 发给别人。
- 不再使用时应立即禁用或删除。

## 9. 使用 Integration Token

Integration Token 适合团队工具或第三方应用。

它和 Personal Access Token 的区别是：

- Personal Access Token 更适合个人自用。
- Integration Token 更适合一个独立应用长期接入。
- Integration 可以设置授权范围。
- Integration 可以查看访问记录和审计日志。

典型流程：

1. 创建 Integration。
2. 创建 Integration Token。
3. 给 Integration 添加授权范围。
4. 在外部工具中配置 token。
5. 查看 Integration 的访问记录。

授权范围可以限制为：

- 某个空间。
- 某个文件夹。
- 某篇文档。
- 公开文档。

## 10. 权限规则

AI 不能绕过 CloudDoc 权限系统。

实际权限计算可以理解为：

```text
AI 实际能做的事
= 当前用户自己的权限
∩ Token 或 Integration 的能力范围
∩ 授权的空间、文件夹或文档范围
∩ 文档当前状态
```

简单说：

- 你自己不能看的文档，AI 也不能看。
- 你自己不能编辑的文档，AI 也不能编辑。
- 没有授权给 Integration 的文档，Integration 不能访问。
- 分享链接访问始终只读。
- 删除和更新属于高风险操作，需要谨慎授权。

## 11. 审计和安全

CloudDoc 会记录 AI 写入类操作。

MCP 写操作会记录到：

```text
mcp_audit_logs
```

Integration 访问会记录到 Integration 审计日志。

建议：

- 给 AI 最小权限。
- 只授权必要文件夹。
- 创建专门的输出文件夹给 AI 写入。
- 重要文档先让 AI 生成草稿，再由人工确认。
- 定期检查 token 和 Integration 是否仍然需要。

## 12. 推荐新手配置

如果你是第一次使用，建议这样配置：

1. 登录 CloudDoc。
2. 创建一个名为 `AI 输出` 的文件夹。
3. 启动 MCP 服务，并设置 `CLOUDDOC_MCP_ACTOR_EMAIL` 为你的登录邮箱。
4. 在 AI 工具中添加 MCP 地址 `http://127.0.0.1:8010/mcp`。
5. 先让 AI 搜索和总结文档。
6. 确认读取没问题后，再允许 AI 创建新文档。
7. 暂时不要给 AI 删除权限。

推荐给 AI 的第一条指令：

```text
请连接 CloudDoc，列出我最近可访问的 10 篇文档，只显示标题、类型和更新时间。
```

第二条指令：

```text
请读取其中一篇文档，并用 5 条要点总结它。
```

第三条指令：

```text
请把总结写成一篇新 CloudDoc 文档，放到 AI 输出文件夹。
```

## 13. 常见问题

### 13.1 AI 什么都搜不到

检查：

- MCP 服务是否启动。
- AI 工具里 MCP 地址是否正确。
- `CLOUDDOC_MCP_ACTOR_EMAIL` 是否填写了正确邮箱。
- 这个用户是否真的有文档权限。
- 文档是否是私有且不属于该用户。

### 13.2 AI 能读公开文档，但不能读私有文档

通常是因为 MCP 使用了访客身份。

检查是否配置：

```bash
CLOUDDOC_MCP_ACTOR_EMAIL=你的登录邮箱
```

### 13.3 AI 不能写入文档

检查：

- 当前用户是否有编辑权限。
- Token 是否包含写入能力。
- Integration 是否被授权到对应文档或文件夹。
- 文档是否来自分享链接只读访问。

### 13.4 AI 读取画板时看不懂关系

读取画板时使用：

```text
format="ai"
```

不要只让 AI 读取普通 `plain_text`。

### 13.5 不想让 AI 再访问

可以：

- 停止 MCP 服务。
- 删除或禁用 Personal Access Token。
- 删除或禁用 Integration Token。
- 移除 Integration 授权范围。
- 把文档改回私有或取消公开。

## 14. 当前边界

当前 CloudDoc 已经具备 AI 接入基础能力，但还不是完整 AI 知识库产品。

当前没有内置：

- 通用 AI 聊天窗口。
- 自动向量检索。
- 自动 LLM Wiki 维护任务。
- AI Provider 密钥管理的完整产品闭环。
- AI 修改历史的可视化回滚。

这些能力已经在后续 PRD 中规划，但本指南只描述当前已经可以使用的能力。

## 15. 一句话总结

CloudDoc 当前的 AI 能力，是让外部 AI 工具通过 MCP 或 Open API，在权限可控、可审计的前提下读取、搜索、总结、创建和更新 CloudDoc 文档。

