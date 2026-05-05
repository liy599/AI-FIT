# 前端重构完整追踪

日期：2026-04-29  
最新更新：2026-05-05

本文保留前端治理追踪，以当前目录结构为准。

## 当前原则

- `src/lib` 只保留跨业务基础设施。
- 业务实现进入 `src/modules/<domain>`。
- 页面按业务域放入 `src/pages/<domain>`。
- 全站 layout 组件放入 `src/components/layout`。
- 页面和组件不直接依赖底层实现文件，优先走模块 facade。

## 当前目录

基础设施：
- `src/lib/api.ts`
- `src/lib/auth.ts`
- `src/lib/media.ts`
- `src/lib/report/*`

业务模块：
- `src/modules/blog/index.ts`
- `src/modules/food/api.ts`
- `src/modules/food/types.ts`
- `src/modules/food/index.ts`
- `src/modules/pose/*`
- `src/modules/user/index.ts`

页面：
- `src/pages/public/*`
- `src/pages/auth/*`
- `src/pages/blog/*`
- `src/pages/food/*`
- `src/pages/pose/*`
- `src/pages/user/*`
- `src/pages/admin/*`

组件：
- `src/components/layout/*`
- `src/components/pose/*`
- `src/components/ui/*`

## Pose 当前结构

- `src/modules/pose/api.ts`：Pose API。
- `src/modules/pose/policy.ts`：policy runtime。
- `src/modules/pose/domain/*`：动作目录与训练命名。
- `src/modules/pose/vision/*`：MoveNet、tracking、provider、drawing。
- `src/modules/pose/analyzer/*`：四动作 analyzer 与统一反馈类型。
- `src/modules/pose/runtime/live.ts` 与 `runtime/live/*`：实时主链路。
- `src/modules/pose/runtime/offline.ts` 与 `runtime/offline/*`：离线主链路。
- `src/modules/pose/reporting/*`：报告与 overlay replay。
- `src/modules/pose/helpers/replayStats.ts`：通用 analyzer replay 统计器。

## 已完成治理

- 删除旧 `src/lib/poseApi.ts`。
- 删除旧 `src/lib/food/*`，Food API 归入 `modules/food`。
- 删除旧 `src/lib/pose/*`，Pose 专属能力归入 `modules/pose`。
- 删除旧 `src/modules/pose/tool/*`。
- `PoseToolPage` 已移动到 `src/pages/pose/PoseToolPage.tsx`，并保持薄页面职责。
- `lint:boundaries` 通过。
- `npm run build` 通过。
