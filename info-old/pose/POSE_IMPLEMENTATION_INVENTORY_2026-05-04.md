# Pose 实现盘点

日期：2026-05-04  
更新：2026-05-05，完成前端/后端目录治理与 Pose 主链路收口。

## 1. 主链路

Pose 是浏览器本地推理优先的训练分析能力。

1. 页面只解析路由、动作和模式，并渲染 live/offline 面板。
2. `usePosePolicyRuntime()` 读取后端统一 policy，并把远端数值限幅为前端 runtime rules。
3. `useLivePoseRuntime()` 统一管理摄像头、MoveNet provider、分析器、overlay、session 状态、报告生成和训练保存。
4. `useOfflinePoseRuntime()` 统一管理本地视频选择、MoveNet 抽帧、动作分析、overlay 回放、报告生成和可选训练归档。
5. 后端只提供 policy 与训练记录持久化，不接收 Pose 原视频，不提供服务端推理任务。

## 2. 前端结构

页面目录已按业务分组：
- `frontend/src/pages/public/*`
- `frontend/src/pages/auth/*`
- `frontend/src/pages/blog/*`
- `frontend/src/pages/food/*`
- `frontend/src/pages/pose/*`
- `frontend/src/pages/user/*`
- `frontend/src/pages/admin/*`

全局 layout 组件：
- `frontend/src/components/layout/*`

跨业务 `lib` 只保留基础设施：
- `frontend/src/lib/api.ts`
- `frontend/src/lib/auth.ts`
- `frontend/src/lib/media.ts`
- `frontend/src/lib/report/*`

Food 业务客户端已归位：
- `frontend/src/modules/food/api.ts`
- `frontend/src/modules/food/types.ts`
- `frontend/src/modules/food/index.ts`

Pose 模块结构：
- `frontend/src/modules/pose/index.ts`：业务级 facade。
- `frontend/src/modules/pose/api.ts`：Pose policy/training API。
- `frontend/src/modules/pose/policy.ts`：policy runtime、默认规则和 analyzer tuning 映射。
- `frontend/src/modules/pose/domain/*`：动作目录与训练命名。
- `frontend/src/modules/pose/vision/*`：MoveNet、tracking、provider、distance、canvas draw。
- `frontend/src/modules/pose/analyzer/*`：四动作 analyzer 与统一反馈类型。
- `frontend/src/modules/pose/runtime/live.ts`：实时模式主 hook。
- `frontend/src/modules/pose/runtime/live/*`：实时模式私有 helper。
- `frontend/src/modules/pose/runtime/offline.ts`：离线模式主 hook。
- `frontend/src/modules/pose/runtime/offline/*`：离线模式私有 helper。
- `frontend/src/modules/pose/runtime/types.ts`：runtime 类型。
- `frontend/src/modules/pose/runtime/toolUi.ts`：工具页 mode、教学文案和 UI helper。
- `frontend/src/modules/pose/reporting/*`：报告模型、文案、实时/离线报告、归档、policy 标记、overlay replay。
- `frontend/src/modules/pose/helpers/replayStats.ts`：通用 analyzer replay 统计器，减少动作报告构建重复代码。
- `frontend/src/modules/pose/helpers/*Report.ts`：各动作报告规则与动作特异逻辑。

UI 组件：
- `frontend/src/components/pose/*`
- `frontend/src/components/ui/*`

## 3. 后端结构

后端路由已按业务分组：
- `backend/app/routes/account/*`：auth、user、feedback、workouts。
- `backend/app/routes/blog/*`：blogs、comments、tags。
- `backend/app/routes/food/*`：food meta、foods、meals、recognize。
- `backend/app/routes/pose/api.py`：Pose policy/training API。
- `backend/app/routes/admin/lifecycle.py`：管理员生命周期治理。

Pose API：
- `GET /api/pose/policy`
- `POST /api/pose/trainings`
- `GET /api/pose/trainings`
- `GET /api/pose/trainings/<session_id>`
- `PUT /api/pose/trainings/<session_id>/report`

Pose 服务：
- `backend/app/services/pose/policy.py`：四动作 policy 与 analyzer tuning 的后端唯一来源。

Pose 数据：
- `TrainingSession`
- `TrainingSet`

当前 Pose 数据库表：
- `training_sessions`
- `training_sets`

已退役的服务端推理表：
- `video_assets`
- `analysis_tasks`
- `analysis_results`

迁移：
- `backend/migrations/versions/4f8d9f0a6c21_drop_legacy_pose_server_tables.py`

## 4. 已完成治理

- 删除旧 `frontend/src/lib/poseApi.ts`，API 收口到 `frontend/src/modules/pose/api.ts`。
- 删除旧 `frontend/src/modules/pose/tool/*` 主链路目录，按 `runtime/` 与 `reporting/` 重新归位。
- 删除旧 `frontend/src/lib/pose/*`，Pose 专属底层能力收回 `frontend/src/modules/pose/*`。
- `frontend/src/lib` 现在只保留跨业务基础设施。
- `PoseToolPage.tsx` 不再直接 import MoveNet、Analyzer、provider、live/offline 内部 helper。
- 深蹲 tuning 与其他动作统一从 `/api/pose/policy` 的 `rules.analyzer` 获取。
- 深蹲反馈类型与 analyzer 实现已统一归入 `modules/pose/analyzer/types.ts` 与 `modules/pose/analyzer/squat.ts`。
- 通用 replay 统计器已抽出，动作报告文件不再重复完整 analyzer replay 骨架。
- 后端不再提供 `/api/pose/config/squat-tuning`，该旧路由应返回 404。
- 训练报告继续写入 policy 版本，离线原视频继续不上传。

## 5. 当前依赖方向

`pages/components -> modules/* facade -> modules/<domain>/runtime/api/policy/reporting -> domain/vision/analyzer helpers -> shared lib infrastructure -> backend APIs`

`lib/` 不再承载业务域实现。未来新增业务能力应优先进入 `modules/<domain>/`，只有真正跨业务复用的基础设施才进入 `lib/`。
