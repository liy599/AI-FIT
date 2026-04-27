# 新对话提示词：将 Pull-Up 替换为 Bent-Over Row

---

## 对话开头提示词（直接复制使用）

```
请阅读以下任务说明，完成 Pull-Up 到 Bent-Over Row 的替换：

## 任务目标
将 AI-FIT 项目中的 Pull-Up（引体向上）替换为 Bent-Over Row（俯身哑铃划船）。

## 具体要求

### 1. 前端页面 - Pose 选择卡片
- 文件：`frontend/src/pages/PoseSelectPage.tsx`
- 将 Pull-Up 卡片改为：
  - 名称：`Bent-Over Row`
  - 小标题：`Bodyweight` → `Dumbbell`
  - 图片：`/assets/images/pose/Bent-Over Row.jpg`

### 2. 前端工具页面
- 文件：`frontend/src/pages/PoseToolPage.tsx`
- 路由/工具入口参照别的动作（如 Push-Up、Lateral Raise）修改
- 确保实时和离线模式都能正常跳转

### 3. 保留 Pull-Up 代码（注释不删除）
- 文件：`frontend/src/lib/pose/realtimePullup.ts`
- **保留全部代码，仅注释掉**，添加注释说明

### 4. 实现 Bent-Over Row

#### 4.1 新建 analyzer
- 文件：`frontend/src/lib/pose/realtimeBentOverRow.ts`
- 参照：`realtimeLateralRaise.ts` 或 `realtimePushup.ts`
- 动作要点：
  - 起始：俯身，哑铃下垂，髋角约 45-90°
  - 发力：哑铃向上拉，肘部贴近身体
  - 顶峰：哑铃到胸部高度，肩胛骨收缩
  - 下放：缓慢控制下放，保持张力
- 关键检测点（17点）：left/right shoulder, elbow, wrist, hip
- 预期 issues：back_not_flat, elbow_flaring, incomplete_pull, using_momentum

#### 4.2 新建报告
- 文件：`frontend/src/pages/poseTool/helpers/bentOverRowReport.ts`
- 参照：`lateralRaiseReport.ts` 或 `pushupReport.ts`

#### 4.3 修改 Suggestion 映射
- 文件：`frontend/src/pages/poseTool/helpers/suggestionMap.ts`
- 添加 Bent-Over Row 的 suggestion 映射

#### 4.4 修改 createAnalyzer 工厂
- 文件：`frontend/src/pages/poseTool/helpers/analyzers.ts`
- 注释掉 `createAnalyzer('pullup')`
- 添加 `createAnalyzer('bent-over-row')`

## 参考文档
- 备份清单：`G:\学校\大四下\毕设\AI-FIT\info\refactor\BENT_OVER_ROW_MIGRATION_BACKUP_2026-04-25.md`
- 17点规范：`G:\学校\大四下\毕设\AI-FIT\info\refactor\POSE_17POINT_ANALYZER_MIGRATION_CHECKLIST.md`

## 命名规范
- Slug：`bent-over-row`（kebab-case）
- 类名：`RealtimeBentOverRowAnalyzer`
- 展示名：`Bent-Over Row`

## 注意事项
- Bent-Over Row 是双侧动作（双手同时持哑铃）
- 建议侧视视角
- 角度阈值需要根据实际测试调整
- 测试时验证：实时推理 + 离线视频回放
```

---

## 使用说明

1. 复制上方提示词
2. 开启新的 AI 对话
3. 粘贴提示词开始任务
4. 如有问题，可参考 `BENT_OVER_ROW_MIGRATION_BACKUP_2026-04-25.md` 获取更多细节
