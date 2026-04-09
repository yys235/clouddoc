# 用户系统设计文档

## 1. 文档目标

本文档定义 CloudDoc 的用户系统设计，用于支撑以下能力：

- 账号注册与登录
- 组织与成员管理
- 个人空间与团队空间
- 文档访问控制
- 评论、收藏、分享、审计等行为的身份归属
- 后续接入邀请、外部协作者、权限升级与审计

本文档优先考虑当前项目现状：

- 后端已存在 `users / organizations / organization_members / spaces` 基础模型
- 文档、模板、评论、收藏、分享都已经引用 `users.id`
- 当前系统仍使用“默认用户”方式运行，没有正式鉴权链路

目标不是推翻现有结构，而是在现有结构上补齐一套可逐步落地的用户系统。

---

## 2. 设计原则

### 2.1 渐进式落地

首期先建立“真实身份 + 当前登录用户 + 基础组织成员”闭环，不一次性引入过重的权限系统。

### 2.2 身份与内容解耦

用户系统负责：

- 认证
- 当前用户识别
- 组织与成员关系
- 角色与权限判断

文档系统继续负责：

- 文档内容
- 评论锚点
- 模板
- 搜索
- 分享

### 2.3 最小权限可用

先解决以下核心问题：

- 谁创建了文档
- 谁可以编辑
- 谁可以删除评论
- 谁可以访问某个空间

### 2.4 向正式协作场景兼容

设计要兼容后续能力：

- 邮箱邀请
- 多组织切换
- 外部协作者
- SSO / 企业登录
- 审计日志

---

## 3. 当前状态评估

当前数据库中已经具备以下基础表：

- `users`
- `organizations`
- `organization_members`
- `spaces`
- `documents`
- `document_permissions`
- `document_favorites`
- `comment_threads`
- `comments`
- `shares`
- `templates`

当前缺失的核心不是表结构，而是“当前请求用户”的正式来源。现阶段很多逻辑通过“默认用户”工作，例如：

- `get_default_user_id(db)`
- 评论作者默认回退到首个用户
- 收藏操作默认绑定首个用户

这意味着：

- 数据模型已经具备真实用户语义
- 但鉴权入口还没有建立
- 需要优先补齐“认证 + 当前用户上下文”

---

## 4. 目标范围

## 4.1 V1 必做

- 用户注册
- 用户登录
- 当前用户识别
- 退出登录
- 组织创建
- 组织成员关系
- 个人空间自动创建
- 团队空间归属组织
- 基础角色：
  - `owner`
  - `admin`
  - `member`
- 基础权限判断：
  - 文档查看
  - 文档编辑
  - 文档管理
  - 评论创建 / 删除

## 4.2 V1.5 建议做

- 邮箱邀请成员
- 成员列表管理
- 切换当前组织
- 软删除用户
- 操作审计基础字段

## 4.3 V2 再做

- 外部协作者
- SSO / OAuth 登录
- 多因素认证
- 设备管理
- 更细的 RBAC / ABAC

---

## 5. 用户域模型

## 5.1 User

表示一个自然人身份。

建议字段：

- `id`
- `name`
- `email`
- `phone`
- `avatar`
- `password_hash`
- `status`
- `last_login_at`
- `created_at`
- `updated_at`

说明：

- `email` 应唯一
- `phone` 可选唯一
- `status` 建议支持：
  - `active`
  - `invited`
  - `suspended`
  - `deleted`

## 5.2 Organization

表示团队/企业容器。

建议字段：

- `id`
- `name`
- `owner_id`
- `plan_type`
- `status`
- `created_at`
- `updated_at`

## 5.3 OrganizationMember

表示用户与组织关系。

建议字段：

- `id`
- `organization_id`
- `user_id`
- `role`
- `status`
- `joined_at`
- `invited_by`

角色建议：

- `owner`
- `admin`
- `member`

状态建议：

- `active`
- `invited`
- `disabled`

## 5.4 Session

用于浏览器登录态管理。

建议新增表：

- `user_sessions`

建议字段：

- `id`
- `user_id`
- `token_hash`
- `user_agent`
- `ip_address`
- `expires_at`
- `revoked_at`
- `created_at`
- `updated_at`

说明：

- 数据库存 `token_hash`，不直接存明文 token
- 浏览器 cookie 中保存 session token

## 5.5 Invitation

用于组织邀请。

建议新增表：

- `organization_invitations`

建议字段：

- `id`
- `organization_id`
- `email`
- `role`
- `invited_by`
- `token_hash`
- `status`
- `expires_at`
- `accepted_at`
- `created_at`

---

## 6. 认证设计

## 6.1 认证方式

V1 推荐：

- 邮箱 + 密码
- Session Cookie

不推荐首期直接用 JWT 作为浏览器主登录态，原因：

- 当前产品是典型 Web 应用
- 服务端渲染页面较多
- Session 更适合浏览器登录、退出、失效管理、设备撤销

## 6.2 密码方案

- 算法：`bcrypt` 或 `argon2id`
- 只存 `password_hash`
- 不存明文密码

## 6.3 登录态方案

登录成功后：

1. 创建 `user_sessions`
2. 生成随机 session token
3. token 哈希后存库
4. 明文 token 写入 HttpOnly Cookie

Cookie 建议：

- `HttpOnly`
- `Secure`（生产环境）
- `SameSite=Lax`

## 6.4 当前用户解析

后端统一新增：

- `get_current_user()`
- `get_current_membership()`

所有需要身份的接口都通过它获取当前用户，而不是继续走默认用户。

---

## 7. 当前用户上下文

每个请求需要明确以下上下文：

- 当前用户是谁
- 当前用户属于哪个组织
- 当前用户在当前组织内是什么角色
- 当前用户是否有目标空间/文档访问权限

建议请求上下文结构：

```ts
type CurrentUserContext = {
  userId: string;
  organizationId: string | null;
  role: "owner" | "admin" | "member" | null;
};
```

说明：

- 用户可以没有组织，只拥有个人空间
- 访问团队空间时必须解析当前组织关系

---

## 8. 空间与用户关系

## 8.1 个人空间

每个用户注册成功后，自动创建一个个人空间：

- `space_type = personal`
- `owner_id = user.id`
- `organization_id = null`

规则：

- 仅本人可管理
- 默认不对组织成员公开

## 8.2 团队空间

团队空间属于组织：

- `space_type = team`
- `organization_id != null`

规则：

- `owner/admin` 可管理空间
- `member` 按空间/文档权限使用

---

## 9. 权限模型

## 9.1 角色层

组织层角色：

- `owner`
- `admin`
- `member`

组织层职责：

- `owner`
  - 管理组织
  - 管理成员
  - 删除组织
  - 管理全部团队空间
- `admin`
  - 管理成员（部分）
  - 管理空间和文档
- `member`
  - 使用空间和文档

## 9.2 资源层权限

文档层权限继续保留：

- `view`
- `edit`
- `manage`

文档最终权限判断顺序建议：

1. 系统角色（owner/admin）
2. 空间归属权限
3. 文档显式 ACL
4. 分享链接权限

## 9.3 评论权限

评论规则建议：

- `view` 文档的人可见评论
- `comment` 可由 `edit` 权限隐式包含
- 评论删除：
  - 评论作者可以删自己的评论
  - 文档管理者可以删任意评论
  - 组织 `owner/admin` 可删任意评论

删除建议使用软删除：

- `comments.is_deleted = true`
- UI 显示“该评论已删除”

线程最后一条评论删除后的策略：

- 若线程无有效评论，可自动删除线程
- 或保留线程但标记 `resolved/deleted`

建议 V1：

- 若线程下所有评论都删空，则删除线程

---

## 10. 数据库调整建议

## 10.1 复用现有表

现有表保留：

- `users`
- `organizations`
- `organization_members`
- `spaces`

## 10.2 必要新增字段

`users`

- `password_hash`
- `status`
- `last_login_at`

`organizations`

- `status`

`organization_members`

- `invited_by`

## 10.3 新增表

- `user_sessions`
- `organization_invitations`

---

## 11. 接口设计

## 11.1 Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

## 11.2 Organization

- `POST /api/organizations`
- `GET /api/organizations/current`
- `GET /api/organizations/{id}/members`
- `POST /api/organizations/{id}/invite`
- `PATCH /api/organizations/{id}/members/{memberId}`

## 11.3 Session

- `GET /api/sessions`
- `DELETE /api/sessions/{id}`

---

## 12. 前端设计

## 12.1 登录态管理

前端不直接保存用户密码或 token 明文到 localStorage。

建议：

- 浏览器依赖 HttpOnly Cookie
- 前端通过 `/api/auth/me` 获取当前用户
- 使用全局 `CurrentUserProvider`

## 12.2 页面行为

未登录：

- 跳转登录页
- 或仅开放公开分享页

已登录：

- 进入默认组织或个人空间
- 侧栏展示当前用户信息与组织上下文

## 12.3 评论和删除按钮显示

前端应根据当前用户上下文决定：

- 是否显示“删除评论”
- 是否显示“邀请成员”
- 是否显示“空间管理”

---

## 13. 与当前系统的迁移方案

## Phase 1：建立真实当前用户

目标：

- 保留现有数据模型
- 替换 `get_default_user_id(db)`

改动：

- 增加 auth 路由
- 引入 session cookie
- 所有文档、收藏、评论接口改为读取 `current_user`

## Phase 2：接组织成员关系

目标：

- 团队空间和组织成员绑定
- 评论、收藏、模板都使用真实用户

## Phase 3：接邀请与成员管理

目标：

- 支持多人团队落地使用

---

## 14. 评论删除与用户系统关系

这是当前最直接的业务驱动点。

如果没有用户系统：

- 无法明确谁能删除评论
- 无法做“仅作者可删”
- 无法做管理员越权删除

因此评论删除不一定要求完整用户系统，但至少要求：

- 有真实用户身份
- 有当前用户上下文
- 有评论作者字段

本设计已经覆盖这三点。

---

## 15. 风险与取舍

### 15.1 过早做复杂权限

风险：

- 会拖慢文档主线功能

策略：

- 先做组织角色 + 文档 ACL 两层即可

### 15.2 用默认用户继续推进

风险：

- 评论、收藏、分享等行为无法准确归属
- 后续迁移成本更高

策略：

- 尽快完成 `current_user` 接入

### 15.3 直接上 JWT

风险：

- 浏览器场景退出、失效管理更复杂

策略：

- 首期优先 session cookie

---

## 16. 最终建议

用户系统的最佳落地顺序：

1. 先做 `auth + current_user + session`
2. 再把评论、收藏、模板、文档创建改成真实用户归属
3. 再补组织成员与邀请
4. 最后再做更复杂的权限和企业登录

这条路线和当前代码结构最兼容，改动最小，也最能解决评论删除、权限归属和多人协作的实际问题。
