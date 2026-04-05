# Train 迁移计划（方案 1：服务化接入，改动最小）

本文档基于 `TRAIN_核心功能盘点与迁移影响分析.md` 中“方案 1：先服务化接入”的思路，给出一份可落地的迁移/集成计划：做什么、最终运行逻辑、潜在问题、以及后续如何合并到主项目。

## 目标与边界

- 目标：在不大改主项目技术栈的前提下，把 `train/` 的核心能力（视频上传/播放、离线分析任务、实时指导、报告导出）尽快在主项目前端可用。
- 边界：此阶段不追求“完全合并数据库与用户体系”，但要为后续合并提前铺路（统一身份、统一数据模型、可迁移的数据存储策略）。

## 最终运行逻辑（上线后系统如何工作）

### 组件划分

- 主项目后端：`backend/`（Flask）
  - 继续作为主入口 API（JWT 鉴权、业务聚合）
  - 增加“Train 网关/反代”能力（统一域名、屏蔽跨域复杂度）
- Train 服务：`train/`（Next.js + Prisma）
  - 以独立服务运行
  - 暴露既有 API（`/api/v1/...`）与可选页面
  - 存储训练/视频/分析任务数据（初期独立 schema；可选直接连同一个 Postgres 实例）
- 主项目前端：`frontend/`（Vite React）
  - 通过主项目后端的网关路径调用 Train API（不直接跨域调用 train）
  - 将 Train 功能以“嵌入式页面/路由”或“主前端原生页面”方式接入（阶段 1 先用嵌入方式更快）

### 典型请求链路（推荐：统一域名反代）

1) 用户登录主项目：主项目颁发 JWT（现有逻辑）。
2) 前端访问 Train 相关功能：
   - 前端调用主后端：`/api/train/...`（示例）
   - 主后端校验 JWT → 通过后，将请求反代到 Train：`http://train-service:3000/api/v1/...`
   - 主后端在转发时注入用户身份（推荐使用“受信 header 模式”，见下文）。
3) Train 收到请求：
   - 不再依赖自身的 cookie session（可保留但不作为主链路）
   - 读取网关注入的身份 header → 映射/创建 Train 侧 user 记录 → 继续执行原有业务逻辑与落库。

### 身份对接（关键：如何避免双登录）

为了做到“主项目登录一次即可访问 train”，建议把 train 的鉴权改为两种模式并存：

- Mode A（生产推荐）：受信网关身份（Trusted Gateway Headers）
  - 只有来自主后端反代的请求才会携带身份 header
  - Train 不做 JWT 校验（减少重复依赖），只校验“请求是否来自受信来源”
  - 典型 header：
    - `X-AIFIT-User-Sub`：主系统用户唯一标识（稳定、不可变）
    - `X-AIFIT-User-Email`（可选）
    - `X-AIFIT-Auth-Signature`（可选，加强安全，HMAC 签名）
- Mode B（开发/兼容）：train 原生 cookie session
  - 保留 `train` 自己的 `/api/v1/auth/*` 与 `middleware.ts`（方便独立开发与回归测试）
  - 主项目集成时默认走 Mode A

## 迁移实施计划（阶段化）

### Phase 0：基线准备（0.5–1 天）

做什么：

- 确认 train 运行与回归基线：`npm run db:migrate && npm run test:e2e` 可跑通。
- 明确 train 在主项目中暴露的最小能力集（推荐按 API 模块）：
  - videos：上传/播放
  - analysis/jobs：创建任务、轮询状态、complete 回写
  - trainings：训练记录（可后置）
  - privacy/export：导出/清空

最终效果：

- 有一套“可验证”的功能清单与测试路径，后续改动不至于把核心链路改坏。

### Phase 1：服务化运行 + 统一域名接入（1–2 天）

做什么：

- 以独立服务启动 train（开发环境先用本地端口，生产用容器/进程管理）。
- 在主后端新增反代路由：
  - 示例：`/api/train/*` → 转发到 `train-service` 的 `/*` 或 `/api/v1/*`
  - 处理：
    - 转发请求体（尤其是 `multipart/form-data` 上传）
    - 透传 Range header（视频播放/逐帧读取需要）
    - 限制最大上传体积与超时（train 默认最大 80MB）
    - 统一错误码与日志（便于排查）

最终效果：

- 主项目前端不需要跨域；所有 train 能力通过主域名可达。

### Phase 2：身份打通（避免双登录）（1–3 天）

做什么：

- 在主后端反代时注入身份 header（受信网关模式）。
- 在 train 端增加“从 header 解析用户”的鉴权路径：
  - 若存在受信 header：视为已登录用户
  - 将 header 中的 `User-Sub` 映射到 train 的 `User` 表（可新增字段 `externalUserId` 或复用 `email` 作为唯一键）
  - 对 `/api/v1/private/**`：改为先尝试 header 鉴权，失败再走 cookie session（兼容）
- 对 train 的页面（可选）：
  - 先不把 train 页面直接暴露给终端用户，优先走“主前端路由 + 调用 train API”
  - 如果要嵌入 train 页面：用反代路径挂载（例如 `/train/*`），并确保页面请求同样经过网关注入 header。

最终效果：

- 用户只在主项目登录一次；train 的私有 API 可直接使用。

### Phase 3：数据与存储策略对齐（2–5 天，按规模）

此阶段目标是把“后续合并成本”降到最低。

做什么（推荐优先级从高到低）：

1) 数据库：从 SQLite 切到 Postgres（推荐）
   - 保持 Prisma，但将 datasource provider 改为 `postgresql`
   - 连接主项目现有 Postgres 实例（建议使用独立 schema，例如 `train`）
   - 好处：
     - 仍是“逻辑双系统”，但物理 DB 统一，迁移与备份策略可复用
     - report JSON 字段可自然迁移为 `jsonb`
2) 视频存储：从本地磁盘抽象为可插拔
   - 先保留本地落盘，但路径与清理策略由环境变量统一管理
   - 后续可平滑迁移到对象存储（S3/MinIO），避免多实例下磁盘不共享
3) 任务执行：明确只走“前端分析回写”或引入独立 worker
   - 短期：默认前端分析回写（稳定且易扩容）
   - 中期：需要后端分析时，使用主项目的异步队列体系（Celery/RQ/自研）替换 `analysisWorker.ts` 的 in-process 队列

最终效果：

- train 仍可独立运行，但其 DB/存储/任务模型更接近主项目，为后续“彻底合并”做准备。

### Phase 4：主前端原生化 UI（可选，按产品节奏）

做什么：

- 将 train 的 UI 逐步迁移为主项目前端的页面（Vite React），只保留 train 服务端的 API 或算法库。
- 把关键 TS 算法库（`train/src/lib/pose/**`、`train/src/lib/report/**`）提炼为可复用包（monorepo workspace 或内部 npm 包）。

最终效果：

- 用户体验统一，前端技术栈一致；train 服务可逐步收缩为“分析引擎/API”。

## 潜在问题与规避策略

### 1) 安全边界：受信 header 被伪造

风险：如果终端用户能直接访问 train 服务并注入 header，则可冒充用户。

规避：

- 生产环境禁止公网直接访问 train，只允许网关/内网访问。
- train 校验来源：
  - 限制 `X-Forwarded-For`/`Host`/内部网络来源
  - 或使用 `X-AIFIT-Auth-Signature`（主后端用共享密钥 HMAC 签名，train 校验）。

### 2) 上传与 Range 转发不完整导致视频播放/分析失败

风险：反代若不支持 Range、或 body 转发有问题，会导致：

- 视频播放 seek 失败
- 前端逐帧读取卡顿或失败

规避：

- 反代必须：
  - 透传 `Range`、`If-Range`、`Content-Range`、`Accept-Ranges`
  - 支持大 body（multipart）与较长超时
  - 避免对视频响应做 gzip

### 3) 多实例/容器环境下的 in-process worker 与定时清理不可靠

风险：`analysisWorker.ts` 与视频清理（`setInterval`）在多进程下会：

- 重复消费任务
- 清理不一致

规避：

- 短期强制走“前端分析回写”模式（`CLIENT_POSE_ENABLED` 默认开启）。
- 中期改为独立队列/worker，或把清理任务迁移到单例 cron/job。

### 4) 数据“双系统”导致对账与用户投诉

风险：主项目与 train 数据分离，用户可能无法理解“我的训练数据在哪”。

规避：

- 从 Phase 3 开始尽早把 DB 切到同一个 Postgres 实例（至少物理统一）。
- 定义统一的“主键映射”：主用户 `sub` 作为 train 的 `externalUserId`。
- 明确数据归属与导出策略（train 的 privacy/export 先作为兜底）。

## 后续怎么合并（从服务化走向单系统）

将“服务化接入”视为过渡态，合并建议按以下顺序推进：

1) 身份合并（优先级最高）
   - 保证所有 train 数据都以主用户 `sub` 可追溯
2) 数据模型对齐
   - 将 train 的核心实体（VideoAsset、AnalysisTask、AnalysisResult、TrainingSession/Set）映射为主项目的 SQLAlchemy 模型
   - report 字段优先沿用 JSONB，避免早期过度结构化
3) 存储与任务系统合并
   - 视频存储走主项目统一的媒体服务/对象存储
   - 分析任务进入主项目队列/worker
4) 服务收敛
   - 当主后端具备全部接口能力后：
     - 逐步让主后端直接提供 `/api/...`，train 的 API 只保留算法/渲染或完全下线
     - train 前端页面可以被主前端完全替代

## 验收标准（建议）

- 主项目登录后无需再登录即可：
  - 上传视频
  - 创建分析任务
  - 轮询状态并完成（前端分析回写或 worker 完成）
  - 查看报告/导出
- 全链路在同一域名下可用（无跨域报错）
- 生产环境下 train 不可被公网直接访问（只经由主网关）

