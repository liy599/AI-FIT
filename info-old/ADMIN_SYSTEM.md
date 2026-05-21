# AI-FIT 最轻量管理员体系（DB is_admin）

## 目标

- 管理员身份写入数据库（`users.is_admin`），运行时不再用 `ADMIN_EMAIL` 邮箱比对
- 提供最少但可用的后台能力（2+1）：
  - /admin/data-lifecycle（已存在）
  - /admin/feedback（复用 GET /api/feedback）
  - /admin/users（新增用户概览）

## 后端改动

### 1) users 表新增 is_admin 字段

- 模型字段：`User.is_admin`（boolean，默认 false，非空）
  - [models.py](file:///f:/学校/大四下/毕设/AI-FIT/backend/app/models.py#L19-L33)
- 迁移脚本（新增列，且带 server_default=0 以兼容已有数据）
  - [395ab095b09c_add_is_admin_to_users.py](file:///f:/学校/大四下/毕设/AI-FIT/backend/migrations/versions/395ab095b09c_add_is_admin_to_users.py)

### 2) 登录/注册/me 返回 is_admin 改为读 DB 字段

- `_is_admin_user` / `_auth_user`：不再读取 `ADMIN_EMAIL`，直接返回 `u.is_admin`
  - [auth.py](file:///f:/学校/大四下/毕设/AI-FIT/backend/app/routes/account/auth.py#L16-L29)

### 3) 统一 admin-only 守卫：以 DB 字段为准

- Admin Data Lifecycle：`_admin_guard()` 使用 `user.is_admin`
  - [lifecycle.py](file:///f:/学校/大四下/毕设/AI-FIT/backend/app/routes/admin/lifecycle.py#L33-L40)
- Feedback 列表：GET `/api/feedback` 使用 `current_user.is_admin`
  - [feedback.py](file:///f:/学校/大四下/毕设/AI-FIT/backend/app/routes/account/feedback.py#L13-L24)

### 4) ADMIN_EMAIL 幂等提权种子机制（仅用于初始化/提权）

启动时如果配置 `ADMIN_EMAIL`，且数据库中存在该邮箱用户，则将其 `is_admin=true`（幂等：已是管理员则不会重复写入）。

- 实现：`_ensure_admin_seed(app)`
  - [__init__.py](file:///f:/学校/大四下/毕设/AI-FIT/backend/app/__init__.py#L24-L40)
- 调用位置：`create_app()` 的 `app.app_context()` 启动逻辑中
  - [__init__.py](file:///f:/学校/大四下/毕设/AI-FIT/backend/app/__init__.py#L135-L141)

说明：

- 运行时管理员判断只看 `users.is_admin`；即使移除 `ADMIN_EMAIL`，管理员仍保留（因为已写入 DB）
- 生产环境启动校验不再强制要求 `ADMIN_EMAIL`（避免移除后启动失败）
  - [_validate_production_config](file:///f:/学校/大四下/毕设/AI-FIT/backend/app/__init__.py#L146-L168)

### 5) 新增 Admin Users API

- GET `/api/admin/users?page=&page_size=`（admin-only）
  - [routes/admin/users.py](file:///f:/学校/大四下/毕设/AI-FIT/backend/app/routes/admin/users.py#L1-L40)
- 注册蓝图：
  - [app/__init__.py](file:///f:/学校/大四下/毕设/AI-FIT/backend/app/__init__.py#L74-L103)

返回字段：

- `id/username/email/created_at/is_admin`

## 前端改动

### 1) admin 守卫维持不变：只看 auth.user.is_admin

- `RequireAdmin`：未登录跳登录；非管理员跳首页
  - [App.tsx](file:///f:/学校/大四下/毕设/AI-FIT/frontend/src/App.tsx#L42-L57)

### 2) 新增后台页面与路由

- `/admin/data-lifecycle`（已存在）：[AdminDataLifecyclePage.tsx](file:///f:/学校/大四下/毕设/AI-FIT/frontend/src/pages/admin/AdminDataLifecyclePage.tsx)
- `/admin/feedback`（新增）：[AdminFeedbackPage.tsx](file:///f:/学校/大四下/毕设/AI-FIT/frontend/src/pages/admin/AdminFeedbackPage.tsx)
- `/admin/users`（新增）：[AdminUsersPage.tsx](file:///f:/学校/大四下/毕设/AI-FIT/frontend/src/pages/admin/AdminUsersPage.tsx)
- 路由注册（adminRoutes）：[App.tsx](file:///f:/学校/大四下/毕设/AI-FIT/frontend/src/App.tsx#L103-L107)

### 3) 前端 API

- 复用反馈列表 API：`listRecentFeedback()`（补齐分页返回类型）
  - [modules/app/index.ts](file:///f:/学校/大四下/毕设/AI-FIT/frontend/src/modules/app/index.ts#L1-L18)
- 新增 admin users API：`listAdminUsers()`
  - [modules/admin/index.ts](file:///f:/学校/大四下/毕设/AI-FIT/frontend/src/modules/admin/index.ts)

## 运维与使用说明

### 1) 数据库迁移（推荐）

在执行 Flask-Migrate 相关命令时，建议设置 `DB_AUTO_INIT=0`，避免启动阶段的 `ensure_food_seed_data()` 在“表尚未创建/升级”时触发查询报错。

PowerShell 示例（Windows）：

```powershell
cd F:\学校\大四下\毕设\AI-FIT\backend
$env:DB_AUTO_INIT="0"
python -m flask --app wsgi db upgrade
```

### 2) 初始化管理员（验收用法）

1. 设置环境变量：`ADMIN_EMAIL=某邮箱`
2. 用该邮箱注册用户
3. 重启后端（`create_app()` 启动时会提权一次）
4. 之后可移除 `ADMIN_EMAIL`，管理员仍保留（因为 `users.is_admin=true` 已写入 DB）

### 3) 如何撤销管理员

- 直接在数据库中将目标用户的 `is_admin` 更新为 `false`

## 验证

- 后端测试通过（包含提权种子机制测试）：[test_admin_seed.py](file:///f:/学校/大四下/毕设/AI-FIT/backend/tests/test_admin_seed.py)
- 前端 TypeScript typecheck 通过
  - PowerShell 环境如果遇到 npm.ps1 执行策略限制，可使用 `npm.cmd` 运行脚本（例如 `npm.cmd run typecheck`）

