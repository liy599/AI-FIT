# AI-FIT 项目状态

本文档用于记录当前 `AI-FIT` 主仓库的真实状态，尤其是：
- 主站原生功能范围
- `train` -> `AI-FIT` 的迁移进度
- 当前 pose 能力的完成度
- 已知缺口与后续优先级

相关详细报告：
- [`POSE_MIGRATION_AUDIT_2026-04-05.md`](/d:/trae/trae_projects/AI-FIT/info/POSE_MIGRATION_AUDIT_2026-04-05.md)
- [`TRAIN_AI-FIT_全量功能比对报告_2026-04-05.md`](/d:/trae/trae_projects/AI-FIT/info/TRAIN_AI-FIT_全量功能比对报告_2026-04-05.md)
- [`POSE_MIGRATION_LOG.md`](/d:/trae/trae_projects/AI-FIT/info/POSE_MIGRATION_LOG.md)

## 一、技术栈

- 后端：Flask + SQLAlchemy + Flask-JWT-Extended
- 前端：React + TypeScript + Vite + React Router
- 数据库：PostgreSQL

关键入口：
- 后端开发入口：`backend/run.py`
- 后端部署入口：`backend/wsgi.py`
- 前端入口：`frontend/src/main.tsx`
- 前端路由：`frontend/src/App.tsx`

## 二、AI-FIT 主站原生已有功能

以下能力属于 `AI-FIT` 主站原生已有，不是从 `train` 迁入：

### 账号与认证

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

说明：
- 前端使用 JWT，本地保存 token / user，并通过 `Authorization: Bearer <token>` 调用接口。
- 当前 `logout` 是客户端清 token 语义，后端未做 token 黑名单或刷新机制。

### 用户中心

- `GET /api/user/profile`
- `PUT /api/user/profile`
- `POST /api/user/avatar`
- `GET /api/user/blogs`
- `GET /api/user/comments`

### 博客与评论

- 博客列表 / 详情 / 创建 / 修改 / 删除
- 博客封面上传
- 博客点赞
- 评论列表 / 发表评论 / 回复 / 编辑 / 删除 / 点赞

### 课程与课程评论

- 课程列表
- 课程详情
- 课程报名
- 课程评论列表 / 发布 / 编辑 / 删除 / 点赞

### 训练与饮食记录

- `GET/POST /api/workouts`
- `GET/POST /api/diets`

### 营养分析

- `POST /api/nutrition/analyze`

### 反馈

- `GET /api/feedback`
- `POST /api/feedback`

## 三、train 迁移相关结论

### 总体判断

当前状态不是“已经把 `train` 全量迁完”，而是：

- 已经把 `train` 中最关键的 `pose` 核心能力迁入 `AI-FIT`
- 还没有把 `train` 的完整训练产品体系迁完

更准确地说：
- 已迁入：`pose capability`
- 未迁完：`training product system`

## 四、pose 迁移当前状态

### 已完成的核心能力

#### 后端最小闭环已落地

已实现接口：
- `POST /api/pose/videos`
- `GET /api/pose/videos`
- `GET /api/pose/videos/<id>/file`
- `POST /api/pose/analysis/tasks`
- `GET /api/pose/analysis/tasks/<id>`
- `POST /api/pose/analysis/tasks/<id>/complete`
- `POST /api/pose/analysis/tasks/<id>/fail`
- `POST /api/pose/trainings`

已落地模型：
- `video_assets`
- `analysis_tasks`
- `analysis_results`
- `training_sessions`
- `training_sets`

同时已完成：
- 上传上限提升到 `80MB`
- 视频按用户目录存储
- 受保护的视频文件访问

#### 前端统一姿态入口已落地

当前统一入口：
- 页面：`/tools/pose`
- 组件：`frontend/src/pages/PoseToolPage.tsx`

#### 实时模式已打通

已具备：
- 摄像头启动 / 停止
- MoveNet 实时检测
- 骨架叠加
- 次数 / 角度 / 提示展示
- JSON / PDF 导出
- 保存训练记录到 `/api/pose/trainings`

#### 离线模式已打通

已具备：
- 上传视频
- 创建分析任务
- 浏览器端 MediaPipe 提取关键点
- 标准模板比对或通用分析
- complete / fail 回写
- 报告展示
- JSON / PDF 导出

#### 测试与校验状态

已确认：
- `frontend`：`npm.cmd run typecheck` 可通过
- `backend`：`tests/test_pose.py` 可通过

## 五、pose 迁移尚未完成的部分

### 1. 训练历史链路未迁完

当前已有：
- 训练记录可以写入 `training_sessions` / `training_sets`

当前缺失：
- `GET /api/pose/trainings`
- 训练详情接口
- 姿态训练历史页面
- “查看已保存报告”入口

这意味着：
- 当前已完成“保存训练记录”
- 但还没有完成“使用训练历史”

### 2. 分析任务管理未迁完

当前已有：
- 创建任务
- 获取单任务
- complete / fail

当前缺失：
- 任务列表
- 分析历史页
- retry
- delete
- 独立任务详情链路

### 3. 统一报告归档层未真正迁完

当前已有：
- 报告生成
- JSON / PDF 导出
- 报告写入数据库

当前问题：
- `frontend/src/lib/report/unified.ts` 仍是最小占位实现
- 尚未迁入 `train` 中真正的统一归档与规范化逻辑

### 4. 实时页源码未完全收口

当前问题：
- `PoseToolPage.tsx` 中仍有历史中文 / 旧字符串残留
- `styles.css` 中仍存在通过 `font-size: 0`、`::after`、`display: none` 做文案替换或结构兜底的情况

这意味着：
- 页面表面效果已基本可用
- 但源码质量仍处于过渡态

## 六、train 全量功能与 AI-FIT 当前对比

### 已迁移

- pose 实时纠错核心能力
- pose 离线视频分析核心能力
- pose 视频资产上传 / 列表 / 文件读取
- pose 分析任务最小闭环
- pose 训练记录最终落库

### 部分迁移

- 实时页产品收口
- 离线分析任务管理
- 统一报告归档层
- 相机设置类能力

### 未迁移

- `train` 训练主链路：active session / update / complete
- 训练历史页
- 分析历史页
- retry / delete / 任务列表
- exercise / category 管理体系
- dashboard
- privacy / export / TTL
- challenge
- settings 独立设置页与相机偏好持久化

## 七、当前真实状态一句话

当前 `AI-FIT` 的真实状态不是“已迁完 `train`”，而是：

`已经把 train 中最重要的 pose 核心能力迁进来了，但训练历史、任务管理、统一报告层以及外围训练产品功能还没有完整迁入。`

## 八、后续优先级

建议按以下顺序继续推进：

1. 补齐姿态训练历史查询、详情和查看入口。
2. 补齐分析任务列表 / 历史 / retry。
3. 将 `frontend/src/lib/report/unified.ts` 替换为 `train` 的真实统一归档实现。
4. 清理 `PoseToolPage.tsx` 与 `styles.css` 中的历史字符串和 CSS 覆盖兜底。
5. 再评估是否继续迁移 settings、privacy、dashboard、exercise/category 等外围能力。

## 九、已知工程限制

- 认证仍是 JWT 本地存储模式，没有 token 失效黑名单 / refresh token 体系。
- 数据库目前仍依赖 `db.create_all()`，尚未引入正式迁移工具。
- 构建层面曾受本机 `vite/esbuild spawn EPERM` 环境问题影响，这不是纯代码逻辑问题。

## 十、快速索引

关键文件：
- 前端姿态页：`frontend/src/pages/PoseToolPage.tsx`
- 前端样式：`frontend/src/styles.css`
- pose API 封装：`frontend/src/lib/poseApi.ts`
- 报告打印：`frontend/src/lib/report/print.ts`
- pose 后端路由：`backend/app/routes/pose.py`
- pose 数据模型：`backend/app/models.py`

关键文档：
- [`POSE_MIGRATION_AUDIT_2026-04-05.md`](/d:/trae/trae_projects/AI-FIT/info/POSE_MIGRATION_AUDIT_2026-04-05.md)
- [`TRAIN_AI-FIT_全量功能比对报告_2026-04-05.md`](/d:/trae/trae_projects/AI-FIT/info/TRAIN_AI-FIT_全量功能比对报告_2026-04-05.md)
- [`POSE_MIGRATION_LOG.md`](/d:/trae/trae_projects/AI-FIT/info/POSE_MIGRATION_LOG.md)
