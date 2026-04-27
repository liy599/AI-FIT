# AI-FIT 项目全局理解（用于重构/新对话快速上手）

本文用于在开启新对话时快速恢复上下文：项目做什么、前后端职责边界、关键数据流与扩展点。内容以“能定位、能复现、能继续推进重构”为目标，不追求实现细节。

---

## 1. 项目目标与核心模块

AI-FIT 是一个健身/饮食结合的 Web 应用，核心能力主要分为：

- 账号与用户资料：登录注册、Profile（性别/身高/体重/目标等）
- Food 模块：食物库、识别/匹配、餐次记录、当天摄入汇总
- Pose 模块：浏览器端姿态识别、动作计次与纠错、训练记录与报告
- 内容/运营：博客、评论、反馈等（从 routes 可见）

---

## 2. 技术栈与工程形态

### 2.1 Frontend

- 位置：`frontend/`
- 形态：React + TypeScript + Vite（存在 vite.config.ts、tsconfig、main.tsx/App.tsx）
- 静态资源：`frontend/public/assets/`（包含 UI 静态资源与 MoveNet 模型文件）
- Pose 推理：浏览器端执行（TFJS MoveNet；MediaPipe tasks-vision 代码存在但不是默认主链路）

### 2.2 Backend

- 位置：`backend/`
- 形态：Python Web API（存在 routes、services、models、tests，常见于 Flask/FastAPI 风格；具体框架以 backend/app/__init__.py 与 run.py 为准）
- 主要职责：
  - 用户/鉴权/权限/隐私策略
  - Food/Meals 数据读写与当天汇总
  - Pose 训练记录的存储、报告结构校验、（可选）AI 增强报告

---

## 3. 目录与关键入口（理解用）

### 3.1 Backend 关键区域

- 路由聚合：`backend/app/routes/`
  - Food/Meals：`food.py`、`foods.py`、`meals.py`
  - Pose：`pose.py`
  - Auth/User：`auth.py`、`user.py`
- 业务服务：`backend/app/services/`
  - Food 种子数据与运行时补齐：`services/food/catalog_runtime.py`、`seed_foods.json`
  - Pose AI 报告结构校验：`services/pose/ai_report.py`
- 测试：`backend/tests/`（有 pose/ai_report 等测试，便于回归）

### 3.2 Frontend 关键区域

- 页面：`frontend/src/pages/`
  - Pose 相关：`PoseSelectPage.tsx`、`PoseToolPage.tsx`、`PoseTrainingHistoryPage.tsx`、`PoseTrainingReportPage.tsx`
- Pose 业务库：`frontend/src/lib/pose/`
  - 实时 provider：`livePoseProvider.ts`
  - MoveNet 推理/离线抽帧：`movenetPose.ts`
  - 追踪稳定化：`movenetTracker.ts`、`distanceTracker.ts`
  - 绘制：`draw.ts`
  - 通用指标：`poseFrame.ts`、`poseMetrics.ts`、`poseMetricTracker.ts`、`genericMotion.ts`
  - 动作 analyzers：`realtime*.ts`
- Pose 页面 helper/报告：`frontend/src/pages/poseTool/poseToolHelpers.ts` 与 `frontend/src/pages/poseTool/helpers/*`

---

## 4. Pose：现有全流程（高层抽象）

### 4.1 实时（Live）链路

1) 摄像头采集（前端页面）
- Pose 工具页请求摄像头流，进入 RAF 循环并按目标 FPS 节流。

2) 姿态推理（模型层）
- 当前实时推理默认使用 MoveNet（TFJS pose-detection）。
- 输出包含：
  - 原生 MoveNet 17 点（x/y/score/name）
  - 为兼容历史接口而生成的“类 MediaPipe 33 点数组”（只映射部分点，其它为缺失/合成）

3) 稳定化与质量门控（工程层）
- 使用稳定器/跟踪状态（calibrating/tracking/lost）与距离提示（too close/too far），降低误报与提示抖动。

4) 动作分析（规则/状态机）
- 每个动作对应一个 Realtime Analyzer（规则 + 状态机），输出：
  - repCount、correct/incorrect、warnings/issues、lastRepReasonCodes/Corrections 等
- 页面使用 analyzer 输出生成实时提示、计次 UI、问题统计与 session 总结。

5) 报告与存档
- 结束时汇总报告结构并提交给后端保存（后端不参与逐帧姿态推理）。

### 4.2 离线（Video）链路

1) 视频输入
- 用户上传/选择视频（前端本地处理为主）。

2) 抽帧 + 姿态推理
- 当前默认离线也走 MoveNet：按策略抽帧并估计姿态。
- 抽帧产物通常同时包含：
  - frames：用于历史逻辑的 landmarks（当前多为“伪 33 点数组”）
  - nativeFrames：MoveNet 17 点序列（可用于后续 17-only 迁移）

3) 回放式分析（复用实时 analyzer）
- 对抽帧序列逐帧回放，喂给同一套 Realtime Analyzer，得到和实时一致的计次/纠错输出。
- 同时生成离线 overlay（每帧 tone/message）与视频报告。

---

## 5. Pose：扩展点（加动作/改规则的地方）

### 5.1 新增动作的一般路径

1) 动作元数据与上架
- `frontend/src/lib/pose/exercises.ts`：动作 slug、展示名、提示文案等

2) Analyzer 实现
- `frontend/src/lib/pose/realtime<Exercise>.ts`：规则/状态机实现

3) 接入创建器与报告
- `frontend/src/pages/poseTool/poseToolHelpers.ts`：`createAnalyzer(slug)`、suggestion 映射、report builder

4) 页面展示
- `PoseSelectPage` 上架与展示（已支持过滤 ready/coming_soon）
- `PoseToolPage` 实时/离线分支（通常无需新增大量 UI 逻辑）

### 5.2 当前 Pose 重构焦点（17-only）

项目目前同时存在：
- “33 索引语义”的 analyzer/指标工具（大量 `landmarks[idx]`）
- “17 点按 name”的 analyzer（已有 analyzeNative 与 MoveNetKeypoint）

为了降低口径混乱与伪 33 的风险，计划方向是：
- analyzer 统一以 MoveNet 17 点（按 name）作为输入语义
- 离线回放只依赖 17 点序列（nativeFrames）
- 同步统一 issues.joints 的语义（避免继续使用 MediaPipe 33 索引）
- 代码命名避免出现 “动作名+数字” 后缀，旧实现迁移到 legacy/classic 命名

对应执行清单见：
- `info/refactor/POSE_17POINT_ANALYZER_MIGRATION_CHECKLIST.md`

---

## 6. Food：关键事实（高层）

- 后端食物库存在“种子数据 + 运行时补齐”机制：
  - 种子 JSON：`backend/app/services/food/seed_foods.json`
  - 启动时补齐：由 catalog_runtime 读取 JSON 并向 foods 表补缺
- 当天汇总接口当前主要返回“摄入 totals”，不包含营养目标/进度条目标数据（如需目标，需要扩展 profile/接口口径）。

---

## 7. 新对话快速启动建议（怎么提问最省时间）

- 若要推进“17-only analyzer 重构”：
  - 先让助手读取 `info/refactor/POSE_17POINT_ANALYZER_MIGRATION_CHECKLIST.md`
  - 再按“动作优先级”逐个迁移，并在每一步做离线回放视频的回归对比
- 若要新增动作：
  - 说明动作 slug、期望视角（侧视/正视）、计次规则（关键角度/阈值）、纠错点列表（要输出哪些提示）

