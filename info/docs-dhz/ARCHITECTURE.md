# AI-FIT 架构地图

## 1. 范围
本文定义 AI-FIT 当前真实架构，以及模块之间的边界。它是后续重构和生产加固的基线文档。

## 2. 当前技术栈
- 前端：React 18 + TypeScript + Vite。
- 后端：Flask + Flask-JWT-Extended + Flask-SQLAlchemy。
- 数据库：PostgreSQL 16。
- 反向代理 / Edge：Caddy（容器）、Nginx（前端静态容器）。
- 运行时：Docker Compose（db、backend、web、caddy）。

## 3. 运行拓扑
- `caddy` 作为公网入口，转发到 `web`（前端静态服务），并将 `/api` 转发到 `backend`。
- `backend` 连接 `db`（PostgreSQL）。
- `backend` 文件存储挂载到容器 volume `aifitguard_uploads`，容器内路径为 `/app/instance/uploads`。

参考文件：`docker-compose.yml`、`Caddyfile`、`frontend/Dockerfile`、`backend/app/__init__.py`。

## 4. 前端架构
- 入口：`frontend/src/main.tsx`。
- 路由：`frontend/src/App.tsx`。
- 功能页面：
  - Auth/Profile：`frontend/src/pages/LoginPage.tsx`、`ProfilePage.tsx`。
  - Blog：`BlogListPage.tsx`、`BlogDetailPage.tsx`。
  - Food：`FoodModulePage.tsx`、`FoodMealPage.tsx`。
  - Pose：`PoseToolPage.tsx`、`PoseTrainingHistoryPage.tsx`、`PoseTrainingReportPage.tsx`。
- API client 层：`frontend/src/lib/api.ts`、`poseApi.ts`、`food/api.ts`。
- Auth 状态：`frontend/src/state/auth-context.tsx`、`frontend/src/lib/auth.ts`。

## 5. 后端架构
- App factory：`backend/app/__init__.py`。
- 配置：`backend/app/config.py`。
- 扩展初始化：`backend/app/extensions.py`。
- Blueprint 注册位置：app factory。
- 已注册 API 前缀：
  - `/api/auth`
  - `/api/user`
  - `/api/workouts`
  - `/api/tags`
  - `/api/blogs`
  - `/api`（comments routes）
  - `/api/feedback`
  - `/api/food`
  - `/api/foods`
  - `/api/meals`
  - `/api/pose`
  - `/api/recognize`
  - `/api/admin`
- Service 层：
  - Food services：`backend/app/services/food/*`。
  - Pose policy service：`backend/app/services/pose/policy.py`。
- Utility 层：
  - 密码与安全：`backend/app/utils/security.py`。
  - 限流：`backend/app/utils/rate_limit.py`。
  - 上传访问 token：`backend/app/utils/upload_access.py`。
  - 隐私加密 helper：`backend/app/utils/privacy.py`。

## 6. 领域模块
- Identity/Auth：注册、登录、找回密码、重置密码、用户资料。
- Content：博客、评论、标签。
- Training basics：普通训练记录。
- Food：食物目录、餐食、图片识别流程。
- Pose：本地推理、后端 policy、训练 session/report 持久化。
- Admin：数据生命周期策略和清理。

## 7. 数据边界
- 核心实体：users、blogs/comments、courses、workouts、foods/meals、training_sessions/training_sets。
- Pose 当前只保存训练摘要和报告 JSON，不保存原始视频，也不创建服务端分析任务。
- 上传路径：
  - 公开前缀：`avatars`、`blog_covers`。
  - 私有文件：访问 `/uploads/*` 时需要签名 token。

## 8. 当前架构风险
- schema 生命周期必须坚持 migration 管理，避免生产环境依赖运行时自动建表。
- 限流需要 Redis 等外部存储支撑多进程/多实例部署。
- JWT 生命周期仍需进一步完善 refresh/blacklist 策略。
- secret 管理还需要生产级加固。

## 9. 下一阶段架构目标
- 持续完善 Alembic / Flask-Migrate 流程。
- 将分布式限流存储外置到 Redis。
- 增加可观测性基线：结构化日志、指标、告警。
- 加固 auth 生命周期：refresh token + token revoke 模型。
