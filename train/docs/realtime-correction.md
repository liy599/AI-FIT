# 实时矫正功能现状与待完善项（项目内版本）

## 1. 目标与范围

本项目的“实时矫正”指在浏览器端打开相机后：

- 实时做人体姿态检测（33 点为主，必要时 17 点 MoveNet 兜底）并稳定跟踪
- 按动作标准模板/规则对当前帧打分与判错
- 在画面上以骨架叠加 + 红/绿高亮提示“哪里不对”
- 在右侧面板输出可读的指标、相位、错误统计与建议
- 在会话结束时导出运动报告（PDF/JSON）

入口页面为 [/live](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/train/src/app/live/page.tsx) 与其客户端组件 [LiveClient.tsx](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/train/src/app/live/LiveClient.tsx)。

## 2. 现在做到什么程度

### 2.1 入口与门禁（已完成）

- /live 需要先在训练中选择动作，否则展示空态引导并提供跳转到 `/train/session` 的按钮：[/live/page.tsx](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/train/src/app/live/page.tsx)
- 训练编辑页的每个 set 提供“实时分析”入口，跳转到 `/live?exerciseId=...`：[/train/TrainClient.tsx](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/train/src/app/train/TrainClient.tsx)

当前 `exerciseId` 主要用于门禁与引导，实时分析逻辑本身尚未按 `exerciseId` 动态切换动作/视角标准（见“待完善项”）。

### 2.2 姿态模型与数据源（已完成）

实时链路优先使用 MediaPipe PoseLandmarker，必要时切换 MoveNet Thunder 兜底，输出统一为可供后续分析/绘制的 33 点结构：

- Provider 选择与统一输出：[/lib/pose/livePoseProvider.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/train/src/lib/pose/livePoseProvider.ts)
- MoveNet 适配（17 点 keypoints → landmarks33）：[/lib/pose/movenetPose.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/train/src/lib/pose/movenetPose.ts)、[/lib/pose/movenetTracker.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/train/src/lib/pose/movenetTracker.ts)

### 2.3 “准备期校准 + 稳定跟踪”（已完成）

为减少转身/抖动造成的关键点乱跳，实时分析进入后会先做约 4 秒准备期校准，之后进入稳定跟踪状态并维护 3D 历史缓存：

- 跟踪状态机与平滑/速度限制：[/lib/pose/movenetTracker.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/train/src/lib/pose/movenetTracker.ts)
- 右侧面板会显示：准备进度、追踪状态、3D 缓存帧等：[/live/LiveClient.tsx](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/train/src/app/live/LiveClient.tsx)

### 2.4 距离提示（已完成）

实时页面会输出“过近 / 合适 / 过远”提示，并附带估计方式：

- 优先 world landmarks（3D）
- 退化到 landmark z（相对深度）
- 再退化到 2D 尺度回退（肩宽/bbox 等），并给出精度提示

实现：[/lib/pose/distanceTracker.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/train/src/lib/pose/distanceTracker.ts)

### 2.5 实时矫正：规则检测（已完成，但动作范围有限）

当前实时规则检测主要针对“深蹲（侧面）”，包括：

- 相位/状态机与计次（repCount、correct/incorrect 计数）
- 常见错误检测与会话统计：深度不足、膝过脚尖、前倾/后仰、侧视偏移等
- beginner / pro 两档阈值

实现：[/lib/pose/realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/train/src/lib/pose/realtimeSquat.ts)

### 2.6 实时矫正：标准模板对比（已完成，但标准范围有限）

实时页面会将每帧指标与“标准模板”进行对比，生成：

- overallScore（整体评分）
- phaseLabel（当前相位）
- targets（每帧关键数值与打分）
- highlights（最需要关注的 Top 差异项及提示语）

实现：

- 对比与打分：[/lib/pose/motionCompare.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/train/src/lib/pose/motionCompare.ts)
- 当前标准模板（深蹲-侧面 v1）：[/lib/pose/motionStandards.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/train/src/lib/pose/motionStandards.ts)
- 指标来源（PoseFrame / MetricTracker）：[/lib/pose/poseFrame.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/train/src/lib/pose/poseFrame.ts)、[/lib/pose/poseMetricTracker.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/train/src/lib/pose/poseMetricTracker.ts)

### 2.7 画面叠加：骨架绿/红标注（已完成）

实时画面用 canvas 叠加骨架，并对异常关节/骨骼红色高亮、正常为绿色；错误部位来自模板对比结果映射：

- 指标 → 关节/骨骼映射：[/lib/pose/motionOverlay.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/train/src/lib/pose/motionOverlay.ts)
- 绘制实现：[/lib/pose/draw.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/train/src/lib/pose/draw.ts)

### 2.8 面板与交互（已完成）

右侧面板提供：

- 模式切换（初学者/专业）
- 跟踪状态、距离提示、对比错误统计
- 当前相位、差异提示列表
- “关键数值（每帧）”表格（可折叠）
- 会话摘要（错误计数与准确率等）

实现：[/live/LiveClient.tsx](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/train/src/app/live/LiveClient.tsx)

### 2.9 训练结束报告与导出（已完成）

实时会话结束后可导出：

- PDF：打开打印窗口并“另存为 PDF”
- JSON：导出统一结构的报告（脱敏、采样时间线）

实现：

- Live 导出入口：[/live/LiveClient.tsx](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/train/src/app/live/LiveClient.tsx)
- 报告归一化（UnifiedReport、采样 timeline、errorStats）：[/lib/report/unified.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/train/src/lib/report/unified.ts)
- 打印窗口封装：[/lib/print.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/train/src/lib/print.ts)

## 3. 数据产出与隐私策略（当前实现）

- 实时导出 JSON 不是逐帧关键点原始数据，而是“统一报告结构 UnifiedReport”，包含摘要、指标、错误统计与采样时间线。
- 默认不保存视频原件；隐私导出（训练/分析数据）入口在 [/privacy](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/train/src/app/privacy/page.tsx)，服务端聚合导出在 [/api/v1/private/privacy/export](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/train/src/app/api/v1/private/privacy/export/route.ts)。

## 4. 已知边界与不足（需要完善的点）

### 4.1 “动作/视角选择”尚未真正接入实时矫正（优先级：P0）

现状：

- /live 要求有 `exerciseId`，但实时分析逻辑内部并未根据 `exerciseId` 切换不同的 analyzer/标准模板。
- 目前实时规则与模板对比本质上是“固定深蹲侧面”能力。

建议完善方向：

- 建立实时的 `exerciseId -> exerciseName/viewAngle -> analyzer + MotionStandard` 选择器，至少复用离线分析侧的选择思路：[/lib/pose/analysisSelector.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/train/src/lib/pose/analysisSelector.ts)
- UI 显示“当前动作/视角/标准版本”，并在不支持的组合下给出明确提示。

### 4.2 动作与标准模板覆盖面较窄（优先级：P0/P1）

现状：

- 模板标准目前以“深蹲（侧面）v1”为核心。
- 其他动作/视角尚无对应的标准模板与实时规则体系。

建议完善方向：

- 扩展 `motionStandards.ts` 标准模板集合（动作 × 视角）。
- 将实时规则检测从“动作写死”演进到“标准驱动”或“动作插件化”。

### 4.3 性能与稳定性策略仍偏基础（优先级：P1）

现状：

- `tick()` 在主线程串行 `await detect`，并通过 `busy` 防重入；在低端机/弱网/后台标签页等情况下可能出现掉帧与延迟抖动。
- 当前降级主要依赖 provider 内部切换模型与 quality streak，缺少显式 FPS 限流与自适应策略。

建议完善方向：

- 增加 FPS 限流（如 15/20 FPS）与跳帧策略（保持 UI 绘制流畅、推理可降频）。
- 将推理搬到 Worker（或 OffscreenCanvas 协作）减少 UI 抖动。
- 在“距离不合适/人体不完整/关键点质量低”时自动降低推理频率并提示用户调整机位。

### 4.4 叠加提示的信息密度还有提升空间（优先级：P2）

现状：

- 画面层主要用红/绿高亮指出“哪里不对”，但缺少“往哪个方向改、改到什么范围”的可视化引导。

建议完善方向：

- 将 `highlights` 的 cue 与方向做成画面箭头/标尺/目标区间（例如膝盖轨迹、髋角目标范围）。
- 增加“标准参考姿态/相位进度条”叠加，降低用户理解成本。

### 4.5 实时结果未与训练日志强关联（优先级：P2）

现状：

- Live 会话统计与时间线在内存里，导出需要手动触发，未自动挂接到训练 set/session。

建议完善方向：

- 新增 LiveSession（或把 report 写入 TrainingSession.report），允许历史回看与对比，并在隐私导出中自然包含。

## 5. 当前测试与可验证性

- 单测覆盖：距离提示回退与深蹲阈值判断（见 `tests/unit/*`）。
- e2e 覆盖：注册/训练/分析/删除核心流程（见 `tests/e2e.core-flow.test.mjs`）。
- 建议新增（后续）：/live 页面在“无 exerciseId”“无相机权限”“低质量关键点”等场景的端到端用例。

