# CloudDoc

CloudDoc 是一个在线云文档系统，重点支持“文档 + 画板 + AI 接入”。当前包含：

- Web 前端：Next.js，目录 `apps/web`
- API 后端：FastAPI，目录 `apps/api`
- MCP 服务：Streamable HTTP，目录 `apps/mcp`
- 数据库：PostgreSQL

## 核心功能

- 普通云文档：块式编辑、自动保存、评论、通知、权限、分享链接。
- 文件导入：支持 PDF 上传阅读、DOCX 导入并转换为可编辑文档。
- 画板文档：支持基础流程图图形、表格形状、连接线、撤销/重做、保存。
- 文件夹与空间：支持文档层级目录、文件夹树、移动和整理文档。
- 用户与权限：支持注册登录、组织、私有/公开文档、分享密码和过期时间。

## AI 相关能力

CloudDoc 的 AI 接入目标是让 AI 工具在权限范围内读取、搜索、创建和更新文档。

已实现能力：

- MCP Streamable HTTP 服务，默认地址：`http://127.0.0.1:8010/mcp`
- AI 友好的 Markdown 文档读取：`clouddoc.get_document(format="markdown")`
- 画板 AI 结构化读取：`clouddoc.get_document(format="ai")`
- 文档/文件夹/评论的受控增删改查工具
- Personal Access Token 与 Integration Token
- `/api/open/*` 开放接口
- OAuth 第一阶段：授权码、Token、Revoke
- MCP 写操作审计表：`mcp_audit_logs`

权限规则：

- 未配置 `CLOUDDOC_MCP_ACTOR_EMAIL` 时，MCP 默认使用 `guest@clouddoc.local`，该用户没有任何私有文档权限。
- MCP 可读取 actor 自己创建/拥有的文档，以及公开文档。
- MCP 修改/删除只能操作 actor 自己创建/拥有的文档。
- 评论修改/删除只能操作 actor 自己写的评论。
- 分享链接始终只读，不能通过分享页编辑原文。

常用 MCP 工具：

- 读取：`clouddoc.list_documents`、`clouddoc.search_documents`、`clouddoc.get_document`、`clouddoc.get_comments`
- 文件夹：`clouddoc.list_spaces`、`clouddoc.list_folders`、`clouddoc.get_folder_tree`
- 写入：`clouddoc.create_document`、`clouddoc.create_folder`、`clouddoc.update_document_from_markdown`
- 删除/恢复：`clouddoc.delete_document`、`clouddoc.restore_document`

## 部署步骤

### 1. 准备环境

需要安装：

- Node.js 20+
- Python 3.9+
- PostgreSQL 14+
- `uv`

### 2. 配置环境变量

复制配置模板：

```bash
cp .env.example .env
```

至少修改数据库连接：

```env
DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/clouddoc
CLOUDDOC_BACKEND_ORIGIN=http://127.0.0.1:8000
```

如果要指定 MCP 使用哪个用户身份访问文档：

```env
CLOUDDOC_MCP_ACTOR_EMAIL=demo@clouddoc.local
```

如果留空，则使用无权限访客 `guest@clouddoc.local`。

如果需要手动初始化一个空 PostgreSQL 数据库，可以执行当前基线脚本：

```bash
psql "postgresql://user:password@localhost:5432/clouddoc" -f apps/api/sql/001_init.sql
```

正常启动后端时也会自动执行 SQLAlchemy 建表和运行态 schema 补丁；手动 SQL 主要用于部署前预初始化或排查新库缺表问题。

### 3. 启动后端 API

```bash
cd apps/api
uv sync
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

检查后端：

```bash
curl http://127.0.0.1:8000/health
```

### 4. 启动前端 Web

```bash
cd apps/web
npm install
npm run dev -- --hostname 127.0.0.1 --port 3100
```

访问：

```text
http://127.0.0.1:3100
```

首次部署空库时会自动进入：

```text
http://127.0.0.1:3100/setup
```

按向导创建第一个系统管理员、默认组织和默认空间。生产环境建议先配置：

```env
CLOUDDOC_SETUP_TOKEN=replace-with-a-random-secret
CLOUDDOC_AUTO_SEED_DEMO=false
```

如果是无人值守部署，也可以用 CLI 直接完成初始化：

```bash
cd apps/api
uv run python -m app.cli init-system \
  --admin-email admin@example.com \
  --admin-name Admin \
  --admin-password 'change-this-password' \
  --organization-name 'CloudDoc Org' \
  --space-name '产品空间' \
  --space-visibility organization \
  --allow-open-api true \
  --allow-user-pat true \
  --import-demo-data false
```

初始化完成后，超级管理员可在“个人配置”页面查看系统初始化摘要和最近系统审计。

### 5. 启动 MCP 服务

先安装 MCP 包：

```bash
apps/api/.venv/bin/python -m pip install -e apps/mcp
```

启动服务：

```bash
apps/api/.venv/bin/clouddoc-mcp
```

默认配置：

```env
CLOUDDOC_MCP_TRANSPORT=streamable-http
CLOUDDOC_MCP_HOST=127.0.0.1
CLOUDDOC_MCP_PORT=8010
CLOUDDOC_MCP_PATH=/mcp
CLOUDDOC_MCP_STATELESS_HTTP=true
CLOUDDOC_MCP_JSON_RESPONSE=true
```

MCP 地址：

```text
http://127.0.0.1:8010/mcp
```

## 生产运行

前端构建并启动：

```bash
cd apps/web
npm install
npm run build
npm run start -- --hostname 127.0.0.1 --port 3100
```

后端生产启动：

```bash
cd apps/api
uv sync
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## Nginx 代理

代理时至少要转发三类路径：

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

## 常用命令

后端测试：

```bash
cd apps/api
.venv/bin/pytest -q
```

MCP 测试：

```bash
cd apps/mcp
../api/.venv/bin/pytest -q
```

前端构建检查：

```bash
cd apps/web
npm run build
```

## 常见问题

### 页面提示后端接口不可用

先检查后端：

```bash
curl http://127.0.0.1:8000/health
```

如果不通，说明 API 服务没有启动或数据库连接失败。

### 图片通过 Nginx 代理后无法显示

检查 Nginx 是否代理了 `/uploads/`。

### 数据通过 Nginx 代理后无法加载

检查 Nginx 是否代理了 `/api/`。

## 更多文档

- MCP 设计：`已归档/clouddoc-mcp-design.md`
- AI 开放平台 PRD：`已归档/ai-integration-open-platform-prd.md`
- 首次部署初始化 PRD：`已归档/system-initialization-onboarding-prd.md`
- 权限与分享 PRD：`已归档/document-permission-sharing-prd.md`
- 画板 PRD：`已归档/basic-board-v1-prd.md`
- 开发进度：`DEVELOPMENT_PROGRESS.md`
