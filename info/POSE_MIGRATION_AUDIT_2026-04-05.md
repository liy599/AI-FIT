# 姿态迁移审查报告

日期：2026-04-05

审查范围：

- 对照 `train/TRAIN_双功能真实迁移方案_基于当前仓库.md` 审查 pose 迁移目标是否真正落地
- 交叉核对 `info/POSE_MIGRATION_LOG.md` 中记录的迁移过程
- 检查当前 AI-FIT 前后端实现是否与文档描述一致
- 判断当前状态是否已经“真正对齐 train”，而不只是做了最小闭环

本次验证：

- `frontend`：`npm.cmd run typecheck`，通过
- `backend`：`.\\.venv\\Scripts\\python.exe -m pytest tests/test_pose.py -q`，结果为 `4 passed`

## 一、执行结论

当前结论很明确：

- 这次 pose 迁移是“真实迁移”，不是假迁移。实时纠错、离线视频分析、后端任务闭环、训练记录落库都已经在主仓库真实落地。
- 但如果标准是“与 `train` 真正完整对齐”，目前还没有完成。

更准确的状态应表述为：

- `核心能力已迁移`
- `训练历史 / 报告查看链路未完全迁移`
- `统一报告归档层仅部分迁移`
- `姿态页源码清理未完成`

一句话总结：

- 如果标准是“是否已把 pose 主能力迁入 AI-FIT 并打通前后端闭环” -> 是
- 如果标准是“是否已经达到 train 的产品级对齐状态” -> 还没有

## 二、主要发现

### 高优先级问题

1. 训练历史能力只迁了一半，当前只有“保存训练记录”，没有把 `train` 的“历史查看链路”真正迁过来。

证据：

- AI-FIT 后端在 [`backend/app/routes/pose.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/pose.py#L240) 只提供了 `POST /api/pose/trainings`，没有 `GET /api/pose/trainings`，也没有训练会话详情、删除、更新等接口。
- 从 [`backend/app/routes/pose.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/pose.py#L79) 到 [`backend/app/routes/pose.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/pose.py#L240) 的路由清单可确认，training 相关只有一个写入接口。
- 前端姿态页虽然已经能通过 [`frontend/src/pages/PoseToolPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/PoseToolPage.tsx#L308) 中的 `createPoseTraining()` 保存训练记录，但 AI-FIT 当前路由中并没有对应的“姿态训练历史页”或“查看已保存报告”入口；[`frontend/src/App.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/App.tsx#L24) 目前只有 `/tools/pose`。
- `train` 侧是有完整历史链路的：
  - 实时页里有 “View saved report” 和 “Go to History”，见 [`train/src/app/live/LiveClient.tsx`](/d:/trae/trae_projects/AI-FIT/train/src/app/live/LiveClient.tsx#L828)
  - 历史页实现存在于 [`train/src/app/history/HistoryClient.tsx`](/d:/trae/trae_projects/AI-FIT/train/src/app/history/HistoryClient.tsx#L1)
  - 历史列表 API 存在于 [`train/src/app/api/v1/private/trainings/route.ts`](/d:/trae/trae_projects/AI-FIT/train/src/app/api/v1/private/trainings/route.ts#L14)

影响：

- 当前 AI-FIT 已完成“保存训练记录”，但还没有完成“使用训练历史”。
- 这说明它已经达到迁移方案中的最小持久化目标，但还没有达到 `train` 的完整产品流。

判断：

- `与最小迁移方案对齐`
- `与 train 产品链路未完整对齐`

1. 统一报告归档层没有真正迁完，AI-FIT 当前还是最小占位实现，不是 `train` 那套规范化归档管线。

证据：

- AI-FIT 的 `normalizeReportForArchive()` 在 [`frontend/src/lib/report/unified.ts`](/d:/trae/trae_projects/AI-FIT/frontend/src/lib/report/unified.ts#L1) 中实际上是 no-op。
- AI-FIT 的 PDF 报告渲染在 [`frontend/src/lib/report/unified.ts`](/d:/trae/trae_projects/AI-FIT/frontend/src/lib/report/unified.ts#L5) 里只是通用 key/value 输出。
- `train` 中存在真正的统一归档层，会做结构清洗、字段标准化、错误统计、时间线采样和结构化 PDF 渲染，见 [`train/src/lib/report/unified.ts`](/d:/trae/trae_projects/AI-FIT/train/src/lib/report/unified.ts#L179) 和 [`train/src/lib/report/unified.ts`](/d:/trae/trae_projects/AI-FIT/train/src/lib/report/unified.ts#L236)。

影响：

- 当前 AI-FIT 的报告可以导出、可以存档，但归档一致性和结构稳定性弱于 `train`。
- 如果报告 schema 后续演化，AI-FIT 当前对结构漂移的抵抗力不如 `train`。

判断：

- `功能可用`
- `实现深度尚未对齐 train`

### 中优先级问题

1. 姿态页源码中仍保留大量中文文案和 CSS 覆盖式兜底，因此“源码已完成英文统一和清理”这一点并不成立。

证据：

- [`frontend/src/pages/PoseToolPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/PoseToolPage.tsx#L97)、[`frontend/src/pages/PoseToolPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/PoseToolPage.tsx#L155)、[`frontend/src/pages/PoseToolPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/PoseToolPage.tsx#L376)、[`frontend/src/pages/PoseToolPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/PoseToolPage.tsx#L487)、[`frontend/src/pages/PoseToolPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/PoseToolPage.tsx#L708)、[`frontend/src/pages/PoseToolPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/PoseToolPage.tsx#L954) 等位置仍直接存在中文字符串。
- 多处可见文案是通过 CSS 把原文字体设成 `0` 再用 `::after` 注入英文内容来兜底，见 [`frontend/src/styles.css`](/d:/trae/trae_projects/AI-FIT/frontend/src/styles.css#L41)、[`frontend/src/styles.css`](/d:/trae/trae_projects/AI-FIT/frontend/src/styles.css#L124)、[`frontend/src/styles.css`](/d:/trae/trae_projects/AI-FIT/frontend/src/styles.css#L152)、[`frontend/src/styles.css`](/d:/trae/trae_projects/AI-FIT/frontend/src/styles.css#L195)、[`frontend/src/styles.css`](/d:/trae/trae_projects/AI-FIT/frontend/src/styles.css#L387)。
- 实时反馈区域还通过 nth-of-type 方式隐藏旧卡片，见 [`frontend/src/styles.css`](/d:/trae/trae_projects/AI-FIT/frontend/src/styles.css#L354)。

影响：

- 页面运行时看起来可能已经基本可用，但源码层面仍然处于“过渡态”。
- 后续维护成本更高，也更容易在继续修改时引入问题。

判断：

- `表面 UI 可能已对齐`
- `源码质量尚未真正对齐`

1. AI-FIT 的实时训练保存语义与 `train` 在一个重要边界场景上存在行为差异。

证据：

- AI-FIT 在 [`frontend/src/pages/PoseToolPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/PoseToolPage.tsx#L313) 中，当 rep 数为 `0` 时直接拒绝保存。
- `train` 在 [`train/src/app/live/LiveClient.tsx`](/d:/trae/trae_projects/AI-FIT/train/src/app/live/LiveClient.tsx#L312) 中会故意写入一个 placeholder set，从而允许“0 reps 但有报告”的场景也能进入历史归档。

影响：

- 在短时失败训练、未完成动作但仍希望保留报告的场景下，AI-FIT 当前会丢失一次可归档机会，而 `train` 不会。

判断：

- `产品语义存在差异`
- `不是当前迁移阻塞项`

### 低优先级问题

1. 后端 pose 路径已有专项测试，但更完整的前端到浏览器侧联调覆盖仍然不足。

证据：

- 后端路由测试已经存在于 [`backend/tests/test_pose.py`](/d:/trae/trae_projects/AI-FIT/backend/tests/test_pose.py#L1)。
- 目前没有浏览器级集成验证去证明完整的前端离线分析链路在真实 MediaPipe 执行下始终稳定。

影响：

- 当前对 API 正确性的信心较高。
- 对浏览器运行时边界场景的信心还不够高。

判断：

- `后端可靠性已有较好保证`
- `前端 E2E 级验证仍偏弱`

## 三、对齐矩阵

### 1. 实时纠错

状态：`核心能力已对齐`

已确认完成：

- 摄像头启动 / 停止
- MoveNet 实时检测
- 骨架叠加
- 次数与角度显示
- Coaching Tip 展示
- JSON / PDF 导出
- 保存训练记录到后端

证据：

- 主页面实现位于 [`frontend/src/pages/PoseToolPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/PoseToolPage.tsx#L30)
- 保存路径位于 [`frontend/src/pages/PoseToolPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/PoseToolPage.tsx#L308)

结论：

- 这一部分已经是真实迁移，不是伪闭环。

### 2. 离线视频分析

状态：`核心能力已对齐`

已确认完成：

- 上传视频
- 创建分析任务
- 通过 blob URL 获取受保护视频
- 浏览器端 MediaPipe 提取关键点
- 标准模板比对或通用分析
- 成功 / 失败回写
- 报告展示
- JSON / PDF 导出

证据：

- 前端串联逻辑位于 [`frontend/src/pages/PoseToolPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/PoseToolPage.tsx#L358)
- pose API 封装位于 [`frontend/src/lib/poseApi.ts`](/d:/trae/trae_projects/AI-FIT/frontend/src/lib/poseApi.ts#L1)
- 后端任务接口位于 [`backend/app/routes/pose.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/pose.py#L147)

结论：

- 这一部分也已经是真实迁移。

### 3. 后端持久化与任务闭环

状态：`与迁移方案对齐`

已确认完成：

- `video_assets`
- `analysis_tasks`
- `analysis_results`
- `training_sessions`
- `training_sets`
- 上传限制提升到 80MB
- 鉴权保护的视频文件访问

证据：

- 数据模型见 [`backend/app/models.py`](/d:/trae/trae_projects/AI-FIT/backend/app/models.py#L250)
- 应用配置与蓝图注册见 [`backend/app/__init__.py`](/d:/trae/trae_projects/AI-FIT/backend/app/__init__.py#L35)

结论：

- 后端最小闭环已经真实落地。

### 4. 训练历史

状态：`未完全迁移`

目前已有：

- 可以把 session / report 存入数据库

相对 `train` 仍缺失：

- 历史列表 API
- 历史详情 / 查看路径
- 页面内“查看已保存报告”延续链路
- 历史导航入口

结论：

- 这是当前最大的产品级缺口。

### 5. 统一报告层

状态：`部分迁移`

目前已有：

- 报告生成
- JSON / PDF 导出
- 报告字段入库保存

尚未完全对齐：

- 统一归档 contract
- 更稳健的报告清洗与标准化
- 与 `train` 等级一致的结构化 PDF 输出

结论：

- 当前是“能用”，但还不是“真正完整迁完”。

## 四、不是问题的问题

以下内容不应算作本次迁移失败，因为它们原本就不在当前迁移目标范围内：

- 后端 worker 真正执行姿态推理
- 整个 `train` Next.js 应用整体迁入
- Prisma / SQLite 保留运行
- 隐私、TTL、原始视频保存策略整套迁入

## 五、最终评估

当前迁移完成度可分为：

- `姿态核心能力完成度`：高
- `与迁移方案的一致性`：高
- `与 train 产品级对齐程度`：中

建议的后续动作顺序：

1. 在 AI-FIT 中补齐姿态训练历史的查询、详情和查看入口。
2. 将 [`frontend/src/lib/report/unified.ts`](/d:/trae/trae_projects/AI-FIT/frontend/src/lib/report/unified.ts#L1) 从当前占位实现替换为 `train` 中真正的统一归档实现。
3. 清理 [`frontend/src/pages/PoseToolPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/PoseToolPage.tsx#L1) 和 [`frontend/src/styles.css`](/d:/trae/trae_projects/AI-FIT/frontend/src/styles.css#L1)，让页面文案由源码直接拥有，而不是依赖 CSS 隐藏 / 覆盖。
4. 至少补一条浏览器级手工或自动 smoke 路径，验证离线分析链路的真实联调稳定性。

底线结论：

- 这次迁移是真实的。
- pose 最重要的能力已经进入 AI-FIT。
- 但现在还不能准确表述为“已与 train 完整对齐”；训练历史链路和统一报告归档层是当前最主要的剩余差距。

