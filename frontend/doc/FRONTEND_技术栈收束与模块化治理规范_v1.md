# FRONTEND 技术栈收束与模块化治理规范（v1）

- 日期：2026-04-29
- 目标：将前端收束为统一、简洁、职责清晰、可持续演进的架构。
- 适用目录：`frontend/src`

## 1. 目标技术栈（唯一主线）

- UI 框架：React + TypeScript
- 构建：Vite
- 路由：react-router-dom
- 样式：Tailwind + `src/styles/*`（逐步替代历史 CSS）
- AI/姿态：TensorFlow.js / MoveNet / MediaPipe（仅在 pose feature 内）

## 2. 分层边界（必须遵守）

- `pages/`：页面编排层
  - 允许：调用 `components/`、`state/`、`lib/`
  - 禁止：直接写复杂算法逻辑
- `components/`：可复用展示组件
  - 允许：少量交互逻辑
  - 禁止：直接发业务 API 请求
- `lib/`：业务与基础能力层
  - `lib/api.ts`：统一请求入口
  - `lib/pose/*`：姿态算法与分析逻辑
  - `lib/food/*`：饮食领域逻辑
- `state/`：跨页面状态（当前为 auth）
- `styles/`：样式与设计 token

## 3. 目录职责清单（简版）

- `App.tsx`：只做路由与守卫
- `pages/*`：页面流程与数据装配
- `components/*`：UI 结构与复用交互
- `lib/*`：纯逻辑与服务调用
- `state/*`：全局状态管理

## 4. 禁止事项

- 禁止在 `pages` 内直接写 100+ 行算法逻辑
- 禁止跨层反向依赖（`lib` 引用 `pages`）
- 禁止新增 `public/assets/css/*` 历史样式依赖
- 禁止在多个页面重复实现同一 API 适配逻辑

## 5. 渐进收束计划（执行顺序）

1. 清理遗留：删除零引用文件（已完成一项：`realtimePullupLegacy.ts`）
2. API 统一：页面请求都通过 `lib/api.ts` 或 feature API 封装
3. 样式收束：新改动仅允许 `Tailwind + src/styles/*`
4. Pose 模块收束：页面只调用 `poseTool/helpers`，不直接耦合底层实现
5. 资产收束：按引用审计逐步缩减 `public/assets/images`

## 6. 验收标准

- 新功能提交不新增跨层违规依赖
- 页面复杂逻辑持续下沉到 `lib/*`
- 历史 CSS 引用数量只减不增
- `npm run typecheck` 与 `npm run build` 通过
