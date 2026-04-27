# POSE Analysis Report 重排与人性化展示备案

日期：2026-04-26

## 目标

- 在不修改动作识别阈值、角度规则、判错逻辑、接口结构的前提下，优化 `Analysis Report` 的阅读顺序与观感。
- 让用户优先看到结论、问题、改法，再看评分说明与技术细节。
- 保证 `Training History`、`Detail Report`、历史存档数据继续兼容。

## 本次调整范围

- 页面：
  - `frontend/src/pages/poseTool/PoseToolWidgets.tsx`
  - `frontend/src/pages/PoseTrainingReportPage.tsx`
  - `frontend/src/pages/PoseToolPage.tsx`
  - `frontend/src/styles.css`

## 结构调整

原顺序偏向“技术报告”阅读路径。

现调整为：

1. `Summary`
2. `Top Issues`
3. `What To Fix`
4. `How This Report Scores Your Form`
5. `Key Metrics`
6. `Rep Findings / Timeline`

## 文案与展示调整

- `Issues` 改名为 `Top Issues`
- `Suggestions` 改名为 `What To Fix`
- `Assessment Criteria` 改名为 `How This Report Scores Your Form`
- 评分说明改为更短、更人话的 3 条说明：
  - Counted rep
  - Form check
  - Gate note

## 按钮调整

- 保留顶部全局 `Training History`
- 去掉离线 `Analysis Report` 区域内：
  - `Open Detailed Report`
  - `Go To Training History`

原因：

- 两个按钮在当前页面中属于重复跳转入口
- 会分散用户对报告本身的关注
- 当前 Detail Report 与 Analysis Report 内容重叠度较高，暂时不强调该入口

## 样式调整

- 强化 `Summary` 之后的主阅读区层级
- `Top Issues` 卡片改为更柔和但更明确的浅底块
- `What To Fix` 提高行高与留白，增强“教练建议”感
- `How This Report Scores Your Form` 使用浅底说明卡样式，弱化技术说明感

## 主报告框架统一

- `Deep Squat` 与其他动作统一为同一套主报告框架：
  - `Summary`
  - `Top Issues`
  - `What To Fix`
  - `How This Report Scores Your Form`
  - `Key Metrics`
  - `Rep Findings / Timeline`
- 统一的是展示框架与信息顺序，不是强行取消动作本身的分析差异

## 核心指标精简

- 主报告首页的数值卡片精简为 5 张：
  - `Total Reps`
  - `Effective Reps`
  - `Invalid Reps`
  - `Form Accuracy`
  - `Average Rep Duration`
- 不再在主报告区域自动补充其它技术型 `keyMetrics`
- 目的：
  - 提高答辩展示的直观性
  - 避免 `Correct/Incorrect/Assessed/FPS` 等重复或过技术化指标分散注意力
  - 让数值卡片更服务于“问题与改法”的主叙事

## 兼容性说明

- 不修改 `PoseAnalysisReport` 关键字段结构
- 不删除 `details / repFindings / timeline` 等细节字段
- `Training History` 仍读取 `report.summary`
- `Detail Report` 仍读取 `summary / issues / suggestions / details`
- 历史数据无需迁移

## 结论

本次改动属于“展示层重排 + 文案与样式优化”，不影响后端接口、不影响历史存档结构、不影响动作识别逻辑，适合作为答辩演示版的低风险体验提升。
