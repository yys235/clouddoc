# CloudDoc

一个在线云文档系统。

当前仓库包含：
- 前端：Next.js，目录 [apps/web](/Users/yys235/projects/clouddoc/apps/web)
- 后端：FastAPI，目录 [apps/api](/Users/yys235/projects/clouddoc/apps/api)
- 数据库：PostgreSQL

## 1. 这个项目能做什么

当前已实现的主功能：
- 文档创建、编辑、自动保存
- PDF 文档上传与阅读
- DOCX 文档导入，导入后转换为可编辑普通文档
- 评论、回复、通知
- 用户注册、登录、组织与成员
- 文档权限：私有 / 公开
- 文档分享：独立链接、密码、过期时间、关闭分享、重置链接
- MCP 接入：供 AI 工具读取文档，并在授权范围内新建/更新文档、评论和收藏

普通文档 REST API 与 MCP 普通工具都按 owner/creator-only 控制：只有文档创建者/拥有者可以通过普通接口增删改查该文档；评论更新和删除只能由评论作者本人操作。对外只读访问请使用独立分享链接。

## 2. 部署前准备

本项目建议使用下面的环境：
- Node.js 20+
- Python 3.9+
- PostgreSQL 14+
- `uv`

如果你只是想先跑起来，至少需要：
- 一个可用的 PostgreSQL 数据库
- 根目录 `.env`

## 3. 配置文件

先复制配置模板：

```bash
cp .env.example .env
```

然后至少修改这几个值：

```env
DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/clouddoc
CLOUDDOC_BACKEND_ORIGIN=http://127.0.0.1:8000
CLOUDDOC_MCP_ACTOR_EMAIL=
```

如果你本机直接访问前端，一般不用改下面两项：

```env
CLOUDDOC_API_BASE_URL=/api
NEXT_PUBLIC_CLOUDDOC_API_BASE_URL=/api
```

## 4. 本地启动

### 4.1 启动后端

```bash
cd /Users/yys235/projects/clouddoc/apps/api
uv sync
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

启动后可访问：

- 健康检查：[http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

### 4.2 启动前端

```bash
cd /Users/yys235/projects/clouddoc/apps/web
npm install
npm run dev
```

启动后可访问：

- 前端首页：[http://127.0.0.1:3000/](http://127.0.0.1:3000/)

## 5. 生产启动

### 5.1 构建前端

```bash
cd /Users/yys235/projects/clouddoc/apps/web
npm install
npm run build
npm run start -- --hostname 127.0.0.1 --port 3100
```

### 5.2 启动后端

```bash
cd /Users/yys235/projects/clouddoc/apps/api
uv sync
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

生产模式常用端口：
- 前端：`3100`
- 后端：`8000`

## 6. 文档导入

CloudDoc 当前支持两类文件入口：
- PDF 上传：生成只读 PDF 文档，用于在线查看或新标签打开原文件。
- DOCX 导入：在新建/上传弹窗选择 `.docx` 文件，系统会解析标题、正文、标题层级、基础列表和表格内容，转换为普通 CloudDoc 文档，导入后可继续编辑。

DOCX 导入会尽量保持原文内容顺序。当前表格会以等宽文本表格块导入，避免内容丢失；图片、页眉页脚、复杂浮动对象等高级结构会在后续版本继续增强。导入失败时请确认文件是标准 `.docx`，而不是旧版 `.doc` 或损坏文件。

## 7. MCP 服务

MCP 服务用于让支持 MCP 的 AI 工具接入 CloudDoc。当前使用 Streamable HTTP 传输，开放受控增删改查工具。

如果你要给外部 AI/自动化系统做标准开放接入，而不是只接 MCP，也可以直接使用：
- PAT / Integration Token
- `/api/open/*` 开放文档与搜索接口
- OAuth 第一阶段接口：授权码、换 access token、refresh token、revoke
- Integration Webhook：签名投递、后台自动重试、手动重放

安装：

```bash
cd /Users/yys235/projects/clouddoc
apps/api/.venv/bin/python -m pip install -e apps/mcp
```

启动：

```bash
cd /Users/yys235/projects/clouddoc
CLOUDDOC_MCP_ACTOR_EMAIL=demo@clouddoc.local apps/api/.venv/bin/clouddoc-mcp
```

默认监听：
- 地址：`http://127.0.0.1:8010/mcp`
- 传输：Streamable HTTP
- 默认无状态会话：`CLOUDDOC_MCP_STATELESS_HTTP=true`

可通过环境变量调整：

```env
CLOUDDOC_MCP_TRANSPORT=streamable-http
CLOUDDOC_MCP_HOST=127.0.0.1
CLOUDDOC_MCP_PORT=8010
CLOUDDOC_MCP_PATH=/mcp
CLOUDDOC_MCP_STATELESS_HTTP=true
CLOUDDOC_MCP_JSON_RESPONSE=true
CLOUDDOC_MCP_TOKEN=
```

如果不设置 `CLOUDDOC_MCP_ACTOR_EMAIL`，服务会使用内置的 `guest@clouddoc.local` 访客身份。该用户不加入任何组织、不拥有任何文档权限，只能访问公开文档或无需登录的分享链接。生产环境建议显式配置为实际 CloudDoc 用户邮箱。

MCP 文档读取工具可以访问 actor 自己创建或拥有的文档，以及公开文档；`clouddoc.list_documents` 和 `clouddoc.search_documents` 支持传入 `folder_id` 限定目录范围。MCP 文档更新/删除仍只能操作 actor 自己创建或拥有的文档，评论更新/删除只能操作 actor 自己写的评论。分享 token 读取工具仍按分享链接规则只读访问。

`clouddoc.get_document` 支持 `format` 参数，默认 `markdown`，方便 AI 直接阅读和摘要：
- `markdown`：返回 Markdown 文本，推荐给 AI 阅读、总结、问答和上下文注入
- `plain_text`：返回纯文本，适合搜索、摘要和低成本上下文
- `content_json`：返回结构化块文档，适合 AI 精确编辑、块级插入、评论锚点和结构化处理
- `full`：同时返回原始内容对象和 Markdown，适合调试或需要完整信息的客户端

已开放读取工具：
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

已开放受控写入/删除工具：
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

写入和删除工具会记录到数据库表 `mcp_audit_logs`。

## 7.1 OAuth 第一阶段

当前仓库已经提供 OAuth 第一阶段的后端和基础前端能力，适合给外部 AI 工具或自动化客户端做标准 Bearer Token 接入。

已提供能力：
- Integration 可配置 `redirect_uris`
- 可旋转一次性 `client_secret`
- 个人配置页可直接保存 OAuth 开关、Redirect URI、轮换 `client_secret`
- 提供基础授权页：`/oauth/authorize?client_id=...&redirect_uri=...&scope=...&state=...`
- `POST /api/oauth/authorize`
- `POST /api/oauth/token`
- `POST /api/oauth/revoke`

当前边界：
- 目前授权页只做基础“允许 / 拒绝”，还没有更细的资源二次选择
- 资源授权范围仍然复用 Integration scope
- Embedding / RAG 还未实现

## 8. Nginx 代理示例

如果你要通过 Nginx 对外提供访问，至少要代理这三类路径：
- `/` -> 前端 `3100`
- `/api/` -> 后端 `8000`
- `/uploads/` -> 后端 `8000`

示例：

```nginx
server {
    listen 8080;
    server_name your-domain-or-ip;

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:8000/uploads/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 9. 第一次启动后会发生什么

后端启动成功后，会自动补运行时需要的数据库字段，并初始化基础数据。

项目里有一个演示文档，常见 ID 是：

```text
11111111-1111-1111-1111-111111111111
```

你可以直接打开：

```text
/docs/11111111-1111-1111-1111-111111111111
```

## 10. 常见问题

### 10.1 页面提示“后端接口当前不可用”

先检查：

```bash
curl http://127.0.0.1:8000/health
```

如果不通，说明后端没启动。

### 10.2 页面能开，但图片不显示

通常是代理层没有转发：
- `/uploads/`

### 10.3 通过代理访问时数据加载失败

通常是代理层没有转发：
- `/api/`

### 10.4 分享链接可以打开，但不应该能编辑

这是设计要求。分享页必须强制只读。

## 11. 常用命令

后端测试：

```bash
cd /Users/yys235/projects/clouddoc/apps/api
.venv/bin/pytest -q
```

前端构建检查：

```bash
cd /Users/yys235/projects/clouddoc/apps/web
npm run build
```

## 12. 其他文档

如果你要继续开发，而不是只部署，可以看归档文档：
- 产品需求：[cloud-doc-prd.md](/Users/yys235/projects/clouddoc/已归档/cloud-doc-prd.md)
- 功能与 UI：[cloud-doc-feature-ui-design.md](/Users/yys235/projects/clouddoc/已归档/cloud-doc-feature-ui-design.md)
- 内容模型：[cloud-doc-content-model.md](/Users/yys235/projects/clouddoc/已归档/cloud-doc-content-model.md)
- 用户系统：[user-system-design.md](/Users/yys235/projects/clouddoc/已归档/user-system-design.md)
- 权限与分享：[document-permission-sharing-prd.md](/Users/yys235/projects/clouddoc/已归档/document-permission-sharing-prd.md)
- MCP 接入：[clouddoc-mcp-design.md](/Users/yys235/projects/clouddoc/已归档/clouddoc-mcp-design.md)
- AI 开放接入：[ai-integration-open-platform-prd.md](/Users/yys235/projects/clouddoc/已归档/ai-integration-open-platform-prd.md)
