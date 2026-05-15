## 目标

在 Pose 的 Analysis Report（含 Training Report 详情页）中，让 Rep Findings 每条记录展示“视频该时刻的截图 + 姿势线叠加”的缩略图；并将缩略图随训练记录保存到后端（塞进 report JSON），以便 Training History 的报告页也能看到。

## 实现概览

### 1) 离线分析阶段生成缩略图并写回 report.details.repFindings

- 新增：在离线视频分析完成后、归档训练记录前，基于离线视频文件 + 已提取的 MoveNet 关键点，逐条 repFinding 生成 JPEG dataURL，并写入 `report.details.repFindings[].snapshotDataUrl`。
- 生成逻辑入口：offline 分析流程 [analysis.ts](file:///f:/学校/大四下/毕设/AI-FIT/frontend/src/modules/pose/runtime/offline/analysis.ts)
- 具体实现：`attachRepFindingSnapshots` [reportSnapshots.ts](file:///f:/学校/大四下/毕设/AI-FIT/frontend/src/modules/pose/runtime/offline/reportSnapshots.ts)

数据格式（新增字段，向后兼容）：

- `report.details.repFindings[]`
  - 原字段：`repNumber`, `result`, `primaryIssue`, `reasons`, `tMs` 等
  - 新增：`snapshotDataUrl?: string`（`image/jpeg` 的 dataURL）

### 2) Rep Findings UI 展示缩略图

- 修改 ReportVisualization 的 Rep Findings 列表项样式：左侧缩略图、右侧文案与状态 pill。
- 入口组件：[PoseToolWidgets.tsx](file:///f:/学校/大四下/毕设/AI-FIT/frontend/src/components/pose/PoseToolWidgets.tsx)
- CSS：在全局样式中新增 finding 布局样式 [app.css](file:///f:/学校/大四下/毕设/AI-FIT/frontend/src/styles/app.css)

### 3) Training History 的显示范围

- 训练历史列表页只显示 summary，不展示完整 ReportVisualization，因此不会显示缩略图。
- Training Report 详情页会渲染 ReportVisualization，因此缩略图会显示：
  - [PoseTrainingReportPage.tsx](file:///f:/学校/大四下/毕设/AI-FIT/frontend/src/pages/pose/PoseTrainingReportPage.tsx)

## 后端/数据库影响评估（塞进 report JSON）

### 变更点

- 前端 `createPoseTraining` 的请求体中 `report` 字段会变大，因为包含 base64（dataURL）缩略图。
- 训练记录的 `report` 字段入库后，历史报告页读取同一份 JSON，所以无需额外媒体表/文件存储。

### 风险与约束

- dataURL 体积膨胀明显（base64 会放大），单次训练若 repFindings 较多会明显增大 `report` 的大小。
- 需要关注后端与部署层的请求体大小限制（Flask/反向代理/网关），以及数据库 JSONB 体积增长带来的存储与查询开销。

### 当前采取的体积控制策略

- 缩略图生成参数在 [reportSnapshots.ts](file:///f:/学校/大四下/毕设/AI-FIT/frontend/src/modules/pose/runtime/offline/reportSnapshots.ts) 中默认：
  - 最大边长：240px
  - JPEG quality：0.65

## 关键文件清单

- 新增：生成与挂载缩略图
  - [reportSnapshots.ts](file:///f:/学校/大四下/毕设/AI-FIT/frontend/src/modules/pose/runtime/offline/reportSnapshots.ts)
- 修改：离线分析流程在归档前写入缩略图
  - [analysis.ts](file:///f:/学校/大四下/毕设/AI-FIT/frontend/src/modules/pose/runtime/offline/analysis.ts)
- 修改：Rep Findings UI
  - [PoseToolWidgets.tsx](file:///f:/学校/大四下/毕设/AI-FIT/frontend/src/components/pose/PoseToolWidgets.tsx)
- 修改：样式
  - [app.css](file:///f:/学校/大四下/毕设/AI-FIT/frontend/src/styles/app.css)

