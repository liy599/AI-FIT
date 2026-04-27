# POSE：Live Feedback + Analysis Report 人性化改动计划（最少改动、最大观感提升）

> 日期：2026-04-26  
> 目标：不调整角度阈值/判定逻辑，仅优化“怎么说、怎么展示”，让答辩演示更直观、更像教练反馈；同时保证 Go detail report / Training History 等页面与接口不报错，数据结构保持兼容。

---

## 0. 约束与验收

### 0.1 硬约束
- 不修改动作识别与纠错阈值（角度、ratio、minFrames、门控等数值不动）。
- 不改变后端接口与存档数据结构的关键字段（避免历史数据/详情页解析报错）。
- 不删除离线报告的“复杂字段与细节”，允许保留给 Detail Report；首页/历史页可更“人话”。

### 0.2 验收标准（最小闭环）
- Live 页面：提示更清晰，门控类信息不再像“动作做错”，刷屏减少，主要提示可执行。
- Video 分析报告：overview/summary/issues/suggestions 读起来更像“教练总结”，且结构兼容旧页面。
- Training History / Report 详情页：打开不报错，历史记录可正常展示。

---

## 1. 统一“语义等级”与颜色（展示层，不改逻辑）

目的：把输出分成用户能理解的 4 类，并在 Live/Report 一致使用。

- Gate（灰/蓝灰）：视角门控、关键点质量、assessable/unassessed 等“我看不清/不满足条件”
- Warning（黄/橙黄）：可继续但需要改进（轻度代偿、稳定性差）
- Issue（红）：明确姿势错误/风险姿态（需要纠正）
- Rep Fail（深红）：rep 级不合格（离线报告/rep finding 层更清晰）

说明：代码里仍可能叫 warning/issue；这里的等级只决定“展示优先级、颜色、措辞”，不要求与字段名完全一致。

---

## 2. 核心策略：新增“文案映射层”（最大性价比）

### 2.1 为什么用映射层
- 最少改动：不需要逐个 analyzer 改 message，不动算法。
- 一次改动，全链路收益：Live UI 与 Report 生成同时变“人话”。
- 兼容性高：底层仍保留原 message/code，历史数据仍可解析。

### 2.2 映射层输入输出
- 输入：原始 message 或 code（优先 code；缺 code 时用 message contains）
- 输出：
  - `label`: 更人性化的一句话（动词开头，可执行）
  - `severity`: Gate/Warning/Issue/RepFail（仅展示用）
  - `shortHint`（可选）：更短的口令版（用于 Live）

### 2.3 文案写作规范（答辩友好）
- 一条提示尽量满足：哪里不对 + 立刻怎么做（必要时一句原因）。
- 门控类必须用“我看不清/角度不对”表达，不要像判错。
- Live 一次只显示 1 条主提示（避免刷屏）。

---

## 3. Live Feedback（实时页面）最少改动点

### 3.1 只显示“主提示”
优先级建议：Rep Fail > Issue > Warning > Gate。

### 3.2 门控类从“错误”改成“拍摄建议”
示例（表达风格）：
- 旧：Side view unstable / Low keypoint confidence
- 新：Camera angle not usable—switch to a clearer side/front view and keep your full body in frame.

### 3.3 维持现有数据结构
- 不改变 analyzer 输出结构（warnings/issues/lastRep* 等字段不动）。
- 在 UI 展示前做一次映射与筛选。

---

## 4. Analysis Report（离线报告）最少改动点

### 4.1 保留复杂 details，优化 overview/summary/issues/suggestions
- Detail Report：继续展示现有复杂字段（timeline、repFindings、tuning/tempo 等）。
- Training History 列表/概览：展示更精炼的人话摘要（Top 2 problems + Top 3 fixes + Gate notes）。

### 4.2 “问题汇总”的呈现风格
建议统一为可量化表达：
- “Depth insufficient in 4/10 assessed reps (40%).”
- “Knee forward drift detected in 5/12 assessed reps (42%).”

### 4.3 Gate 信息单独一段
例：
- “Some reps were not assessable due to camera angle drift or low keypoint confidence.”

---

## 5. 最小实现步骤（建议顺序）

1) 新增/集中一个“message/code → human feedback”映射函数（不改 analyzer）。
2) Live：接入映射 + 只显示主提示 + Gate 灰色化。
3) Report 生成：接入映射/更人话 summary（保留原 issues 结构或只改 message 文案，避免影响解析）。
4) 训练历史页：显示更短的 summary 与 Top issues（保留跳转 detail 的完整信息）。
5) 回归：跑现有验证视频集，确认每个视频的主提示命中预期主题；打开 History/Detail 不报错。

---

## 6. 用现有验证视频集的验收口径（不加新算法）

对每个视频至少满足：
- Correct：输出 “No obvious issues” 或仅 info，不出现红色主提示。
- 典型错误视频（torso lean / symmetry / hips sag 等）：主提示必须是对应错误的纠正口令。
- Side view unstable：主提示必须归 Gate（灰/蓝灰），且给出拍摄建议。
- rep fail：报告中体现 rep 不合格（深红等级或明确措辞），但不影响历史页加载。

