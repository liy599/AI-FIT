# 后端配置

## 必需安全配置
- `APP_ENV`：生产环境必须设置为 `production`。
- `DB_AUTO_INIT`：生产环境必须为 `0`，schema 由 migration 管理；非生产环境只影响启动 seed 行为。
- `SECRET_KEY`：Flask 签名密钥。
- `JWT_SECRET_KEY`：JWT 签名密钥。
- `DATABASE_URL`：SQLAlchemy 数据库连接串。
- `FRONTEND_BASE_URL`：前端标准 origin。
- `ADMIN_EMAIL`：管理员身份标识，用于受限 API。
- `REDIS_URL`：生产环境必须配置，用于分布式限流。

## Pose Policy 配置
- `POSE_POLICY_LIVE_TARGET_FPS`
- `POSE_POLICY_LIVE_SESSION_LIMIT_SECONDS`
- `POSE_POLICY_OFFLINE_MAX_VIDEO_BYTES`
- `POSE_POLICY_OFFLINE_ANALYSIS_LIMIT_SECONDS`
- `POSE_POLICY_OFFLINE_ANALYSIS_TARGET_FPS`
- `POSE_POLICY_OFFLINE_ALLOWED_ACTIONS`

以上配置由后端读取，并通过 `GET /api/pose/policy` 返回。前端运行行为应由后端 policy 控制，避免在页面里硬编码策略常量。

## 可选能力
- `AI_REPORT_*` / `STEPFUN_*`：AI 增强能力配置，当前用于食物识别等非 Pose 主链路能力。

## 限流配置
- `RATE_LIMIT_ENABLED`
- `AUTH_LOGIN_*`
- `AUTH_FORGOT_*`
- `FEEDBACK_*`

## 运维规则
- `.env.example` 不能包含真实生产密钥。
- 如果密钥曾被提交到仓库，必须立即轮换。

## 生产部署实践
- 不要直接把 `.env.example` 当作运行时配置。
- 在服务器上创建真实运行时 env 文件，例如 `/etc/aifit/backend.env`，或通过容器/编排平台注入 secret。
- 使用强密钥：
  - `SECRET_KEY`：至少 32 字节随机值。
  - `JWT_SECRET_KEY`：至少 32 字节随机值。
  - `DATA_ENCRYPTION_KEY`：使用 Fernet 兼容 key。
- 生产环境显式设置：
  - `APP_ENV=production`
  - `DB_AUTO_INIT=0`
  - `FRONTEND_BASE_URL=https://your-frontend-domain`
  - `CORS_ORIGINS=https://your-frontend-domain`
  - `DATABASE_URL=postgresql+psycopg://<user>:<pass>@<db-host>:5432/<db-name>`
  - `REDIS_URL=redis://<redis-host>:6379/0`
  - Pose 推理保持本地化；后端 Pose video/task/server-analysis 接口按设计不可用。

## 迁移流程
- 先安装依赖并设置 env。
- 首次初始化 migration 仓库：
  - `flask --app run.py db init`
- 模型变更后创建 migration：
  - `flask --app run.py db migrate -m "describe change"`
- 应用 migration：
  - `flask --app run.py db upgrade`
- 生产启动应用前必须先执行 `db upgrade`。
- 应用运行时不负责自动创建生产 schema，schema 必须由 migration 管理。
