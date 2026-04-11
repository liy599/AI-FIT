# 实时矫正·深蹲（Squat）落地契约：Contracts / KPI / 门控状态码与 UI 映射

日期：2026-04-11

本文目标：把“深蹲实时矫正”从“能跑”落到“可对齐、可验收、可回归”的工程契约（Contract）与产品度量（KPI），并给出门控状态码与 UI 文案映射的统一口径。

---

## 1. 现状模块责任盘点（Single Source of Truth）

### 1.1 前端实时链路（Live Coaching）

- 训练入口/逐帧循环编排：在 [PoseToolPage.tsx](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/pages/PoseToolPage.tsx)
  - 负责：相机启动/停止、逐帧调度、FPS 统计、错误兜底、把每帧 `feedback/tracking/distance` 写入 React state
  - 负责：live session 的 frame 级聚合（messageFreq、trackingQualitySamples、timelineRows）
  - 负责：训练结束的 summary、保存训练记录（调用 `POST /api/pose/trainings`）
  - 现状：UI 文案主要基于 `feedback.issues/warnings/lastRepMessage` + distance 状态字符串拼接

- Analyzer 选择、建议映射、报告拼装：在 [poseToolHelpers.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/pages/poseTool/poseToolHelpers.ts)
  - 负责：`createAnalyzer(exerciseSlug)` 注册动作 Analyzer
  - 负责：`buildSquatAlignedReport()` 生成深蹲“对齐版报告”（用于存档/训练记录/报告页展示）
  - 负责：`evaluateRangeCheck()`（现为“动作范围/姿态范围”的轻量判断）和 `mapSuggestionFromIssue()`（issue→建议）

- 深蹲动作判定（帧级 + rep 聚合）：在 [realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/realtimeSquat.ts)
  - 负责：每帧输出 `RealtimeFeedback`（关节角、warnings/issues、计次状态）
  - 负责：状态机计次与 rep 级别判定（correct/incorrect/unassessed）
  - 现状：门控原因通过 `QualityGateStatus.code` 统一（[gate.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/analyzer/gate.ts) 的 `evaluateQualityGate()`）；`isCountingPaused` 继续作为分析暂停的总开关；侧视角提示同时映射为 `WRONG_ANGLE`

- 姿态检测提供方：在 [livePoseProvider.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/livePoseProvider.ts)
  - 负责：加载并调用 MoveNet（浏览器端）输出 `landmarks33`
  - 现状：只有 “landmarks 是否为 null” 的粗粒度信号；无“低光/遮挡/多人”等原因码

- 跟踪稳定化与骨架绘制（UI 视觉层）：在 [movenetTracker.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/movenetTracker.ts) 与 [draw.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/draw.ts)
  - 负责：把关键点做稳定化（calibrating/tracking/lost）并提供可绘制的 joints

- 距离/站位引导：在 [distanceTracker.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/distanceTracker.ts)
  - 负责：距离校准、too_close/too_far 的标签与引导框
  - 现状：门控只体现在 UI 文案与引导框；尚未统一沉淀到“状态码→报告/统计”

### 1.2 前端报告展示（Training Report）

- 报告页：在 [PoseTrainingReportPage.tsx](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/pages/PoseTrainingReportPage.tsx)
  - 负责：读取训练记录、展示 report 的 Summary/Metrics/Issues/Suggestions

- 报告可视化组件：在 [PoseToolWidgets.tsx](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/pages/poseTool/PoseToolWidgets.tsx)
  - 负责：以宽松容错方式渲染 `keyMetrics/issues/suggestions/timeline`

- 报告类型定义（通用）：在 [report.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/report.ts)
  - 现状：`PoseAnalysisReport` 提供了统一字段，但并未强制执行“动作专用 contract”

### 1.3 后端落库与数据接口

- 训练记录接口：在 [pose.py](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/backend/app/routes/pose.py)
  - 负责：`POST /api/pose/trainings` 保存 training session + sets + `report_json`
  - 现状：`report_json` 通过 `prepare_training_report_for_storage()` 做 schema/大小校验与超限压缩；不合规/超限有明确失败策略（[report_archive.py](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/backend/app/services/pose/report_archive.py)）

---

## 2. Contracts：实时反馈（RealtimeFeedback）契约（帧级）

源类型定义：`RealtimeFeedback`（[realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/realtimeSquat.ts)）。

### 2.1 字段分层（必须 vs 可选）

**必须字段（必须真实产出，禁止用默认值冒充真实统计）**

- `phase`: `'up' | 'descent' | 'bottom' | 'ascent'`
- `state`: `'s1' | 's2' | 's3' | null`（动作内部状态机）
- `trackingQuality`: `number`（0..1，越大越可靠）
- `isCountingPaused`: `boolean`（当前是否暂停计次/评分/纠错输出的“总开关”）
- `warnings`: `string[]`（轻提示，可多条）
- `issues`: `{ message: string; joints: number[] }[]`（需要纠正的问题；joints 是关键点索引）
- `repCount/correctCount/incorrectCount`: `number`（会话累计）
- `lastRepResult`: `'correct' | 'incorrect' | null`
- `lastRepMessage`: `string | null`
- `lastRepReasonCodes/lastRepReasonLabels/lastRepCorrections`: `string[]`
- `session`: `{ totalReps, correctReps, incorrectReps, accuracyPct, ... }`

**允许为空（必须用 null 表示“不可可靠计算/不可判断”）**

- `kneeAngle/hipAngle/torsoAngle/kneeVerticalAngle/offsetAngle`: `number | null`
- `lastRepFrameCount`: `number | null`
- `session.avgRepDurationSec`: `number | null`

### 2.2 默认值策略（防止“假数据”）

- “数值型但不可判断”的字段一律用 `null`，禁止填 `0`。
- `warnings/issues` 为空数组表示“此帧没有提示/问题”，不代表“动作完美”。
- `accuracyPct` 仅当 `correct+incorrect > 0` 才有意义；现状实现为 0–100 的整数（[realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/realtimeSquat.ts)）。

---

## 3. Contracts：训练报告最小 Schema（用于落库/展示）

通用类型：`PoseAnalysisReport`（[report.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/report.ts)）。

深蹲对齐报告生成：`buildSquatAlignedReport()`（[poseToolHelpers.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/pages/poseTool/poseToolHelpers.ts)）。

### 3.1 最小必需字段（UI 与落库共同依赖）

- `version: number`
- `generatedAt: string`（ISO 时间）
- `status: 'ok' | 'error'`
- `task: { id: string; viewAngle: string; instruction: string | null }`
- `exercise: { id: string; name: string } | null`
- `video: { id: string; originalName: string; mimeType: string; sizeBytes: number } | null`
- `summary: string`
- `keyMetrics: Record<string, number | string | null>`
- `issues: Array<{ code: string; severity: 'info' | 'warning' | 'error'; message: string; atFrame: number | null }>`
- `suggestions: string[]`
- `details: unknown`（动作专用扩展区；contract 约束在“结构化且可回放”）
- `sections`（至少包含 overview/metrics/errorStats/suggestions/timelineSampled）

### 3.2 深蹲推荐 keyMetrics（对齐 KPI 口径）

以 `buildSquatAlignedReport()` 为准，建议稳定维护下列键：

- `totalReps/correctReps/incorrectReps/unassessedReps`
- `formAccuracyPct`
- `avgRepDurationSec/fastRepCount/slowRepCount`
- `avgTrackingQuality/effectiveFps`

---

## 4. 门控状态码（Gate Codes）定义

目的：把“无法可靠判断/需要用户修复的环境问题”从 `warnings` 文本里抽离出来，形成可统计、可回归、可 UI 映射的状态码。

### 4.1 状态码枚举（建议）

- `OK`：可正常计次与纠错输出
- `OUT_OF_FRAME`：未检测到足够关键点（或 landmarks 为空）
- `LOW_CONFIDENCE`：检测到 landmarks，但关键关节可见度不足/关键角度不可计算
- `WRONG_ANGLE`：机位角度不符合侧视要求（深蹲矫正依赖侧视）
- `DISTANCE_CALIBRATING`：距离尚在校准期（引导用户站稳）
- `TOO_CLOSE`：距离过近
- `TOO_FAR`：距离过远
- `TRACKING_CALIBRATING`：稳定化尚在校准期
- `TRACKING_LOST`：稳定化丢失（可能遮挡/出画）
- `LOW_LIGHT`：光照不足导致稳定性下降（现状无法可靠区分，可先作为 `LOW_CONFIDENCE` 的细分原因预留）
- `DEVICE_ERROR`：相机/模型初始化失败或运行异常

### 4.2 现状可用信号 → Gate Code 的推导口径（落地算法）

以下推导以现有前端信号为基础（不改代码也可按此口径统计/对齐）：

1. `DEVICE_ERROR`：前端捕获到 live detection 初始化/每帧异常（[PoseToolPage.tsx](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/pages/PoseToolPage.tsx) 的 error state）
2. `OUT_OF_FRAME`：`provider.detect()` 返回 `landmarks === null`（[livePoseProvider.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/livePoseProvider.ts)）
3. `TRACKING_CALIBRATING/TRACKING_LOST`：`MoveNetStabilizer.ingest().status`（[movenetTracker.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/movenetTracker.ts)）
4. `DISTANCE_CALIBRATING/TOO_CLOSE/TOO_FAR`：`DistanceTracker.ingest()` 的 `status/label`（[distanceTracker.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/distanceTracker.ts)）
5. `WRONG_ANGLE`：`feedback.offsetAngle > 55`（深蹲侧视提示阈值，现为 warning）（[realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/realtimeSquat.ts)）
6. `LOW_CONFIDENCE`：`feedback.trackingQuality < 0.28` 或关键角度为 null 且影响计次/纠错（现状门控条件）（[realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/realtimeSquat.ts)）
7. `OK`：以上均不满足

优先级建议：`DEVICE_ERROR > OUT_OF_FRAME > TRACKING_LOST > TRACKING_CALIBRATING > DISTANCE_* > WRONG_ANGLE > LOW_CONFIDENCE > OK`。

---

## 5. UI 映射（Gate Code → 提示文案/交互）

目标：UI 对齐“可操作”的修复建议；同一状态码在 live 页、报告页、日志统计中语义一致。

### 5.1 Live 页（实时）文案映射（建议）

| Gate Code | 用户可见主文案（建议） | 用户动作（建议） | 现状信号与 UI 位置 |
|---|---|---|---|
| OK | Tracking OK | 正常训练 | 距离条显示 “Distance OK”；建议区显示 issues/warnings |
| OUT_OF_FRAME | Body not detected | 让全身入镜，避免遮挡 | rangeStatusText: “Waiting for detection” / “Stable body not detected” |
| TRACKING_CALIBRATING | Hold still to calibrate | 站稳 2–3 秒 | tracking/distance 均存在 calibrating |
| TRACKING_LOST | Tracking lost | 回到画面中央，减少遮挡 | distance.status === 'lost' |
| DISTANCE_CALIBRATING | Calibrating distance | 站稳保持 | rangeStatusText: “Calibrating distance” |
| TOO_CLOSE | Too close | 后退一步 | rangeStatusText: “Too close” |
| TOO_FAR | Too far | 向前一步 | rangeStatusText: “Too far” |
| WRONG_ANGLE | Rotate to side view | 手机放到侧面、髋部高度 | warning: “Try to stay in a clear side view…” |
| LOW_CONFIDENCE | Low tracking quality | 增强光照、保持全身入镜 | `feedback.isCountingPaused` 的隐含原因 |
| DEVICE_ERROR | Camera/model error | 重新授权/刷新页面 | `error` state |

### 5.2 报告页（训练结束）映射（建议）

报告页建议增加“门控摘要”，但在未改代码前，至少需要统一口径：

- 若 `avgTrackingQuality` 低或 `effectiveFps` 过低：在 Summary/Issues 中给出“数据质量不足，部分 rep 未评估”的免责声明。
- 若 `sortedIssues` 里侧视角/距离相关提示占比高：在 Suggestions 优先返回机位修复建议（现已在 `mapSuggestionFromIssue()` 部分覆盖）。

---

## 6. KPI 定义（可验收、可回归）

### 6.1 计次可靠性（核心）

- **rep MAE**（Mean Absolute Error）
  - 定义：`mean(|pred_reps - gt_reps|)`，按视频/会话粒度统计
  - 目标建议：MVP ≤ 0.5（在固定 benchmark 上）

- **rep 计次稳定率**
  - 定义：同一输入重复运行（同版本）rep 输出一致的比例

### 6.2 纠错准确性（问题级）

- **precision / recall**
  - 定义：针对每个错误类型（如 forward_lean、knee_over_toe）做二分类（出现/未出现）或区间定位（发生 rep 区间）
  - 目标建议：核心 5 类问题分别设定阈值（例如 precision ≥ 0.75，recall ≥ 0.6）

### 6.3 无法判断率（门控质量）

- **unassessed rate**
  - 定义：`unassessedReps / totalReps`（或按 frame：门控帧占比）
  - 目标建议：在可控场景下 ≤ 15%；并且必须可解释（by gate code）

- **gate reason distribution**
  - 定义：按 Gate Code 统计帧占比/会话占比，用于定位“问题主要来自环境还是算法”

### 6.4 性能（体验底线）

- **effective FPS**
  - 定义：前端统计的每秒处理帧数（[PoseToolPage.tsx](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/pages/PoseToolPage.tsx)）
  - 目标建议：≥ 15 FPS（低端设备可降级，但需门控提示）

- **端到端延迟**
  - 定义：从摄像头帧到 UI 更新的平均耗时与 P95（需要额外埋点，Phase 0 先定义口径）

---

## 7. 现状差距（用于后续 Phase 0/1 落地）

- 门控：已通过 Gate Code 统一并在报告中沉淀，后续可把更多环境原因细分（例如 LOW_LIGHT）与做更细粒度统计。
- 报告：后端已做 schema/大小校验，仍需持续保证前端版本迁移与历史兼容。
- UI：已形成“状态码→文案→用户动作”的单表映射，后续可加入端到端延迟的埋点与 P95 指标。
