# Pull-Up → Bent-Over Row 替换任务备份

> 创建时间：2026-04-25
> 目的：将动作 Pull-Up 替换为 Bent-Over Row（俯身哑铃划船）

---

## 1. 任务目标

将 AI-FIT 项目中的 **Pull-Up（引体向上）** 动作替换为 **Bent-Over Row（俯身哑铃划船）**。

---

## 2. 具体改动清单

### 2.1 前端页面 - Pose 选择卡片

**文件**：`frontend/src/pages/PoseSelectPage.tsx`

**改动**：
- 找到 Pull-Up 卡片配置
- 修改 `name`：`Pull-Up` → `Bent-Over Row`
- 修改 `subtitle`：`Bodyweight` → `Dumbbell`
- 图片路径：`/assets/images/pose/Bent-Over Row.jpg`（已存在）

---

### 2.2 前端路由/工具页面

**文件**：`frontend/src/pages/PoseToolPage.tsx`

**改动**：
- 路由/工具入口：将 `/tools/pose/pullup/tool` 相关配置改为 Bent-Over Row
- 参照别的动作（如 Push-Up、Lateral Raise）的实现方式
- 确保实时和离线模式都能正常跳转

---

### 2.3 动作识别代码

**文件**：`frontend/src/lib/pose/realtimePullup.ts`

**改动**：
- **保留** Pull-Up 的 `RealtimePullupAnalyzer` 实现代码
- **注释掉**（不删除）原有实现
- 添加 `// LEGACY: Pull-Up - commented out for Bent-Over Row` 等注释

---

### 2.4 新动作实现

**新增文件**：`frontend/src/lib/pose/realtimeBentOverRow.ts`

**参照**：
- `realtimePushup.ts` - 完整的 analyzer 结构
- `realtimeLateralRaise.ts` - 17点实现参考

**Bent-Over Row 动作要点**：

| 阶段 | 关键点 | 角度/规则 |
|------|--------|-----------|
| 起始 | 俯身，哑铃下垂 | 髋角约 45-90° |
| 发力 | 哑铃向上拉 | 肘部贴近身体 |
| 顶峰 | 哑铃到胸部高度 | 肩胛骨收缩 |
| 下放 | 缓慢控制下放 | 保持张力 |

**关键检测点（17点）**：
- `left_shoulder` / `right_shoulder`
- `left_elbow` / `right_elbow`
- `left_wrist` / `right_wrist`
- `left_hip` / `right_hip`

**预期 issues 类型**：
- `back_not_flat` - 背部不直
- `elbow_flaring` - 肘部外撇
- `incomplete_pull` - 行程不完整
- `using_momentum` - 借助惯性

---

### 2.5 报告生成

**文件**：`frontend/src/pages/poseTool/helpers/pullupReport.ts`

**处理方式**：
- 重命名为 `bentOverRowReport.ts`
- 参照别的动作报告（如 `lateralRaiseReport.ts`）重写
- 原 `pullupReport.ts` 注释掉（保留代码）

---

### 2.6 Suggestion 映射

**文件**：`frontend/src/pages/poseTool/helpers/suggestionMap.ts`

**改动**：
- 添加 Bent-Over Row 的 suggestion 映射
- Pull-Up 的 suggestion 注释掉

---

### 2.7 createAnalyzer 工厂

**文件**：`frontend/src/pages/poseTool/helpers/analyzers.ts`

**改动**：
- `createAnalyzer('pullup')` 注释掉
- 添加 `createAnalyzer('bent-over-row')` 指向新的 Bent-Over Row analyzer

---

## 3. 改动优先级

1. **Phase 1**：页面卡片修改（视觉可见）
2. **Phase 2**：路由/工具页面适配
3. **Phase 3**：保留 Pull-Up 代码 + 创建 Bent-Over Row analyzer
4. **Phase 4**：报告和 suggestion 映射
5. **Phase 5**：测试验证（实时 + 离线）

---

## 4. 参考动作实现

建议参照 `Lateral Raise` 的实现方式，因为它：
- 已经是 17-only 实现
- 结构完整（有 `analyzeNative`）
- issues 使用 `MoveNetName[]`
- 文件：`frontend/src/lib/pose/realtimeLateralRaise.ts`

---

## 5. 注意事项

- Bent-Over Row 是**单侧**或**双侧**动作？建议先做**双侧**简化版本
- 视角：**侧视/背面**均可，建议侧视
- 角度阈值需要根据实际测试调整
- 离线视频分析：确保 nativeFrames 能正确处理

---

## 6. 17点 MoveNet Keypoint 名称参考

```
nose, left_eye, right_eye, left_ear, right_ear,
left_shoulder, right_shoulder,
left_elbow, right_elbow,
left_wrist, right_wrist,
left_hip, right_hip,
left_knee, right_knee,
left_ankle, right_ankle
```

---

## 7. 相关文件路径汇总

| 操作 | 文件路径 |
|------|----------|
| 页面卡片 | `frontend/src/pages/PoseSelectPage.tsx` |
| 工具页面 | `frontend/src/pages/PoseToolPage.tsx` |
| Pull-Up analyzer（注释） | `frontend/src/lib/pose/realtimePullup.ts` |
| 新 analyzer | `frontend/src/lib/pose/realtimeBentOverRow.ts` |
| Pull-Up 报告（注释） | `frontend/src/pages/poseTool/helpers/pullupReport.ts` |
| 新报告 | `frontend/src/pages/poseTool/helpers/bentOverRowReport.ts` |
| Suggestion 映射 | `frontend/src/pages/poseTool/helpers/suggestionMap.ts` |
| Analyzer 工厂 | `frontend/src/pages/poseTool/helpers/analyzers.ts` |
| 动作元数据 | `frontend/src/lib/pose/exercises.ts` |

---

## 8. 命名规范

参照 `info/refactor/POSE_17POINT_ANALYZER_MIGRATION_CHECKLIST.md`：

- 文件：`realtimeBentOverRow.ts`
- 类名：`RealtimeBentOverRowAnalyzer`
- Slug：`bent-over-row`（kebab-case）
- 展示名：`Bent-Over Row`
