# Train 与 AI-FIT 全量功能比对报告

日期：2026-04-05

## 一、目的

本报告用于回答两个问题：

1. `train` 当前到底包含哪些功能。
2. 这些功能中，哪些已经迁移到当前 `AI-FIT`，哪些只是部分迁移，哪些还没有迁移。

注意：
- 本报告关注的是“`train` 的功能与 `AI-FIT` 当前状态的对照”。
- `AI-FIT` 本身还包含博客、课程、营养分析、用户中心等原生功能，这些不属于从 `train` 迁移而来，但会在文末单独说明，避免混淆。

## 二、总体结论

当前可以下结论：

- `train` 的核心价值功能主要集中在“训练记录 + 实时姿态纠错 + 离线视频分析 + 历史与隐私管理”。
- 其中真正已经迁入 `AI-FIT` 的，主要是 `pose` 相关核心能力：
  - 实时姿态纠错
  - 离线视频分析
  - 最小视频/任务/报告/训练记录后端闭环
- 但如果从 `train` 的全量产品功能看，当前 `AI-FIT` 还没有完整迁完，尤其缺少：
  - 训练历史完整链路
  - 分析历史 / 任务管理链路
  - 训练会话管理链路
  - 隐私与数据导出能力
  - 仪表盘、挑战、设置等产品外围能力

一句话判断：
- `AI-FIT` 已迁入 `train` 的“姿态核心能力”
- `AI-FIT` 尚未迁入 `train` 的“完整训练产品体系”

## 三、train 功能全景

结合 `train/src/app` 页面结构、导航、API 与页面实现，`train` 当前功能可以拆成以下模块：

### 1. 账号与会话

`train` 包含：
- 注册
- 登录
- 登出
- 会话获取

证据：
- 页面目录：`/login`、`/register`
- API：`/api/v1/auth/login`、`/api/v1/auth/register`、`/api/v1/auth/logout`、`/api/v1/auth/session`

### 2. 训练主链路

`train` 包含：
- 开始训练会话
- 读取当前活动训练
- 编辑训练 sets
- 完成训练会话
- 保存训练报告
- 从训练会话跳到实时纠错或分析

证据：
- 页面：`/train`
- API：`/api/v1/private/trainings`、`/api/v1/private/trainings/active`、`/api/v1/private/trainings/[id]`、`/api/v1/private/trainings/[id]/complete`

### 3. 实时姿态纠错

`train` 包含：
- 摄像头实时姿态检测
- 次数统计
- Range Check
- Coaching Tip
- JSON/PDF 导出
- 保存到历史
- 查看已保存报告

证据：
- 页面：`/live`
- 实现：`train/src/app/live/LiveClient.tsx`

### 4. 离线视频分析

`train` 包含：
- 上传或选择视频
- 创建分析任务
- 任务详情查看
- 浏览器端分析
- complete / retry / delete
- 报告查看
- 分析历史

证据：
- 页面：`/analysis`、`/analysis/[id]`、`/analysis/history`
- API：`/api/v1/private/analysis/jobs`、`/api/v1/private/analysis/jobs/[id]`、`/api/v1/private/analysis/jobs/[id]/complete`、`/api/v1/private/analysis/jobs/[id]/retry`

### 5. 视频资产管理

`train` 包含：
- 视频上传
- 视频列表
- 视频文件读取

证据：
- API：`/api/v1/private/videos`、`/api/v1/private/videos/[id]/file`

### 6. 训练历史

`train` 包含：
- 历史日历页
- 按日期查看训练记录
- 查看训练详情 / 报告
- 删除训练记录
- 历史统计占位

证据：
- 页面：`/history`
- API：`/api/v1/private/trainings`、`/api/v1/private/trainings/[id]`

### 7. 动作与分类

`train` 包含：
- 动作列表
- 动作分类
- 自定义动作 / 分类管理相关 API

证据：
- 页面：`/exercises`
- API：`/api/v1/private/exercises`、`/api/v1/private/exercise-categories`、`/api/v1/private/exercise-categories/[id]`

### 8. 仪表盘

`train` 包含：
- 训练汇总
- 分析汇总
- 当前状态
- 快捷入口

证据：
- 页面：`/dashboard`

### 9. 挑战

`train` 包含：
- Challenge 页面
- Active / Past 标签页
- 新建挑战占位入口

说明：
- 该模块当前更偏“占位页 / 规划中功能”，不属于成熟主功能。

### 10. 设置与相机偏好

`train` 包含：
- 账户设置页
- camera mirror / zoom / viewport width 偏好
- 登出

证据：
- 页面：`/settings`
- API：`/api/v1/private/camera/settings`

### 11. 隐私与数据

`train` 包含：
- 是否保存原始视频
- 视频 TTL
- 数据导出 JSON / CSV
- 清空训练数据
- 清空分析数据

证据：
- 页面：`/privacy`
- API：`/api/v1/private/privacy/settings`、`/api/v1/private/privacy/export`

## 四、AI-FIT 当前已具备的对应能力

当前 `AI-FIT` 中，与 `train` 对应的能力主要来自两部分：

### A. 已从 train 迁入或对齐的能力

- `/tools/pose` 统一姿态入口
- 实时姿态纠错
- 离线视频分析
- 视频上传 / 列表 / 文件读取
- 分析任务创建 / 查询 / complete / fail
- 训练记录写入 `training_sessions` / `training_sets`

证据：
- 前端：[`frontend/src/pages/PoseToolPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/PoseToolPage.tsx#L1)
- 后端：[`backend/app/routes/pose.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/pose.py#L79)
- 模型：[`backend/app/models.py`](/d:/trae/trae_projects/AI-FIT/backend/app/models.py#L250)

### B. AI-FIT 原生已有，但不属于 train 迁移的能力

- 用户系统
- 个人资料页
- 博客与评论
- 课程与报名
- 饮食 / 训练记录
- 营养分析
- 反馈

证据：
- 前端路由：[`frontend/src/App.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/App.tsx#L24)
- 后端路由：`auth.py`、`user.py`、`blogs.py`、`comments.py`、`courses.py`、`course_comments.py`、`workouts.py`、`diets.py`、`nutrition.py`、`feedback.py`

## 五、全量比对矩阵

### 1. 账号与认证

`train`：
- 登录 / 注册 / 登出 / session

`AI-FIT` 当前状态：
- 已具备等价能力
- 但实现机制不同：`train` 偏 session/cookie 体系，`AI-FIT` 使用 JWT

结论：
- `功能等价`
- `不属于此次 pose 迁移重点`

### 2. 训练主链路（Training Session）

`train`：
- 创建训练会话
- 活动训练检测
- 编辑训练 sets
- 完成训练
- 训练会话详情

`AI-FIT` 当前状态：
- 只有 `POST /api/pose/trainings` 这种“完成后一次性写入训练记录”的能力
- 没有训练中的 session 生命周期管理
- 没有 active session
- 没有 `/train` 等价页面

结论：
- `未迁移`
- `只迁了最终落库，不是 train 的完整训练链路`

### 3. 实时姿态纠错

`train`：
- 实时检测、计数、提示、导出、保存到历史

`AI-FIT` 当前状态：
- 已迁移核心能力
- 页面入口统一到 `/tools/pose`
- 可以保存训练记录

缺口：
- 没有“保存后查看历史/报告”后续链路
- 没有 camera settings 持久化

结论：
- `核心能力已迁移`
- `产品级收口未完成`

### 4. 离线视频分析

`train`：
- 创建分析任务
- 查看任务详情
- complete / retry / delete
- 分析历史

`AI-FIT` 当前状态：
- 已实现上传视频、创建任务、前端分析、complete / fail 回写
- 可展示报告并导出 JSON/PDF

缺口：
- 没有任务列表页 / 分析历史页
- 没有 retry
- 没有 delete
- 没有独立的任务详情路由

结论：
- `核心能力已迁移`
- `任务管理能力未迁移`

### 5. 视频资产管理

`train`：
- 视频上传
- 视频列表
- 视频文件读取

`AI-FIT` 当前状态：
- 已实现 `POST /api/pose/videos`
- 已实现 `GET /api/pose/videos`
- 已实现 `GET /api/pose/videos/<id>/file`

结论：
- `已迁移`

### 6. 训练历史

`train`：
- 历史页
- 日期维度查看
- 会话详情
- 删除记录

`AI-FIT` 当前状态：
- 只有写入 `training_sessions` / `training_sets`
- 没有历史列表 API
- 没有详情 API
- 没有历史页

结论：
- `未迁移`

### 7. 分析历史 / 任务管理

`train`：
- 分析任务列表
- 单任务详情
- retry / delete

`AI-FIT` 当前状态：
- 只有创建单任务、获取单任务、complete / fail
- 没有任务列表
- 没有任务历史
- 没有 retry / delete

结论：
- `部分迁移`

### 8. 动作与分类管理

`train`：
- exercises
- exercise categories
- custom exercise API

`AI-FIT` 当前状态：
- 当前 pose 流程基本写死围绕 `squat`
- 没有 train 那套动作 / 分类体系

结论：
- `未迁移`

### 9. 仪表盘

`train`：
- dashboard 汇总训练 / 分析状态

`AI-FIT` 当前状态：
- 无对应 dashboard

结论：
- `未迁移`

### 10. Challenge

`train`：
- 有占位页与导航入口

`AI-FIT` 当前状态：
- 无对应模块

结论：
- `未迁移`
- `但该模块本身在 train 中也不是成熟核心功能`

### 11. 设置与相机偏好

`train`：
- 独立 settings 页
- camera mirror / zoom / viewport width 持久化

`AI-FIT` 当前状态：
- 实时页里有 Mirror / Size / Zoom 类控制
- 但没有独立 settings 页面
- 没有相机偏好持久化接口
- 当前控制主要停留在页面内状态

结论：
- `部分迁移`
- `只迁了界面能力，未迁持久化与设置页`

### 12. 隐私与数据导出

`train`：
- 隐私设置
- 保存原视频开关
- TTL
- JSON/CSV 导出
- 删除全部训练 / 分析数据

`AI-FIT` 当前状态：
- 没有对应页面
- 没有对应接口
- 当前后端视频是直接存本地磁盘

结论：
- `未迁移`

### 13. 统一报告归档层

`train`：
- 统一报告规范化
- 错误统计
- 时间线采样
- 结构化 PDF

`AI-FIT` 当前状态：
- 已能生成报告并导出
- 但 `frontend/src/lib/report/unified.ts` 仍是最小占位实现

结论：
- `部分迁移`

## 六、迁移状态总表

### 已迁移

- pose 实时纠错核心能力
- pose 离线视频分析核心能力
- pose 视频上传 / 视频列表 / 视频文件访问
- pose 分析任务最小闭环
- pose 训练记录最终落库

### 部分迁移

- 实时页产品收口
- 离线分析任务管理
- 报告统一归档层
- 设置中的相机能力

### 未迁移

- 训练主链路（active session / update / complete）
- 训练历史页
- 分析历史页
- 任务 retry / delete / 列表
- exercises / categories 体系
- dashboard
- privacy / export / TTL
- challenge

## 七、AI-FIT 原生已有但不属于 train 迁移的能力

这部分需要单独强调，否则会误判“AI-FIT 功能更多，所以 train 已迁完”。

AI-FIT 当前原生已有：
- 博客
- 博客评论与点赞
- 课程列表 / 详情 / 报名 / 课程评论
- 用户资料与头像上传
- workout 记录
- diet 记录
- 营养分析
- 反馈系统

这些功能说明：
- `AI-FIT` 不是 `train` 的子集
- `AI-FIT` 是一个更广义的网站型产品
- 当前迁移工作只是在这个主站里接入 `train` 的姿态训练能力，而不是把 `train` 整体搬过来

## 八、最终判断

如果比较对象是 `train` 的“所有功能”与 `AI-FIT` 当前状态，那么现在的真实状态是：

- `train` 的核心姿态能力已经迁入 AI-FIT
- `train` 的完整训练产品体系还没有迁完

更精确地说：
- 已完成的是 `pose capability migration`
- 未完成的是 `training product migration`

## 九、建议的后续优先级

建议按下面顺序继续推进，性价比最高：

1. 先补“姿态训练历史”查询与查看链路。
2. 再补“分析任务列表 / 历史 / retry”。
3. 再把 `frontend/src/lib/report/unified.ts` 替换为 `train` 的真实统一归档实现。
4. 最后再决定是否继续迁移设置、隐私、dashboard、exercise 分类体系。

## 十、结论一句话版

当前 `AI-FIT` 不是“已经迁完 train”，而是“已经把 train 中最重要的 pose 核心能力迁进来了，但训练历史、任务管理、隐私设置、仪表盘等外围产品能力还没有完整迁入”。
