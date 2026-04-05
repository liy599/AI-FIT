# Train 双功能真实迁移方案（基于当前仓库）

本文只讨论你当前已经明确要落地的两项能力，不再扩展到 `train/` 的完整产品功能。

目标范围：

1. 把 `train` 的前端实时动作纠错能力迁到主项目现有 [PosePage.tsx](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/PosePage.tsx)。
2. 在主项目 `Flask + PostgreSQL` 内补最小数据模型与接口，支持：
   - 视频上传
   - 视频文件访问
   - 创建分析任务
   - 前端用 MediaPipe 跑离线视频分析
   - 前端把分析报告回写到 Flask
   - 训练记录落库

前端约束：

- `PosePage` 必须保持主项目 `frontend/` 现有页面风格与视觉语言。
- 可以为实时纠错和离线分析扩展布局与组件，但不能整体切成 `train` 那套界面风格。
- 迁移重点是功能能力，不是照搬 `train` 的页面外观。

不纳入本阶段：

- `train` 的完整登录/注册/Session 体系
- `train` 的 Next.js 页面整体迁入
- `train` 的 Prisma/SQLite 保留运行
- 服务化网关反代
- 后端真正跑视频分析模型

这是一份“基于当前仓库可直接开工”的方案，不是抽象建议。

## 一、结论

这两项能力适合直接并入主项目，不建议先走“保留 train 为独立服务”的过渡路线。

原因：

- 主项目已经有 JWT 认证、React 页面和统一 API 调用方式，直接接入成本更低。
- 你想要的两项核心能力，本质上都可以以前端计算为主，后端只做存储和任务管理。
- `train` 里真正难迁的是整套 Next 页面、Cookie Session、Prisma 数据层；而这两项能力并不需要它们。

因此最合适的路线是：

1. 直接复用 `train/src/lib/pose/**`、`train/src/lib/report/**`、`train/src/lib/movenet/**` 中可前端运行的 TS 逻辑。
2. 在主项目 `backend/` 新增最小模型和一组新路由。
3. 在主项目 `frontend/` 直接重做实时页和离线分析页，不再依赖 `train` 页面壳。

## 二、当前仓库真实情况

### 1. 主项目后端现状

主项目后端是 Flask，应用在 [backend/app/__init__.py](/d:/trae/trae_projects/AI-FIT/backend/app/__init__.py) 中注册蓝图，认证是 JWT，见 [backend/app/routes/auth.py](/d:/trae/trae_projects/AI-FIT/backend/app/routes/auth.py)。

几个关键现状：

- 已有统一 JWT 身份体系，不需要引入 `train` 的 Cookie Session。
- 已有上传目录 `instance/uploads`，并暴露 `/uploads/<path>` 静态访问。
- 当前 `MAX_CONTENT_LENGTH` 默认只有 `5MB`，不够视频上传。
- 当前使用 `db.create_all()`，没有 Alembic 迁移体系。

这意味着本次落地时，后端新增表和接口可以沿用现有组织方式，但要注意两件事：

- 视频大小限制必须上调。
- 新增模型后首次部署会直接建表；如果后面你们准备上生产，建议尽快补 Alembic。

### 2. 主项目前端现状

主项目前端是 Vite React，已有统一 API 封装 [frontend/src/lib/api.ts](/d:/trae/trae_projects/AI-FIT/frontend/src/lib/api.ts)，已有姿态页占位 [frontend/src/pages/PosePage.tsx](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/PosePage.tsx)。

这意味着：

- 实时页不需要新开子应用，直接替换 `PosePage.tsx` 即可。
- 离线视频分析页可以放在现有路由体系下，例如继续挂在 `/tools/pose` 内做 Tab 切换，或新增 `/tools/pose/offline`。

### 3. train 中真正值得迁的部分

只迁以下几类：

- 实时检测与纠错
  - `train/src/lib/pose/realtimeSquat.ts`
  - `train/src/lib/pose/livePoseProvider.ts`
  - `train/src/lib/pose/movenetPose.ts`
  - `train/src/lib/pose/movenetTracker.ts`
  - `train/src/lib/pose/draw.ts`
  - `train/src/lib/pose/distanceTracker.ts`
  - `train/src/lib/movenet/squatExport.ts`
- 离线视频分析
  - `train/src/lib/pose/mediapipePose.ts`
  - `train/src/lib/pose/genericMotion.ts`
  - `train/src/lib/pose/report.ts`
  - `train/src/lib/pose/analysisSelector.ts`
  - `train/src/lib/pose/motionStandards.ts`
  - `train/src/lib/pose/motionStandardCompareReport.ts`
- 报告归档/导出
  - `train/src/lib/report/unified.ts`
  - `train/src/lib/print.ts`

不建议迁：

- `train/src/app/**`
- `train/src/lib/auth.ts`
- `train/middleware.ts`
- `train/prisma/**`
- `train/src/lib/analysisWorker.ts`

原因很简单：这几块是 `train` 作为独立 Next 全栈项目的外壳，不是你要的能力本身。

## 三、目标架构

本次迁移后的结构建议如下：

### 前端

主项目前端负责：

- 摄像头实时姿态检测与纠错
- 本地生成实时报告 JSON / PDF
- 本地离线视频抽帧 + MediaPipe 提取关键点
- 本地生成离线分析报告
- 把视频和报告分别提交给 Flask

### 后端

主项目后端负责：

- 校验 JWT
- 接收视频上传并保存
- 提供视频访问地址
- 创建/查询/完成分析任务
- 保存分析结果 JSON
- 保存训练记录

### 数据库

全部进入现有 PostgreSQL，不再使用 `train` 的 SQLite/Prisma。

## 四、实施范围拆解

本次拆成两个功能包实施。

### 功能包 A：实时纠错 + 本地报告导出

#### 用户能力

用户进入姿态页后，可以：

- 打开摄像头
- 实时看到骨架和动作纠错提示
- 看到深蹲次数、关键角度、错误提示
- 导出本地 JSON 报告
- 导出 PDF 报告

#### 是否需要后端

最小版不依赖后端。

可选增强：

- 增加“保存到训练历史”按钮，调用后端创建 `training_sessions` / `training_sets`。

#### 真实开发动作

前端直接把 `train/src/app/live/LiveClient.tsx` 的页面逻辑，改造进主项目 `PosePage.tsx`。

不要整页照搬，建议做以下拆分：

- 新建 `frontend/src/features/pose-live/LivePosePanel.tsx`
- 新建 `frontend/src/features/pose-live/useLivePose.ts`
- 新建 `frontend/src/features/pose-live/types.ts`
- 把 `train/src/lib/pose/**` 中需要的工具迁入 `frontend/src/lib/pose/**`
- 把 `train/src/lib/report/**` 中前端可运行部分迁入 `frontend/src/lib/report/**`

这样做的原因：

- 当前 `PosePage.tsx` 是占位实现，适合作为入口页，不适合继续堆所有逻辑。
- `train` 的 `LiveClient.tsx` 文件过大，直接复制会给后续维护埋雷。

#### 首期动作范围建议

首期只保留：

- 实时画面
- 骨架绘制
- 深蹲次数
- 关键角度
- 一条主纠错建议
- 导出 JSON
- 导出 PDF

首期先不保留：

- 所有训练设置持久化
- 所有 mock 场景
- 保存到历史
- 过多视觉装饰和控制项

这样最稳。

### 功能包 B：离线视频分析 + 报告回写

#### 用户能力

用户可以：

- 上传视频
- 创建分析任务
- 在浏览器里跑 MediaPipe 离线分析
- 生成分析报告
- 把结果回写到 Flask
- 之后查看任务状态和报告

#### 计算位置

短期必须放前端。

原因：

- `train` 当前离线分析默认就是浏览器端抽帧与关键点提取。
- 你们当前 Flask 后端没有现成的模型推理链路。
- 这样可以最快上线，而且和你现在要求完全一致。

#### 真实开发动作

前端复用 `train/src/lib/pose/mediapipePose.ts` 和分析/报告生成逻辑。

后端新增视频和分析任务相关接口，不需要实现任何推理。

## 五、后端真实落地方案

## 5.1 新增数据模型

建议直接在 [backend/app/models.py](/d:/trae/trae_projects/AI-FIT/backend/app/models.py) 中新增 5 组模型。

命名保持与你要求一致，同时尽量贴近现有风格。

### 1. `VideoAsset`

建议字段：

- `id`: `Integer` 主键
- `user_id`: FK -> `users.id`
- `original_name`: 原文件名
- `mime_type`
- `size_bytes`
- `storage_path`
- `duration_seconds`: 可空
- `created_at`

说明：

- 首期不用做 `keep_original`、`expires_at`，除非你明确要保留自动清理策略。
- 当前主项目没有对象存储，先落本地磁盘即可。

### 2. `AnalysisTask`

建议字段：

- `id`
- `user_id`
- `video_asset_id`
- `exercise_type`: 先直接 `String(50)`，不要急着做分类表
- `view_angle`: `unknown/front/side/back`
- `instruction`: 可空
- `status`: `uploaded | running | succeeded | failed`
- `started_at`
- `finished_at`
- `error_message`
- `created_at`
- `updated_at`

说明：

- 这里不用强行引入 `Exercise`、`ExerciseCategory`。
- 你当前只关心深蹲，首期先用字符串足够。

### 3. `AnalysisResult`

建议字段：

- `id`
- `task_id`
- `report_json`: `db.JSON`
- `created_at`

说明：

- PostgreSQL 下 SQLAlchemy 的 `db.JSON` 最终会映射到 JSON/JSONB 能力；首期够用。
- 不要一开始拆结构化表。

### 4. `TrainingSession`

建议字段：

- `id`
- `user_id`
- `started_at`
- `ended_at`
- `note`
- `report_json`
- `created_at`
- `updated_at`

### 5. `TrainingSet`

建议字段：

- `id`
- `training_id`
- `exercise_type`
- `set_order`
- `reps`
- `weight`
- `note`
- `created_at`

说明：

- 这里不要直接照搬 `train` 的 `exerciseId` 依赖。
- 主项目目前没有对应的动作目录体系，先扁平化最稳。

## 5.2 模型关系建议

- `User 1 - n VideoAsset`
- `User 1 - n AnalysisTask`
- `AnalysisTask 1 - n AnalysisResult`
- `User 1 - n TrainingSession`
- `TrainingSession 1 - n TrainingSet`

## 5.3 后端接口设计

建议新增独立蓝图：

- `backend/app/routes/pose.py`

并在 [backend/app/__init__.py](/d:/trae/trae_projects/AI-FIT/backend/app/__init__.py) 注册为：

- `/api/pose/...`

### 接口 1：上传视频

`POST /api/pose/videos`

请求：

- `multipart/form-data`
- 字段：`file`

返回：

- `video`
  - `id`
  - `original_name`
  - `mime_type`
  - `size_bytes`
  - `url`

### 接口 2：获取视频元数据列表

`GET /api/pose/videos?page=1&page_size=20`

### 接口 3：读取视频文件

建议：

- `GET /api/pose/videos/<id>/file`

这里最好支持 `Range`。

原因：

- `train` 的离线分析实现是让浏览器加载视频后逐帧 seek。
- 如果后续视频较大，没有 Range，拖动和局部读取体验会差。

### 接口 4：创建分析任务

`POST /api/pose/analysis/tasks`

请求 JSON：

```json
{
  "video_asset_id": 123,
  "exercise_type": "squat",
  "view_angle": "side",
  "instruction": "保持躯干稳定"
}
```

返回：

```json
{
  "task": {
    "id": 1,
    "status": "running"
  }
}
```

说明：

- 因为分析在前端进行，所以任务创建后可以直接置为 `running`。

### 接口 5：任务详情

`GET /api/pose/analysis/tasks/<id>`

返回：

- `task`
- `result`

### 接口 6：回写分析结果

`POST /api/pose/analysis/tasks/<id>/complete`

请求 JSON：

```json
{
  "report": { }
}
```

行为：

- 创建 `AnalysisResult`
- 更新 `AnalysisTask.status = succeeded`
- 写入 `finished_at`

### 接口 7：标记任务失败

`POST /api/pose/analysis/tasks/<id>/fail`

请求 JSON：

```json
{
  "error": "MediaPipe analysis failed"
}
```

行为：

- 更新任务状态为 `failed`
- 存错误信息

### 接口 8：保存实时训练记录

`POST /api/pose/trainings`

请求 JSON：

```json
{
  "started_at": "2026-04-05T12:00:00Z",
  "ended_at": "2026-04-05T12:05:00Z",
  "exercise_type": "squat",
  "sets": [
    { "reps": 12, "weight": null, "note": "live coaching" }
  ],
  "report": { }
}
```

行为：

- 创建 `TrainingSession`
- 创建 `TrainingSet`
- 可选保存 `report_json`

## 5.4 后端必须同步调整的地方

### 1. 放宽上传大小限制

当前 [backend/app/__init__.py](/d:/trae/trae_projects/AI-FIT/backend/app/__init__.py) 默认：

- `MAX_CONTENT_LENGTH = 5 * 1024 * 1024`

必须提高，建议首期至少：

- `80MB`

即：

- `80 * 1024 * 1024`

否则离线分析视频几乎不可用。

### 2. 上传目录分区

建议在现有 `instance/uploads` 下新增：

- `instance/uploads/pose/videos/<user_id>/...`

不要和头像、博客图等混放。

### 3. 视频文件访问策略

建议不要继续直接走 `/uploads/<path>` 暴露所有文件。

更适合：

- 视频类走鉴权接口 `/api/pose/videos/<id>/file`
- 由后端确认当前用户是否拥有该视频

这样权限边界更清晰。

## 六、前端真实落地方案

## 6.1 新目录建议

建议新增：

- `frontend/src/features/pose-live/`
- `frontend/src/features/pose-offline/`
- `frontend/src/lib/pose/`
- `frontend/src/lib/report/`

目标是把迁入代码和普通页面代码隔开。

## 6.2 实时功能迁移方案

### 页面入口

继续使用现有 [frontend/src/pages/PosePage.tsx](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/PosePage.tsx)，但改为双模式页面：

- `实时纠错`
- `离线视频分析`

这样用户只认一个入口，产品上最顺。

### 代码迁移方式

从 `train` 迁以下逻辑：

- `RealtimeSquatAnalyzer`
- `createBestRealtimePoseProvider`
- MoveNet 检测器与关键点格式转换
- 骨架绘制
- 距离提示
- 报告导出

### UI 取舍建议

不要照搬 `train/src/app/live/LiveClient.tsx` 整页 UI。

建议主项目首期页面结构：

左侧：

- 摄像头区
- 骨架叠加

右侧：

- 次数
- 关键角度
- 当前纠错建议
- 导出 JSON
- 导出 PDF
- 可选“保存到历史”

原因：

- 主项目目前 `PosePage` 还是简单工具页，不需要直接带入 `train` 那套完整产品界面复杂度。
- 主项目已经有既定的页面结构、间距、字体、按钮和卡片风格，新功能应以这些现有样式为基础扩展。

### 页面风格要求

`PosePage` 的实现应遵循以下原则：

- 保留主项目现有的 breadcrumb、区块标题、按钮、卡片、栅格和排版风格。
- 新增的实时面板、离线分析面板、进度区、报告区应优先复用主项目已有样式类和组件写法。
- 允许新增少量局部样式来承载视频画面、骨架覆盖层、状态面板，但这些样式应服务于功能，不应把页面整体改造成 `train` 的产品界面。
- 如果从 `train` 迁入交互控件，只迁逻辑，不直接迁其视觉实现。

换句话说，这一页应当表现为“AI-FIT 现有网站中的一个增强工具页”，而不是“嵌进来一个 train 子应用页面”。

## 6.3 离线分析功能迁移方案

### 页面交互建议

离线分析区建议包含：

- 选择/上传视频
- 选择动作类型
- 选择视角
- 输入分析指令
- 开始分析
- 显示进度
- 查看报告
- 保存结果状态

### 真实调用链

1. 前端调用 `POST /api/pose/videos` 上传视频。
2. 前端调用 `POST /api/pose/analysis/tasks` 创建任务。
3. 前端拿到 `video file url` 后，用 `extractPose33FromVideoUrl()` 分析。
4. 前端本地用：
   - `chooseMotionStandard`
   - `buildMotionStandardCompareReport`
   - `buildGenericMotionReport`
5. 成功后 `POST /api/pose/analysis/tasks/<id>/complete`
6. 失败时 `POST /api/pose/analysis/tasks/<id>/fail`

### 为什么不直接上传后就分析

因为任务状态和结果持久化是必要的：

- 便于后续查看历史
- 便于失败重试
- 便于后续升级到后端 worker

即使首期分析发生在浏览器，本地也应该先建任务。

## 七、推荐的代码落地顺序

这是我认为基于当前仓库最快、风险最低的顺序。

### Phase 1：打通实时页

目标：

- `/tools/pose` 可打开摄像头
- 能实时检测深蹲
- 能导出 JSON/PDF

涉及文件：

- `frontend/src/pages/PosePage.tsx`
- 新增 `frontend/src/features/pose-live/**`
- 新增 `frontend/src/lib/pose/**`
- 新增 `frontend/src/lib/report/**`

这个阶段先不碰后端。

### Phase 2：补后端最小模型和接口

目标：

- 数据库能保存视频、分析任务、分析结果、训练记录
- API 可供前端调用

涉及文件：

- `backend/app/models.py`
- `backend/app/routes/pose.py`
- `backend/app/__init__.py`

### Phase 3：打通离线视频分析

目标：

- 用户上传视频
- 浏览器分析
- 回写报告
- 可查询任务结果

涉及文件：

- 新增 `frontend/src/features/pose-offline/**`
- `frontend/src/pages/PosePage.tsx`
- `backend/app/routes/pose.py`

### Phase 4：补实时训练保存

目标：

- 把实时纠错会话保存成训练记录

涉及文件：

- `frontend/src/features/pose-live/**`
- `backend/app/routes/pose.py`

## 八、预计工作量

以“能用、不是精修版”为标准。

### 1. 实时页

预计：

- 1 到 2 天

前提：

- 只保留核心功能
- 不追求完整还原 `train` UI

### 2. 后端最小模型 + API

预计：

- 1 到 2 天

前提：

- 不引入 Alembic
- 不做复杂权限模型
- 不做对象存储

### 3. 离线视频分析

预计：

- 1.5 到 3 天

难点主要在：

- 浏览器端进度管理
- 大视频体验
- 失败回写处理

### 总体

首个可演示版本：

- 4 到 7 天

如果范围收紧到“只支持深蹲、只支持 MP4、只做中文简单报告”，会更快。

## 九、已知风险与规避

### 1. 浏览器算力和兼容性

风险：

- 前端跑 MediaPipe 和 MoveNet 时，低配设备会卡。

规避：

- 首期明确支持桌面 Chrome 优先。
- 离线分析限制视频大小与时长。
- 实时页限制检测帧率，不追求满帧。

### 2. 视频上传过大

风险：

- 当前 Flask 默认 5MB 上限会直接阻塞功能。

规避：

- 首批代码先把上传上限提高到 80MB。
- 前端上传前做大小校验。

### 3. 没有正式迁移体系

风险：

- 现在后端用 `db.create_all()`，后面改表会变麻烦。

规避：

- 本阶段先接受。
- 但在本功能上线后尽快补 Alembic。

### 4. 报告 schema 后续变化

风险：

- 前端生成的 `report` 结构未来可能变。

规避：

- 后端只按 JSON 存。
- 在 `report` 顶层保留 `version` 字段。

### 5. 训练动作范围扩展

风险：

- 当前算法明显偏深蹲，不适合假装支持全部动作。

规避：

- UI 和接口首期明确只支持 `squat`。
- 其他动作值先不开放。

## 十、我建议的首期交付边界

如果要最快落地，我建议严格控制为以下版本：

### 首期必须有

- `PosePage` 实时深蹲纠错
- 本地导出 JSON
- 本地导出 PDF
- 上传 MP4 视频
- 创建离线分析任务
- 浏览器端跑离线分析
- 报告回写后端
- 后端保存训练记录

### 首期不要做

- 多动作支持
- train 全量页面迁入
- 独立 train 服务
- 后端 worker 分析
- 隐私/导出/设置全套
- 视频自动清理策略
- 对象存储

## 十一、建议的实际实施清单

建议按下面顺序开工：

1. 迁 `train` 的前端姿态算法到 `frontend/src/lib/pose`
2. 重写 `PosePage.tsx` 为“实时/离线”双模式页
3. 新增 Flask `pose.py` 蓝图
4. 在 `models.py` 中补 5 组表
5. 把上传限制提高到 80MB
6. 先打通“上传视频 -> 创建任务 -> 前端分析 -> 回写结果”
7. 最后补“实时会话保存到训练记录”

## 十二、最终建议

对于你当前要的两个功能，最合理的策略不是“服务化接入 train”，而是“直接抽取 train 的前端算法能力并落到主项目”。

这是因为你要的核心不是 `train` 这套 Next 应用，而是：

- 实时姿态检测与纠错
- 离线视频分析与报告

这两部分刚好都是 `train` 里最适合拆出来复用的能力层。

如果按这份方案执行，后续你们仍然可以继续往前走：

- 把训练历史做完整
- 把动作类型扩展到更多动作
- 把前端分析迁到后端 worker

但第一步不需要背上 `train` 全量系统的负担。
