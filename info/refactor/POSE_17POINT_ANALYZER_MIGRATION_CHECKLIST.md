# 统一改 Analyzer 全部吃 MoveNet 17 点：迁移清单（AI-FIT）

目的：将动作分析（计次/纠错）统一切换为 **MoveNet 17 点（MoveNetKeypoint[]，按 name 取点）** 作为唯一输入语义，逐步去掉对 **MediaPipe 33 landmarks（含 MoveNet→伪 33）** 的依赖，方便稳定化、降低“33/17 混用口径”风险，并为后续“只传 nativeKeypoints”做铺垫。

本文件只记录“迁移顺序 + 每个动作的 33 索引点位替换清单 + 复现所需信息”，不包含实现细节。

额外约束（命名规范）：
- 除本 md 文档外，代码与文件命名中不出现 “动作名+数字”（例如 Pullup17、Squat17）。
- 迁移完成后，面向业务的 analyzer 命名统一使用不带数字的名称（例如 `RealtimePullupAnalyzer`）。

---

## 0. 当前链路关键事实（用于复现）

- 实时推理来自 MoveNet，provider 只返回：
  - `nativeKeypoints`：MoveNet 原生 17 点（x/y/score/name）
- 页面实时分析只走 `analyzeNative(nativeKeypoints)`（不再存在 `analyze(landmarks)` 回退分支）：
  - 位置：[PoseToolPage.tsx](file:///g:/学校/大四下/毕设/AI-FIT/frontend/src/pages/PoseToolPage.tsx)
- analyzer 创建入口（页面 helpers）：
  - 位置：[analyzers.ts](file:///g:/学校/大四下/毕设/AI-FIT/frontend/src/pages/poseTool/helpers/analyzers.ts)

结论：**只要某个动作 analyzer 增加/完善 analyzeNative(17点) 并在内部不再依赖 33 索引，实时链路就会自然开始使用 17 点。**

---

## 1. 统一索引映射（33 → 17）

以下是“MediaPipe Pose 33 landmarks 的常用索引”与 MoveNet 17 关键点 name 的对应关系（项目里多个 analyzer 已写死使用这套索引）。

| MediaPipe idx | MoveNet name |
|---:|---|
| 0 | nose |
| 2 | left_eye |
| 5 | right_eye |
| 7 | left_ear |
| 8 | right_ear |
| 11 | left_shoulder |
| 12 | right_shoulder |
| 13 | left_elbow |
| 14 | right_elbow |
| 15 | left_wrist |
| 16 | right_wrist |
| 23 | left_hip |
| 24 | right_hip |
| 25 | left_knee |
| 26 | right_knee |
| 27 | left_ankle |
| 28 | right_ankle |

注意：
- MediaPipe 33 里 29..32（heel/foot_index）在 MoveNet 17 中不存在；如果某处用到了这些索引，需要改设计（改用 ankle/knee 的代理特征，或引入真正的 33 点模型）。
- 多个 analyzer 的 `issues[].joints: number[]` 目前仍在用 **MediaPipe 索引** 或“依赖 side 动态选择的索引”。如果最终要“全链路不含 33 语义”，这里建议改成 `MoveNetName[]` 或者改为“17点顺序索引”并统一一套 17-index 定义。

---

## 2. 按动作迁移顺序（推荐）

排序原则：优先迁移“当前完全依赖 33 点索引”的动作（收益最大），其次清理“已具备 17 点逻辑但仍残留 33 索引适配层/issue.joints”的动作（收尾去耦合）。

1) Push-Up（当前 33-only，优先完成）
2) Pull-Up（当前实现文件名/类名带 17，需要“去 17 命名”并确保只吃 17 点）
3) Lateral Raise（同上）
4) Deep Squat（同上）

Bench Press：
- 当前前端已隐藏该动作，本轮不实现。
- 本轮目标是“注释掉/停用 Bench Press 的实现与接入点”，避免后续误用与维护成本。

---

## 3. 每个动作的“33 索引替换清单”

### 3.1 Bench Press（本轮停用，不做 17 点迁移）

- 入口文件/类：
  - [realtimeBenchPress.ts](file:///g:/学校/大四下/毕设/AI-FIT/frontend/src/lib/pose/realtimeBenchPress.ts)
  - `RealtimeBenchPressAnalyzer`
- 本轮处理结果（已完成）：
  - [x] 前端不再暴露 Bench Press 的 slug/入口（选择页、exercise 定义、helpers types/映射均移除）
  - [x] report builder 入口已停用（对应 helper 保留但直接抛错）
  - [x] 业务链路不再创建/调用 Bench Press analyzer（避免误用 33 索引语义）

### 3.2 Push-Up（优先完成）

- 入口文件/类：
  - [realtimePushup.ts](file:///g:/学校/大四下/毕设/AI-FIT/frontend/src/lib/pose/realtimePushup.ts)
  - `RealtimePushupAnalyzer`
- 现状：
  - `analyze(landmarks)` 使用 33 索引取 shoulder/elbow/wrist/hip/knee/ankle 等
  - `chooseSide(landmarks)` 使用 33 索引集合累加 visibility
  - `trackingQuality` 使用 `avgVisibility(landmarks,[...])`
- 需要替换的索引：
  - 肩：11/12
  - 肘：13/14
  - 腕：15/16
  - 髋：23/24
  - 膝：25/26
  - 踝：27/28
- side 选择（原逻辑使用的索引集合）：
  - leftVis 累加：[11,13,15,23,25,27]
  - rightVis 累加：[12,14,16,24,26,28]
- trackingQuality 计算（原逻辑使用的索引集合）：
  - `[11,12,13,14,15,16,23,24,25,26,27,28]`
- issue.joints（当前为 33 索引）：
  - hips sagging joints: `[11,12,23,24,27,28]`
- 迁移目标（动作级别）：
  - [x] 改为只暴露 `analyzeNative(keypoints17)`，内部按 name 取点
  - [x] 置信度门控统一使用 `score`
  - [x] `issues[].joints` 统一为 `MoveNetName[]`

### 3.3 Pull-Up（去 “17” 命名 + 只吃 17 点）

- 入口文件/类：
  - 当前： [realtimePullup.ts](file:///g:/学校/大四下/毕设/AI-FIT/frontend/src/lib/pose/realtimePullup.ts) / `RealtimePullupAnalyzer`
- 现状：
  - [x] 新版 analyzer 仅 `analyzeNative(keypoints17)`（不再提供 `analyze(landmarks)` 回退入口）
  - [x] legacy 实现保留但改名为 `RealtimePullupLegacyAnalyzer`，且 `issues[].joints` 已改为 `MoveNetName[]`
- 迁移目标（动作级别）：
  - [x] 完成“去 17 命名”并确保 createAnalyzer 只指向新版 analyzer

### 3.4 Lateral Raise（去 “17” 命名 + 只吃 17 点）

- 入口文件/类：
  - 当前： [realtimeLateralRaise.ts](file:///g:/学校/大四下/毕设/AI-FIT/frontend/src/lib/pose/realtimeLateralRaise.ts) / `RealtimeLateralRaiseAnalyzer`
- 现状：
  - [x] 新版 analyzer 仅 `analyzeNative(keypoints17)`（不再提供 `analyze(landmarks)` 回退入口）
  - [x] legacy 实现保留但改名为 `RealtimeLateralRaiseLegacyAnalyzer`，且 `issues[].joints` 已改为 `MoveNetName[]`
- 迁移目标（动作级别）：
  - [x] 完成“去 17 命名”并确保 createAnalyzer 只指向新版 analyzer

### 3.5 Deep Squat（去 “17” 命名 + 只吃 17 点）

- 入口文件/类：
  - 当前： [realtimeSquatAnalyzer.ts](file:///g:/学校/大四下/毕设/AI-FIT/frontend/src/lib/pose/realtimeSquatAnalyzer.ts) / `RealtimeSquatAnalyzer`
- 现状：
  - [x] 新版 analyzer 仅 `analyzeNative(keypoints17)`（不再提供 `analyze(landmarks)` 回退入口）
  - [x] `issues[].joints` 统一为 `MoveNetName[]`
- 迁移目标（动作级别）：
  - [x] 完成“去 17 命名”并确保 createAnalyzer 只指向新版 analyzer

---

## 4. 迁移完成的判定清单（可直接勾选）

- 动作 analyzer 层：
  - [x] 所有动作 analyzer 都提供并使用 `analyzeNative(MoveNetKeypoint[])`
  - [x] 业务链路不再调用 `analyze(landmarks)`，不再依赖 33 索引语义
  - [x] analyzer 内部所有置信度门控统一使用 `score`
- 页面/数据流层：
  - [x] 实时只依赖 `nativeKeypoints`
  - [x] 离线回放只依赖 17 点序列（nativeFrames）
- 辅助结构：
  - [x] `issues[].joints` 统一为 `MoveNetName[]`
  - [x] 业务链路已移除 “MoveNet → 伪 33” 的兼容层入口，避免被误用

---

## 5. 命名与重命名策略（避免 “动作名+数字”）

由于仓库内同时存在“旧版（33索引）”与“新版（17点）”的实现文件，直接重命名可能发生同名冲突。建议采用如下策略之一，并在迁移时全仓统一执行：

方案 A（推荐，明确 legacy）：
- 将旧版（33索引）文件改名为 `realtime<Exercise>Legacy.ts`，类名改为 `Realtime<Exercise>LegacyAnalyzer`
- 将新版（17点）文件改名为 `realtime<Exercise>.ts`，类名改为 `Realtime<Exercise>Analyzer`

方案 B（明确 v1/v2，但不使用数字后缀）：
- 旧版：`realtime<Exercise>Classic.ts` / `Realtime<Exercise>ClassicAnalyzer`
- 新版：`realtime<Exercise>.ts` / `Realtime<Exercise>Analyzer`

执行要求：
- 代码与文件命名不出现 17/33 等数字后缀
- `createAnalyzer` 映射只指向“不含数字”的 analyzer
- 对外 slug/展示名保持不变（例如 `pushup`、`pullup`、`lateral-raise`、`squat`），仅内部实现类/文件更名
