# Pose Migration Log

## 2026-04-05 Step 8

目标：
- 补记上一次未写入日志的实时页对齐改动
- 修正 `Coaching Tip` 在未启动摄像头时仍显示中文的问题

本步完成：
- 补记上一轮实时页对齐项：
  - 实时工具栏补入 `Mirror`
  - 实时工具栏补入 `Size`
  - 实时画面改为按容器填充
  - 新增 `Range Check`
  - 调整 `Range Check` 到 `Coaching Tip` 之前
- 修正实时页默认建议文案
  - 未启动摄像头时，`Coaching Tip` 默认文案改为英文
  - 保存训练记录时写入的提示文案也同步改为英文版本

本步验证：
- 已执行：`frontend` 下的 `npm.cmd run typecheck`
  - 通过

## 2026-04-05 Step 9

目标：
- 排查训练记录保存落点
- 修复 `Export PDF` 打开空白页的问题
- 提高横屏 / 竖屏切换的可感知度

本步完成：
- 确认实时训练记录保存路径
  - 前端通过 `POST /api/pose/trainings` 提交
  - 后端写入 `training_sessions` 与 `training_sets`
  - 会话级报告写入 `training_sessions.report_json`
- 调整浏览器打印页打开方式
  - 从直接 `document.write + 很短延时 print`
  - 改为基于 `Blob URL` 打开独立打印页，并在页面 `load` 后再触发打印
  - 目的是避免新窗口尚未完成渲染时出现空白页
- 调整实时摄像头横竖屏容器比例
  - 横屏改为更明确的 `16:9`
  - 竖屏改为更明确的 `9:16`
  - 同时分别设置不同的最小 / 最大高度，使切换效果更明显

本步验证：
- 已执行：`frontend` 下的 `npm.cmd run typecheck`
  - 通过

## 2026-04-05 Step 10

目标：
- 修正 `Size` 按钮导致实时预览区过窄、观感难看的问题

本步完成：
- 调整实时预览区尺寸策略
  - 不再把 `S / M / L` 直接映射为过小的固定像素宽度
  - 改为相对温和的百分比档位
    - `S` -> `78%`
    - `M` -> `86%`
    - `L` -> `93%`
    - `XL` -> `100%`
- 调整实时预览区布局
  - 预览容器改为在卡片内水平居中
  - 避免切到小尺寸后预览贴左、右侧留出大块空白造成版面失衡

本步验证：
- 已执行：`frontend` 下的 `npm.cmd run typecheck`
  - 通过

## 2026-04-05 Step 1

目标：

- 建立迁移日志
- 开始第一阶段迁移：主项目前端 `PosePage` 实时纠错首版
- 本步只处理前端实时功能，不处理后端模型、接口和离线视频分析

本步范围：

- 在 `frontend/` 迁入实时姿态分析所需的前端工具代码
- 保持主项目现有页面风格基础，重构 `PosePage`
- 支持摄像头实时检测、骨架叠加、角度提示、纠错建议、本地 JSON/PDF 导出

涉及文件：

- `frontend/package.json`
- `frontend/src/pages/PosePage.tsx`
- `frontend/src/styles.css`
- `frontend/src/lib/pose/*`
- `frontend/src/lib/report/*`

说明：

- 本步不修改后端
- 本步不新增数据库表
- 本步不打通离线视频分析
- 本步不执行依赖安装；如要本地运行，需要在 `frontend/` 下安装新增依赖

实际完成：

- 新增 `frontend/src/lib/pose/` 下的实时姿态工具文件
- 新增 `frontend/src/lib/report/` 下的本地报告导出工具文件
- 新增 `frontend/src/pages/PoseRealtimePage.tsx` 作为实时纠错首版页面
- 修改 `frontend/src/App.tsx`，将 `/tools/pose` 路由切到新页面
- 修改 `frontend/src/styles.css`，补充姿态页局部样式
- 修改 `frontend/src/pages/PosePage.tsx`，将其转为对新页面的兼容转发，避免旧文件语法问题影响编译
- 修改 `frontend/package.json`，声明 MoveNet / TensorFlow 前端依赖

当前效果：

- 已完成第一阶段的前端实时页迁移首版
- 页面风格保持主项目现有 breadcrumb、卡片、区块布局风格
- 功能包含：
  - 摄像头启动/停止
  - 实时骨架叠加
  - 深蹲次数与关键角度展示
  - 实时纠错建议
  - 本地 JSON 导出
  - 本地 PDF 导出

自查结果：

- 已执行 `frontend` 下的 `npm.cmd run typecheck`
- 当前失败原因不是页面代码语法错误，而是缺少新依赖包：
  - `@tensorflow/tfjs-core`
  - `@tensorflow/tfjs-converter`
  - `@tensorflow/tfjs-backend-webgl`
  - `@tensorflow-models/pose-detection`

下一步前置条件：

- 需要在 `frontend/` 安装新增依赖后，再继续做运行验证和细节修正

## 2026-04-05 Step 1.1

目标：

- 检查 `README.md` 与自动初始化脚本是否需要为新前端依赖做调整

结论：

- 需要调整

原因：

- 旧版 `scripts/dev.ps1` 只有在 `frontend/node_modules` 不存在时才会执行 `npm.cmd install`
- 这会导致仓库新增前端依赖后，已有开发环境不会自动补装新包
- 本次新增的姿态识别依赖就会触发这个问题

已完成修改：

- 修改 `scripts/dev.ps1`
  - 现在每次启动都会执行一次 `frontend` 下的 `npm.cmd install`
  - 这样可以保证新增依赖会被自动补装

待同步说明：

- `README.md` 需要补一句：当前端新增依赖时，重新执行 `npm.cmd install` 或直接运行 `scripts/dev.ps1`

## 2026-04-05 Step 2

目标：

- 安装并验证前端新增依赖
- 确认实时页在当前代码状态下可通过类型检查与生产构建

执行过程：

- 首次在沙箱内执行 `npm.cmd install` 失败
  - 原因：npm 命中 `only-if-cached` 缓存限制，无法联网拉取新包
- 随后使用放开限制方式执行 `npm.cmd install`
  - 成功安装新增前端依赖
  - `frontend/package-lock.json` 已更新
- 执行 `npm.cmd run typecheck`
  - 通过
- 首次执行 `npm.cmd run build`
  - 在沙箱内因 `esbuild` 子进程启动受限失败
- 随后使用放开限制方式执行 `npm.cmd run build`
  - 成功

本步结论：

- 实时页当前代码已经通过前端类型检查
- 实时页当前代码已经通过前端生产构建
- 前端依赖链已经补齐，后续可以继续进入后端最小模型与接口步骤

当前已确认的附加事项：

- 构建输出出现大 chunk 警告
  - `pose-detection` 与 TensorFlow 相关包显著增大前端产物体积
  - 这不是阻塞问题，但后续建议做按路由或按功能动态加载

后续建议：

- 下一步进入后端最小数据模型与接口
- 后续在前端再补一轮优化：
  - 实时页懒加载 MoveNet/TensorFlow
  - 降低首屏 bundle 体积

## 2026-04-05 Step 3

目标：

- 在 Flask 后端补齐 pose 相关最小数据模型与接口
- 打通后端最小闭环，为后续离线视频分析与实时训练保存做准备

本步已完成模型：

- `video_assets`
- `analysis_tasks`
- `analysis_results`
- `training_sessions`
- `training_sets`

涉及文件：

- `backend/app/models.py`
- `backend/app/routes/pose.py`
- `backend/app/__init__.py`

本步已完成接口：

- `GET /api/pose/videos`
- `POST /api/pose/videos`
- `GET /api/pose/videos/<id>/file`
- `POST /api/pose/analysis/tasks`
- `GET /api/pose/analysis/tasks/<id>`
- `POST /api/pose/analysis/tasks/<id>/complete`
- `POST /api/pose/analysis/tasks/<id>/fail`
- `POST /api/pose/trainings`

本步同时完成：

- 注册新蓝图 `/api/pose`
- 将全局上传大小上限从 `5MB` 提高到 `80MB`
- 将 413 错误提示同步更新为 `max 80MB`

实现取舍：

- 视频先存本地磁盘
- 视频访问先使用 `send_file(..., conditional=True)`，支持基础 Range/条件响应能力
- 分析结果先直接存 JSON
- 不引入 worker，不做后端推理

验证结果：

- 已验证 Flask 应用可正常导入并创建
- 已验证新路由成功注册
- 已执行现有认证测试：
  - `backend/.venv/Scripts/python.exe -m pytest tests/test_auth.py -q`
  - 结果：`2 passed`

当前状态：

- 前端实时页已可构建
- 后端最小数据模型与核心接口已落地
- 下一步可以开始把前端离线视频分析接到这些新接口上

当前未覆盖：

- 尚未为 `pose.py` 新增专门的 API 测试
- 尚未从前端实际串联“上传视频 -> 创建任务 -> 本地分析 -> 回写结果”
- 尚未把实时页的“保存训练记录”按钮接到 `/api/pose/trainings`
## 2026-04-05 Step 4

目标：
- 继续承接 Step 3 的前端串联
- 把姿态页改成“实时纠错 / 离线视频分析”双模式入口
- 接通“视频上传 -> 创建任务 -> 浏览器侧分析 -> 回写结果”
- 把实时页“保存训练记录”按钮接到 `/api/pose/trainings`

本步完成：
- 新增 `frontend/src/lib/poseApi.ts`
  - 基于现有 `api.ts` 补了 pose 相关前端封装
  - 包含视频上传、任务创建、任务完成/失败回写、训练记录保存、视频文件 blob 拉取
- 扩展 `frontend/src/lib/api.ts`
  - 新增 `apiFetchBlob()`
  - 解决离线分析场景下 HTMLVideoElement 不能直接带 `Authorization` 头的问题
- 在 `frontend/src/lib/pose/` 补齐离线分析所需能力层
  - `mediapipePose.ts`
  - `poseMetrics.ts`
  - `poseFrame.ts`
  - `poseMetricTracker.ts`
  - `motionCompare.ts`
  - `motionStandards.ts`
  - `analysisSelector.ts`
  - `genericMotion.ts`
  - `report.ts`
  - `motionStandardCompareReport.ts`
- 新增 `frontend/src/pages/PoseToolPage.tsx`
  - 作为当前姿态工具正式页面
  - 保持主站 breadcrumb / 卡片 / 工具页布局风格
  - 页内切换两种模式：
    - 实时纠错
    - 离线视频分析
- 实时模式新增：
  - “保存训练记录”按钮
  - 调用 `/api/pose/trainings`
  - 使用当前实时统计结果生成单条 `sets` 并连同 report 一起保存
  - 未登录 / 无有效 reps 时给出前端提示
- 离线模式打通：
  - 选择视频文件
  - 选择视角
  - 输入分析说明
  - 上传视频到 `/api/pose/videos`
  - 创建任务到 `/api/pose/analysis/tasks`
  - 以 blob URL 方式加载受保护视频文件
  - 浏览器侧运行 MediaPipe 抽帧提取
  - 根据视角选择标准模板或通用分析
  - 成功后调用 `/api/pose/analysis/tasks/<id>/complete`
  - 失败时调用 `/api/pose/analysis/tasks/<id>/fail`
  - 页面内展示任务快照、进度、摘要、指标、问题、建议和时间线
  - 支持离线报告 JSON / PDF 导出
- 更新路由：
  - `/tools/pose` 现在指向 `PoseToolPage`
  - `PosePage.tsx` 同步转发到新页面，兼容旧引用
- 更新样式：
  - 在 `frontend/src/styles.css` 增补双模式切换、表单、进度卡、报告展示等局部样式
- 更新前端依赖：
  - `frontend/package.json`
  - 新增 `@mediapipe/tasks-vision`
  - `frontend/package-lock.json` 已同步更新

本步验证：
- 已执行 `frontend` 下的 `npm.cmd install`
  - 补齐 `@mediapipe/tasks-vision`
- 已执行 `npm.cmd run typecheck`
  - 通过
- 已执行 `npm.cmd run build`
  - 通过
  - 仍有大 chunk 警告，主要来自 TensorFlow / MediaPipe / pose-detection 相关依赖

当前状态：
- 姿态页前端已完成两条闭环
  - 实时纠错 -> 保存训练记录
  - 离线上传 -> 分析 -> 回写
- 当前可以进入下一步细化
  - 真实接口联调与手工冒烟
  - 后端 pose API 专项测试
  - 前端按路由或按模式进一步做动态拆包，降低首屏 bundle 体积

## 2026-04-05 Step 5

目标：
- 补齐后端 `pose` 新接口的专项测试
- 验证这次新增的数据流闭环在 Flask 侧稳定可用

本步完成：
- 新增 `backend/tests/test_pose.py`
- 覆盖接口：
  - `POST /api/pose/videos`
  - `GET /api/pose/videos`
  - `GET /api/pose/videos/<id>/file`
  - `POST /api/pose/analysis/tasks`
  - `POST /api/pose/analysis/tasks/<id>/complete`
  - `GET /api/pose/analysis/tasks/<id>`
  - `POST /api/pose/analysis/tasks/<id>/fail`
  - `POST /api/pose/trainings`
- 覆盖场景：
  - 视频上传、列表查询、文件读取
  - 分析任务创建与成功回写
  - 分析任务失败回写
  - 实时训练记录保存

本步验证：
- 已执行：
  - `backend/.venv/Scripts/python.exe -m pytest tests/test_pose.py -q`
- 结果：
  - `4 passed`

当前状态：
- 前端实时与离线串联代码已落地
- 后端 pose 新接口已有专项测试覆盖
- 下一步更适合进入：
  - 浏览器端真实联调和冒烟
  - 前端首屏/模型包体积优化

## 2026-04-05 Step 6

目标：
- 优化实时摄像头预览的桌面端体验
- 修正预览框过高、人物显示过近的问题
- 修正实时页局部白底白字可读性问题

本步完成：
- 调整实时摄像头请求参数
  - 从偏竖屏的 `720x1280` 调整为更适合桌面摄像头的 `1280x720`
- 调整实时预览容器
  - 将预览区从更长的竖向比例收为更适合桌面预览的 `4:3`
  - 同时下调最小高度，避免工具页左侧预览框过长
- 新增实时预览横竖屏切换
  - 支持在实时摄像头区域手动切换“横屏 / 竖屏”
  - 通过不同预览比例适配不同站位和拍摄空间
- 新增实时预览缩放控制
  - 在实时摄像头区域增加“画面缩放”滑杆
  - 支持前端侧控制画面远近，方便用户把全身放进画面
- 修正缩放控制不生效问题
  - 原因是实时检测循环闭包捕获了旧的 `previewScale`
  - 改为使用 `previewScaleRef`，保证滑杆拖动后实时渲染立即生效
- 优化实时画面绘制策略
  - 继续使用 canvas 合成预览
  - 以居中缩放方式绘制摄像头画面，而不是简单铺满裁切
- 修正实时页白底白字问题
  - 实时卡片副标题改为深色
  - 状态行改为浅底深字
  - 实时分析卡片中的分区标题改为深色

本步验证：
- 已执行 `frontend` 下的 `npm.cmd run typecheck`
  - 通过
## 2026-04-05 Step 7

目标：
- 继续对齐 `train` 实时页的交互与展示模块
- 在不改变当前主项目页面风格的前提下，补齐用户点名缺失项

本步完成：
- 在实时摄像头工具栏补入 `Mirror` 开关
- 在实时摄像头工具栏补入 `Size` 按钮组（`S / M / L / XL`）
- 调整实时画面绘制逻辑
  - 从“居中缩放留边”改为“按容器 cover 填充”
  - 横屏、竖屏都改为优先填满实时摄像头区域
  - `Mirror` 开关直接作用于 canvas 绘制方向
- 补入 `Range Check` 模块
  - 展示 `In range / Out of range`
  - 展示当前范围判断原因
  - 展示最近一次动作的帧数
- 将 `Range Check` 的展示顺序上移到“纠错建议 / Coaching Tip”之前
- 开始把姿态页可见文案统一收口为英文
  - 本轮优先处理实时页新增控件和新增模块
  - 日志与对话说明仍保持中文

本步验证：
- 已执行：`frontend` 下的 `npm.cmd run typecheck`
  - 通过
- 已尝试：`npm.cmd run build`
  - 受当前本机 `vite/esbuild spawn EPERM` 环境限制，未完成构建
  - 当前可确认 TypeScript 类型检查通过

当前状态：
- 实时页已补齐本轮指定的 4 个重点项
- 下一步更适合继续做：
  - 把实时页剩余旧文案继续彻底统一为英文
  - 继续把右侧反馈区向 `train` 的 `Session Actions / History` 结构靠齐
