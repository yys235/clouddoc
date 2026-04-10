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

## 6. Nginx 代理示例

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

## 7. 第一次启动后会发生什么

后端启动成功后，会自动补运行时需要的数据库字段，并初始化基础数据。

项目里有一个演示文档，常见 ID 是：

```text
11111111-1111-1111-1111-111111111111
```

你可以直接打开：

```text
/docs/11111111-1111-1111-1111-111111111111
```

## 8. 常见问题

### 8.1 页面提示“后端接口当前不可用”

先检查：

```bash
curl http://127.0.0.1:8000/health
```

如果不通，说明后端没启动。

### 8.2 页面能开，但图片不显示

通常是代理层没有转发：
- `/uploads/`

### 8.3 通过代理访问时数据加载失败

通常是代理层没有转发：
- `/api/`

### 8.4 分享链接可以打开，但不应该能编辑

这是设计要求。分享页必须强制只读。

## 9. 常用命令

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

## 10. 其他文档

如果你要继续开发，而不是只部署，可以看这些文档：
- 产品需求：[cloud-doc-prd.md](/Users/yys235/projects/clouddoc/cloud-doc-prd.md)
- 功能与 UI：[cloud-doc-feature-ui-design.md](/Users/yys235/projects/clouddoc/cloud-doc-feature-ui-design.md)
- 内容模型：[cloud-doc-content-model.md](/Users/yys235/projects/clouddoc/cloud-doc-content-model.md)
- 用户系统：[user-system-design.md](/Users/yys235/projects/clouddoc/user-system-design.md)
- 权限与分享：[document-permission-sharing-prd.md](/Users/yys235/projects/clouddoc/document-permission-sharing-prd.md)
