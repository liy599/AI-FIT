# 后端运维

## 本地运行
1. 按 `.env.example` 准备数据库和环境变量。
2. 按项目要求执行 migration/init。
3. 启动后端服务。

## 生产运行手册
- 健康检查：API 进程、数据库连接、auth/cookie 流程、Pose policy 端点可用性。
- 故障排查顺序：auth -> DB -> uploads -> AI provider。
- 恢复策略：当前 Pose 主链路没有服务端分析任务；失败的本地分析由用户在前端重新执行。
- 使用 `backend/.env.production.example` 作为部署模板，真实 secret 必须在仓库外注入。
- migration baseline 位于 `backend/migrations`；每次发布应用前先执行 upgrade。

## 可观测性建议
- 增加结构化日志，包含 request id 和用户 id hash。
- 建议跟踪指标：
  - auth 失败数和限流命中数。
  - Pose policy 端点错误率。
  - 训练记录保存成功率。
  - 上传文件大小分布。

## 数据生命周期
- 保留策略应覆盖训练记录、反馈、餐食、训练、博客等用户数据。
- 当前 Pose 主链路不上传原始视频，也不创建服务端分析任务。
- 周期性清理任务应关注过期业务数据和孤儿上传文件。

## 发布门禁
- `npm run typecheck` 和前端 build 通过。
- 后端 import/startup smoke 通过。
- 已跟踪文件中没有硬编码密钥。
- 后端发布前执行 `flask --app run.py db upgrade`，不要依赖运行时自动建表。
