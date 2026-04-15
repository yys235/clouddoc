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

## 6. MCP 服务

MCP 服务用于让支持 MCP 的 AI 工具接入 CloudDoc。当前使用 Streamable HTTP 传输，开放受控增删改查工具。

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
```

如果不设置 `CLOUDDOC_MCP_ACTOR_EMAIL`，服务会使用内置的 `guest@clouddoc.local` 访客身份。该用户不加入任何组织、不拥有任何文档权限，只能访问公开文档或无需登录的分享链接。生产环境建议显式配置为实际 CloudDoc 用户邮箱。

MCP 文档读取工具可以访问 actor 自己创建或拥有的文档，以及公开文档；`clouddoc.list_documents` 和 `clouddoc.search_documents` 支持传入 `folder_id` 限定目录范围。MCP 文档更新/删除仍只能操作 actor 自己创建或拥有的文档，评论更新/删除只能操作 actor 自己写的评论。分享 token 读取工具仍按分享链接规则只读访问。

已开放读取工具：
- `clouddoc.list_documents`
- `clouddoc.search_documents`
- `clouddoc.get_document`
- `clouddoc.get_comments`
- `clouddoc.list_spaces`
- `clouddoc.get_shared_document`

已开放受控写入/删除工具：
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

写入和删除工具会记录到数据库表 `mcp_audit_logs`。

## 7. Nginx 代理示例

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

## 8. 第一次启动后会发生什么

后端启动成功后，会自动补运行时需要的数据库字段，并初始化基础数据。

项目里有一个演示文档，常见 ID 是：

```text
11111111-1111-1111-1111-111111111111
```

你可以直接打开：

```text
/docs/11111111-1111-1111-1111-111111111111
```

## 9. 常见问题

### 9.1 页面提示“后端接口当前不可用”

先检查：

```bash
curl http://127.0.0.1:8000/health
```

如果不通，说明后端没启动。

### 9.2 页面能开，但图片不显示

通常是代理层没有转发：
- `/uploads/`

### 9.3 通过代理访问时数据加载失败

通常是代理层没有转发：
- `/api/`

### 9.4 分享链接可以打开，但不应该能编辑

这是设计要求。分享页必须强制只读。

## 10. 常用命令

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

## 11. 其他文档

如果你要继续开发，而不是只部署，可以看归档文档：
- 产品需求：[cloud-doc-prd.md](/Users/yys235/projects/clouddoc/已归档/cloud-doc-prd.md)
- 功能与 UI：[cloud-doc-feature-ui-design.md](/Users/yys235/projects/clouddoc/已归档/cloud-doc-feature-ui-design.md)
- 内容模型：[cloud-doc-content-model.md](/Users/yys235/projects/clouddoc/已归档/cloud-doc-content-model.md)
- 用户系统：[user-system-design.md](/Users/yys235/projects/clouddoc/已归档/user-system-design.md)
- 权限与分享：[document-permission-sharing-prd.md](/Users/yys235/projects/clouddoc/已归档/document-permission-sharing-prd.md)
- MCP 接入：[clouddoc-mcp-design.md](/Users/yys235/projects/clouddoc/已归档/clouddoc-mcp-design.md)
