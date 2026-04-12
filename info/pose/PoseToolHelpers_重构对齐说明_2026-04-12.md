# PoseToolHelpers 重构对齐说明（前端）

日期：2026-04-12

## 1. 目的

将 `frontend/src/pages/poseTool/poseToolHelpers.ts` 从“单文件集中实现 + 多处复制”重构为“按职责拆分的模块结构”，降低耦合、提升可维护性，同时保持对外接口兼容，避免影响 `PoseToolPage` 等调用方。

## 2. 兼容性原则

- 入口文件仍为：`frontend/src/pages/poseTool/poseToolHelpers.ts`
- 该入口文件现在只做 `re-export`，对外导出名称保持不变（调用方无需改 import 路径即可工作）。
- 任何新增能力优先通过内部模块扩展，不要求页面新增字段，不修改既有 `RealtimeFeedback` 契约。

## 3. 新的文件结构

所有实现已迁移到：

`frontend/src/pages/poseTool/helpers/`

- `types.ts`
  - `ExerciseSlug`
  - `RealtimeAnalyzer`
  - timeline/finding 类型（`SquatTimelineRow`/`BenchPressTimelineRow`/`SquatRepFinding`）
  - `VIDEO_DEFAULT_SQUAT17_TUNING`
- `reportBase.ts`
  - `getRepsFromReport`
  - `formatDuration`
  - `toIssueCode`
  - `sampleTimelineRows`
  - `computeReportErrorStats`
- `suggestionMap.ts`
  - `mapSuggestionFromIssue`（内部被 live/report 使用）
- `live.ts`
  - `evaluateRangeCheck`
  - `getSessionComment`
  - `getTopIssues`
  - `getTopRepIssuesFromFindings`
  - `getTopIssuesFromMessageFreq`
  - `collectLiveIssueMessages`
  - `collectLiveFrameIssueMessages`
  - `buildLiveSuggestions`
- `analyzers.ts`
  - `createAnalyzer`
- `squatReport.ts`
  - `buildSquatAlignedReport`
  - `buildSquatVideoLiveStyleReport`
  - `VIDEO_DEFAULT_SQUAT17_TEMPO`（透传导出）
- `pushupReport.ts`
  - `buildPushupAlignedReport`
  - `buildPushupVideoLiveStyleReport`
- `benchPressReport.ts`
  - `buildBenchPressAlignedReport`
  - `buildBenchPressVideoLiveStyleReport`
- `lateralRaiseReport.ts`
  - `buildLateralRaiseAlignedReport`
  - `buildLateralRaiseVideoLiveStyleReport`
- `pullupReport.ts`
  - `buildPullupAlignedReport`
  - `buildPullupVideoLiveStyleReport`

## 4. 调用方对齐（推荐做法）

### 4.1 现有模块（无需改动）

如果你已经在使用：

`import { ... } from './poseTool/poseToolHelpers'`

可以不改，接口保持兼容。

### 4.2 新增模块（建议做法）

如果你要在新页面/新模块中复用能力，建议按职责直接从细分模块引用：

- Report 相关：`frontend/src/pages/poseTool/helpers/*Report.ts`
- Live 统计与建议：`frontend/src/pages/poseTool/helpers/live.ts`
- 通用工具：`frontend/src/pages/poseTool/helpers/reportBase.ts`

这样更易于按功能定位问题，并避免把整个工具集合一次性引入。

## 5. 迁移后需关注的点

- 入口文件变为 `re-export`，若出现导出缺失/循环依赖，应优先在 `helpers/` 内修复实现层，再由入口文件继续透传。
- `PoseToolPage.tsx` 中若存在未使用但已 import 的导出，不影响类型检查通过，但建议后续清理以减少噪音。

## 6. 验证方式

- 前端类型检查：`npm run typecheck`
- 运行时回归建议：
  - 进入 `/tools/pose/squat/tool`、`/tools/pose/pushup/tool` 等，确认实时与离线入口可正常生成报告（尤其是 squat 离线的 nativeFrames 重放链路）。

