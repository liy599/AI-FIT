# 基准集标注格式（Pose Benchmark v1）

本规范用于给“离线回放 runner / 快照回归”提供稳定输入，不依赖真实视频文件。基准样本以“抽帧后的姿态关键点序列（landmarks）”作为事实输入；真实视频可在私有环境中自行保留，但不进入仓库。

## 目录结构建议

```text
benchmarks/pose-baseline/
  ANNOTATION_FORMAT.md
  templates/
    manifest.template.json
    case.template.json
    snapshot.template.json
  examples/
    manifest.json
    cases/
      squat_no_rep_minimal.json
    snapshots/
      squat_no_rep_minimal.snapshot.json
```

## 1) Manifest（用例清单）

用于批量跑快照回归。字段说明见模板：[manifest.template.json](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/benchmarks/pose-baseline/templates/manifest.template.json)

要点：
- `cases[].caseFile` 与 `cases[].snapshotFile` 路径相对 manifest 文件所在目录。
- `tolerance.numberAbs` 为全局数值容忍区间（绝对误差），用于避免浮点抖动导致误报。
- `ignorePaths` 用于忽略非稳定字段（默认忽略 `generatedAt` 等时间戳）。

## 2) Case（单个样本/标注）

一个 case 文件包含“姿态序列 + 元信息”。字段说明见模板：[case.template.json](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/benchmarks/pose-baseline/templates/case.template.json)

### PoseFrame 与 landmarks

- `frames[]` 与前端复用同一结构：`PoseFrame { tMs: number, landmarks: NormalizedLandmark[] | null }`
- `landmarks` 数组长度建议固定为 33（MediaPipe Pose 33 点），索引含义沿用 MediaPipe。
- 每个 landmark 至少包含 `x,y,z,visibility`（均为 0~1 的归一化坐标/置信度）。

### 不包含真实视频

如果仍希望记录来源，可在 `meta` 中仅存“占位信息”：
- `meta.sourceVideoPath: "videos/xxx.mp4"`（不提供文件）
- `meta.sourceNote: "..."`

### 可选：KPI 评估用 labels（推荐放在私有基准集里）

为了在本地复现 **rep MAE / precision&recall / unassessed rate** 等 KPI，case 可额外携带 `labels` 字段（不会被 runner/快照回归强制要求）：

- `labels.reps`：ground truth rep 数（整数）
- `labels.issues`：5 类核心纠错是否出现（布尔），键为 `DEPTH/KNEE_VALGUS/HEEL_LIFT/TORSO_LEAN/TEMPO_DRIFT`

## 3) Snapshot（期望输出）

快照文件保存“离线 runner 输出的 report（经过归一化/去除时间戳）”。格式模板：
[snapshot.template.json](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/benchmarks/pose-baseline/templates/snapshot.template.json)

建议：
- 快照文件按 `snapshots/<caseId>.snapshot.json` 命名；
- 首次生成/更新使用 `--update` 自动写入。

## 4) 本地运行

在 `frontend/` 目录下：

```bash
# 1) 单个 case 离线回放，输出 report
npm run pose:replay -- --case ../benchmarks/pose-baseline/examples/cases/squat_no_rep_minimal.json --out /tmp/report.json

# 2) 快照回归（对比 snapshot）
npm run pose:snapshot -- --manifest ../benchmarks/pose-baseline/examples/manifest.json

# 3) 更新快照（当算法变更后重新基线化）
npm run pose:snapshot -- --manifest ../benchmarks/pose-baseline/examples/manifest.json --update

# 4) KPI 汇总评估（仅统计带 labels 的 case）
npm run pose:kpi -- --manifest ../benchmarks/pose-baseline/examples/manifest.json --out /tmp/kpi.json
```

注意：脚本通过 `tsx` 直接运行 TypeScript 工具代码，无需额外构建步骤。
