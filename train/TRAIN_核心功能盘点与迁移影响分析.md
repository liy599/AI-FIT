# Train 子项目核心功能盘点与迁移影响分析

本文档用于回答：`train/` 使用了什么技术架构、已实现了哪些功能与接口、数据如何落库、以及迁移/集成到主项目（仓库根部的 `backend/` + `frontend/`）会涉及哪些模块。

## 结论摘要

`train/` 是一个可独立运行的 Next.js 14（App Router）“全栈”应用：它同时包含页面、API（Route Handlers）、鉴权、数据库（Prisma + SQLite）、文件上传/视频播放、动作分析与报告生成。

核心闭环已经完成：

- 注册/登录（Cookie Session）
- 训练记录（训练会话 + sets）
- 视频上传/选择 + 创建分析任务
- 两种分析执行模式：
  - 默认“前端分析”（浏览器逐帧提关键点 → 生成报告 → 回写后端完成任务）
  - 可切换“后端内置 worker”（in-process 队列，适合开发/单进程，不适合生产多实例）

集成进主项目时，最大改动集中在：鉴权统一、数据库模型迁移、文件存储与 Range 流、分析任务执行模型（异步队列/worker 形态）。

## 技术架构与关键依赖

### 技术栈

- 应用框架：Next.js 14 App Router + React 18 + TypeScript（见 `train/package.json`）
- 数据库：Prisma ORM + SQLite（`DATABASE_URL=file:./dev.db`，见 `train/prisma/schema.prisma` 与 `train/.env.example`）
- 鉴权：基于 Cookie 的 Session（httpOnly cookie 存明文 token，DB 存 token hash），见 `train/src/lib/auth.ts`
- 姿态/动作：
  - `@mediapipe/tasks-vision`（关键点提取，离线视频提取 `pose33`）
  - `@tensorflow-models/pose-detection` + `@tensorflow/tfjs-*`（实时 MoveNet 追踪/平滑）
- 文件/视频：本地落盘 `uploads/` + 视频 Range 流式接口

### 运行方式（train 自身）

- 开发：`npm i` → `npm run db:migrate` → `npm run dev`
- 生产：`npm ci` → `npx prisma migrate deploy` → `npm run build` → `npm run start`

关键环境变量（见 `train/.env.example`）：

- `DATABASE_URL`：Prisma 连接串（SQLite）
- `UPLOADS_DIR`：上传根目录（默认 `./uploads`）
- `CLIENT_POSE_ENABLED`：`0` 时强制走后端 worker；不设置/非 `0` 时走前端分析

## 目录结构速览（只列关键）

- `train/src/app/**`：页面（Next App Router）
- `train/src/app/api/**/route.ts`：API Route Handlers
- `train/src/lib/**`：核心业务库
  - `auth.ts`：Session cookie 鉴权
  - `db.ts`：PrismaClient 单例
  - `uploads.ts`：落盘上传工具
  - `analysisWorker.ts`：后端内置分析队列（globalThis + setTimeout）
  - `pose/**`：动作/姿态核心算法与报告生成
  - `report/**`：报告归档与 PDF 渲染（统一 report schema）
- `train/prisma/**`：Prisma schema 与 migrations
- `train/tests/**`：node --test 单测/端到端

## 已实现功能（页面）

- 账号：登录/注册
  - `train/src/app/login/page.tsx`
  - `train/src/app/register/page.tsx`
- 仪表盘：近 7 天训练、近 30 天分析、是否有进行中训练
  - `train/src/app/dashboard/DashboardClient.tsx`
- 训练记录（Training Log）
  - 训练会话：创建/编辑 sets、完成并生成 report
  - 历史：日历视图、删除；部分统计为占位
  - 相关页面：`train/src/app/train/*`、`train/src/app/history/*`
- 离线视频分析（Analysis Jobs）
  - 创建任务：上传或选择已上传视频，选择动作/视角/指令
  - 任务详情：轮询状态、运行前端分析并回写报告、导出 PDF
  - 相关页面：`train/src/app/analysis/*`
- 实时指导（Live）
  - 摄像头实时关键点追踪、深蹲计数与纠错、导出本地 JSON
  - 相关页面：`train/src/app/live/LiveClient.tsx`
- Settings/Privacy
  - 相机镜像/缩放/预览宽度、视频保留策略（是否保留原视频/TTL）、导出/清空
  - 相关页面：`train/src/app/settings/page.tsx`、`train/src/app/privacy/page.tsx`

## 已实现功能（后端接口）

`train/` 的接口全部以 Next Route Handlers 方式实现，主要集中在：

- 公共：`/api/health`、`/api/v1/health`、`/api/v1/health/db`
- 鉴权：`/api/v1/auth/*`
- 私有（登录后）：`/api/v1/private/*`

### 鉴权与 Session

- Cookie 名：`session_token`（见 `train/src/lib/auth.ts`）
- Session 存储：`Session` 表，token hash 以 `sha256` 存储

接口：

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/session`

私有接口鉴权：`train/middleware.ts` 对 `/api/v1/private/**` 未登录直接 `401`。

### 训练（Training Sessions）

- `GET /api/v1/private/trainings?days=...`：列表
- `POST /api/v1/private/trainings`：创建
- `DELETE /api/v1/private/trainings`：清空
- `GET /api/v1/private/trainings/active`：当前进行中
- `GET|PUT|DELETE /api/v1/private/trainings/:id`：读取/更新/删除
- `POST /api/v1/private/trainings/:id/complete`：完成训练并生成 report

### 视频（Videos）

- `GET /api/v1/private/videos?limit=...`：列表
- `POST /api/v1/private/videos`：上传（落盘）
- `GET /api/v1/private/videos/:id/file`：Range 流式读

关键实现：

- 上传根目录：`UPLOADS_DIR` 或默认 `process.cwd()/uploads`（`train/src/lib/uploads.ts`）
- 文件元数据：`VideoAsset` 表的 `storagePath` 指向本地文件

### 分析任务（Analysis Jobs）

- `GET /api/v1/private/analysis/jobs?days&limit`：列表
- `POST /api/v1/private/analysis/jobs`：创建（`file` 与 `videoAssetId` 二选一）
- `DELETE /api/v1/private/analysis/jobs`：清空
- `GET|DELETE /api/v1/private/analysis/jobs/:id`：任务详情/删除
- `POST /api/v1/private/analysis/jobs/:id/retry`：重试
- `POST /api/v1/private/analysis/jobs/:id/complete`：前端回写 report 并置 `succeeded`

两种执行模型：

- 前端分析（默认）：创建任务时 `status=running`，前端从 `/videos/:id/file` 读取视频、逐帧提关键点并生成报告，然后 POST `/complete` 回写（见 `train/src/app/analysis/[id]/AnalysisJobClient.tsx`）。
- 后端内置 worker（`CLIENT_POSE_ENABLED=0`）：创建任务时 `status=queued`，由 `train/src/lib/analysisWorker.ts` 在同进程内异步跑完并写入结果。

### 设置/隐私

- `GET|PUT /api/v1/private/camera/settings`
- `GET|PUT /api/v1/private/privacy/settings`
- `GET /api/v1/private/privacy/export?format=json|csv`

## 数据库模型（Prisma Schema）

`train/prisma/schema.prisma` 定义的主要实体：

- `User`：用户
- `Session`：会话（tokenHash + expiresAt + revokedAt）
- `UserSettings`：相机与隐私设置（是否保存原视频、TTL、镜像/缩放/宽度）
- `ExerciseCategory`：动作分类（树结构，支持用户自建）
- `Exercise`：动作（当前业务上强限制只允许 Squat/深蹲）
- `TrainingSession` / `TrainingSet`：训练记录（`TrainingSession.report` 为 `Json?`）
- `VideoAsset`：本地视频元数据（`storagePath`、保留策略）
- `AnalysisTask` / `AnalysisResult`：分析任务与报告（`AnalysisResult.report` 为 `Json`）

落库特点：report/分析结果以 JSON 字段存储，迁移时要重点确定主项目的 JSON 存储策略（Postgres JSONB / 单独表结构化 / 混合）。

## 核心“动作检测与分析”模块在哪里

如果只迁移“动作检测与分析模块”的核心能力，建议优先关注：

- 离线视频关键点提取：`train/src/lib/pose/mediapipePose.ts`（`extractPose33FromVideoUrl`）
- 实时关键点追踪：`train/src/lib/pose/movenetTracker.ts`、`train/src/lib/pose/livePoseProvider.ts`
- 深蹲实时分析（计数/纠错）：`train/src/lib/pose/realtimeSquat.ts`
- 通用动作质量分析与报告：
  - `train/src/lib/pose/genericMotion.ts`
  - `train/src/lib/pose/report.ts`
  - `train/src/lib/pose/analysisSelector.ts`
  - `train/src/lib/pose/motionStandardCompareReport.ts`、`train/src/lib/pose/motionStandards.ts`
- 统一报告归档/PDF 渲染：`train/src/lib/report/unified.ts`

这些文件大多是“纯 TS 计算 + 结构化 report”，相对更容易在主项目前端/后端中复用。

## 迁移/集成到主项目：需要涉及的模块清单

主项目是 Flask 后端 + Vite React 前端，并使用现有 Postgres/JWT（以仓库根部为准）。因此从 `train/` 拆入主项目时会遇到栈差异：

### 1) 鉴权统一（Cookie Session → JWT 或主项目现有方案）

涉及：

- `train/src/lib/auth.ts`
- `train/middleware.ts`
- `train/src/lib/client/privateFetch.ts`（前端私有请求封装）
- `train/src/app/api/v1/auth/**`

迁移要点：

- 主项目若以 JWT 为主，需要把 `/api/v1/private/**` 的“cookie session”校验替换为“Authorization: Bearer”校验。
- 若仍想用 cookie，需统一 cookie 域、SameSite、跨域策略，并与主项目前端路由体系匹配。

### 2) 数据库模型迁移（SQLite/Prisma → 主项目 Postgres/SQLAlchemy）

涉及：

- `train/prisma/schema.prisma`
- `train/prisma/migrations/**`
- `train/src/lib/db.ts`（PrismaClient）

迁移要点：

- 把表结构映射为主项目 SQLAlchemy 模型与 Alembic/自有迁移体系。
- report JSON 字段建议用 Postgres `jsonb` 承载（性能与查询能力较好）。

### 3) 视频上传与播放（本地落盘 + Range）

涉及：

- `train/src/lib/uploads.ts`
- `train/src/app/api/v1/private/videos/**`
- `train/src/lib/videoRetention.ts`

迁移要点：

- 主项目后端需要实现：上传接口、视频文件存储（本地/S3/对象存储）、以及 Range 读取（用于前端逐帧分析时稳定拉取）。
- 保留策略（`keepOriginal`/`expiresAt`）建议作为主项目统一的“媒体资产生命周期策略”。

### 4) 分析任务执行模型（前端算 vs 后端 worker）

涉及：

- `train/src/app/api/v1/private/analysis/**`
- `train/src/lib/analysisWorker.ts`
- `train/src/app/analysis/[id]/AnalysisJobClient.tsx`

迁移要点：

- `train` 的后端内置队列依赖 `globalThis`，在多进程/多实例/Serverless 下不可靠。
- 更稳妥的两条路：
  - 路线 A：继续使用“前端分析 + 回写报告”，后端只负责任务状态与落库（实现成本低、对算力要求低，但前端性能/兼容需评估）。
  - 路线 B：主项目后端引入独立 worker/队列（例如 Celery/RQ/自建任务系统），把分析完全放后端（对资源、部署与异步架构要求更高）。

### 5) 动作/分类体系（当前强限制 Squat）

涉及：

- `train/src/app/api/v1/private/exercises/route.ts`（强限制）
- `train/src/lib/builtinExercises.ts`、`train/src/lib/exerciseCatalog.ts`

迁移要点：

- 如果主项目要支持多动作，需要解除“仅深蹲”的限制，并明确动作标准模板如何扩展/版本化。

## 推荐的集成路径（供后续决策）

### 方案 1：先“服务化”接入（改动最小）

把 `train/` 作为独立服务运行（仍用 Next.js + Prisma），主项目前端通过网关/反代访问它的 API 或页面。

优点：快速验证能力、迁移成本低。
缺点：鉴权、用户体系、数据库会变成“双系统”，后续仍需合并。

### 方案 2：把能力拆入主项目（最终形态）

只迁移核心库与接口语义：

- 前端复用：`train/src/lib/pose/**`（TS 算法部分）、报告渲染部分
- 后端重写：上传/视频/任务/报告存储等接口（Flask + 主库）

优点：统一用户/鉴权/数据库；后续功能一致性最好。
缺点：需要系统性重构与适配。

## 附：关键文件索引

- 依赖/脚本：`train/package.json`
- 环境变量示例：`train/.env.example`
- Prisma Schema：`train/prisma/schema.prisma`
- 私有 API 保护：`train/middleware.ts`
- Session 鉴权：`train/src/lib/auth.ts`
- 上传与落盘：`train/src/lib/uploads.ts`
- 视频保留清理：`train/src/lib/videoRetention.ts`
- 后端内置队列：`train/src/lib/analysisWorker.ts`
- 前端离线分析回写：`train/src/app/analysis/[id]/AnalysisJobClient.tsx`
- 实时深蹲指导：`train/src/app/live/LiveClient.tsx`、`train/src/lib/pose/realtimeSquat.ts`

