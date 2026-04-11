# 深蹲（Squat）实时矫正判断标准（含数据位置对照）

本文只描述 **动作矫正 → 实时矫正 → 深蹲（Squat）** 当前代码实现的判断标准（阈值/规则/门控/评分），并把每条标准对应到：
- **算法计算位置（代码）**
- **实时输出数据位置（RealtimeFeedback）**
- **训练报告/落库数据位置（report_json）**

> 说明：深蹲是样板动作；其它动作会复用同一框架（门控/报告/存储/回归），差异主要在 analyzer 的纠错算法与阈值。

---

## 1. 输入数据（数据来源）

### 1.1 关键点（Landmarks）
- 来源：浏览器端 MoveNet/MediaPipe 的人体关键点（NormalizedLandmark）
- 使用位置（深蹲实时 analyzer）：[realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/realtimeSquat.ts)

深蹲判断依赖的关键点索引（MoveNet/MediaPipe 对齐后）：
- 肩/髋/膝/踝：11/12/23/24/25/26/27/28
- 脚跟/脚尖：29/30/31/32（可能由底层补齐/合成）
- 鼻子：0

### 1.2 跟踪质量与距离（Quality / Distance）
深蹲“是否可判断”不仅取决于关键点本身，还取决于：
- 跟踪状态（TrackingState：calibrating/lost）
- 距离状态（DistanceState：too_close/too_far/calibrating）
- 视角是否满足侧视（side view）

门控计算位置：
- [gate.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/analyzer/gate.ts#L26-L50)

---

## 2. 质量门控（Quality Gate）标准（会暂停计次/阶段推进/评分）

### 2.1 门控状态码（最终输出）
门控状态码枚举：
- `OK`
- `DEVICE_ERROR`
- `OUT_OF_FRAME`
- `TRACKING_CALIBRATING`
- `TRACKING_LOST`
- `DISTANCE_CALIBRATING`
- `TOO_CLOSE`
- `TOO_FAR`
- `WRONG_ANGLE`
- `LOW_CONFIDENCE`

定义与文案映射：
- [gate.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/analyzer/gate.ts#L6-L106)

### 2.2 深蹲侧视角（WRONG_ANGLE）
- 判定：`offsetAngle > 55`（不是清晰侧视角）
- 计算位置：
  - `offsetAngle` 计算与暂停条件：[realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/realtimeSquat.ts#L176-L199)
  - 门控汇总为 `WRONG_ANGLE`：[gate.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/analyzer/gate.ts#L43-L45)
- 实时输出数据：
  - `feedback.offsetAngle`
  - `feedback.isCountingPaused`
- 报告/落库数据：
  - `report_json.keyMetrics.gatedFrames / gatedFramePct / topGateCode`
  - `report_json.details.gating`（包含 `byCode`、`last`）
  - 生成位置：[squatReport.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/analyzer/squatReport.ts#L32-L176)

### 2.3 LOW_CONFIDENCE（低置信/关键角缺失）
深蹲 analyzer 内部还会触发低置信暂停：
- `trackingQuality < 0.28` 或 `kneeVerticalAngle/torsoAngle` 缺失
- 计算位置：[realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/realtimeSquat.ts#L181-L188)
- 实时输出：`feedback.trackingQuality`, `feedback.isCountingPaused`, `feedback.warnings`

### 2.4 门控行为（关键）
门控触发后：
- **暂停计次/阶段推进**：state 不再更新，rep 窗口不累计（避免误计数）
- **评分置空**：报告中的 score 允许为 `null`（见第 6 节）

---

## 3. 动作阶段与计次（State Machine）

### 3.1 状态定义
深蹲状态机：
- `s1`：站立/接近站立（up）
- `s2`：下蹲/起身过程（descent/ascent）
- `s3`：底部（bottom）

状态 → phase 映射：
- [realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/realtimeSquat.ts#L745-L750)

### 3.2 进入/退出阈值（膝角 kneeAngle）
膝角定义：`angle(midHip, midKnee, midAnkle)`（单位：deg）
- 计算：[realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/realtimeSquat.ts#L176-L179)

阈值（带滞回 hysteresis）：
- `S1_ENTER_KNEE_ANGLE = 150`
- `S1_EXIT_KNEE_ANGLE = 145`
- `S3_ENTER_KNEE_ANGLE = 125`
- `S3_EXIT_KNEE_ANGLE = 133`

状态机实现：
- [realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/realtimeSquat.ts#L727-L743)

### 3.3 计次条件（rep 完成判定）
一次 rep 在满足以下条件时计数：
- 从 `s1 → s2` 开始（建立 per-rep 窗口）
- 必须进入过 `s3`（底部）
- 最终回到 `s1` 时才算 rep 结束

计数口径（你提出的标准）：
- **repCount 与正确/错误无关**：只要完成一次完整动作周期且满足最短帧数要求，就会计为 1 次 rep
- 正确性仅影响 `correctReps / incorrectReps / unassessedReps` 的归类与提示文案，不影响 repCount 本身
- 对应实现：`this.repCount += 1` 发生在“可靠性判定/正确性判定”之前  
  - [realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/realtimeSquat.ts#L395-L505)

关键规则：
- **最短帧数**：`REP_COUNT_MIN_FRAMES = 5`，不足则 rep 忽略（不计次）
- 计次窗口与忽略逻辑：[realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/realtimeSquat.ts#L358-L418)

### 3.4 “可评估 rep”判定（Reliable Tracking）
rep 计数后还会判断该 rep 是否具备足够质量可被评估（否则属于 unassessed）：
- `REP_VALID_MIN_FRAMES = 8`
- `REP_VALID_RATIO_MIN = 0.45`

实现位置：
- [realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/realtimeSquat.ts#L420-L505)

对应数据：
- 实时：`feedback.session.unassessedReps`
- 报告：`report_json.keyMetrics.unassessedReps`

---

## 4. 深蹲纠错标准（5 类核心纠错 + 1 类额外实时提醒）

下面每一类都包含：
- **特征（Metric）**
- **阈值（Threshold）**
- **分级（levelScore/level）**
- **数据落点（RealtimeFeedback / report_json）**

### 4.1 Depth insufficient（深度不足）
特征：膝角 `kneeAngleDeg`（越小越深）

阈值（deg）：
- OK：`<= 112`（DEPTH_OK_KNEE_ANGLE）
- Minor：`> 112 && <= 118`（DEPTH_WARN_KNEE_ANGLE）
- Moderate：`> 118 && <= 125`
- Severe：`> 125`

分级实现：
- [realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/realtimeSquat.ts#L540-L571)

计次判失败（rep 维度）：
- `repMinKneeAngle > 118` 视为 depth failed
- [realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/realtimeSquat.ts#L436-L468)

数据位置：
- 实时（每帧）：`feedback.coreCorrections[]` 中 `type=DEPTH`
- 实时（会话累计）：`feedback.session.depthInsufficientCount`
- 报告（落库）：
  - `report_json.details.coreCorrections[]`（汇总 ratio）
  - `report_json.keyMetrics.formScore` 的 breakdown 会对 DEPTH 计入 penalty
  - 生成位置：[squatReport.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/analyzer/squatReport.ts#L253-L413)

### 4.2 Knee valgus/varus（膝内扣/外翻）
特征：`kneeSpacingRatio = kneeDistance / ankleDistance`（范围 0–2，越小越“膝内扣”）

可计算前提：
- 只有在 `offsetAngle` 介于 `18..55`（接近侧视但不极端）才计算
- 足够可见性：膝/踝 visibility >= 0.35

计算位置：
- [realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/realtimeSquat.ts#L775-L788)

阈值（ratio）：
- OK：`>= 0.92`
- Minor：`>= 0.85`
- Moderate：`>= 0.75`
- Severe：`< 0.75`

分级实现：
- [realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/realtimeSquat.ts#L573-L604)

rep 失败条件（需要连续硬帧）：
- `repMinKneeSpacingRatio <= 0.75` 且 `repKneeValgusHardFrames >= 3`
- [realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/realtimeSquat.ts#L438-L474)

数据位置：
- 实时：`feedback.coreCorrections` 中 `type=KNEE_VALGUS`
- 会话累计：`feedback.session.kneeValgusCount`
- 报告：`report_json.details.coreCorrections` + `report_json.keyMetrics.formScore` breakdown

### 4.3 Heel lift（脚跟抬起）
特征：`heelLiftY = footIndex.y - heel.y`（越大代表脚跟越抬）

可计算前提：
- heel 与 footIndex visibility >= 0.3
- 计算位置：[realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/realtimeSquat.ts#L765-L773)

阈值（normalized y）：
- Minor：`>= 0.012`
- Moderate：`>= 0.025`
- Severe：`>= 0.04`

分级实现：
- [realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/realtimeSquat.ts#L606-L637)

rep 失败条件（需要连续硬帧）：
- `repPeakHeelLiftY >= 0.04` 且 `repHeelLiftHardFrames >= 3`
- [realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/realtimeSquat.ts#L437-L479)

数据位置：
- 实时：`feedback.coreCorrections` 中 `type=HEEL_LIFT`
- 会话累计：`feedback.session.heelLiftCount`
- 报告：`report_json.details.coreCorrections` + `report_json.keyMetrics.formScore` breakdown

### 4.4 Torso lean（躯干前倾）
特征：`torsoFromVerticalDeg`（肩-髋连线相对竖直角度）

阈值（deg from vertical）：
- OK：`<= 30`
- Minor：`> 30 && <= 40`
- Moderate：`> 40 && <= 49`
- Severe：`> 49`

分级实现：
- [realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/realtimeSquat.ts#L639-L676)

rep 失败条件（需要连续硬帧）：
- `repPeakTorsoLeanAngle >= 49` 且 `repForwardLeanHardFrames >= 5`
- [realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/realtimeSquat.ts#L433-L461)

数据位置：
- 实时：`feedback.coreCorrections` 中 `type=TORSO_LEAN`
- 会话累计：`feedback.session.torsoLeanCount`（与 forwardLeanCount 兼容）
- 报告：`report_json.details.coreCorrections` + `report_json.keyMetrics.formScore` breakdown

### 4.5 Tempo drift（节奏漂移/忽快忽慢）
特征（实时累计）：rep duration 序列的波动 + 快/慢 rep 数
- `REP_FAST_SEC = 0.95`
- `REP_SLOW_SEC = 3.6`
- 统计：`fastRepCount / slowRepCount` 与变异系数 `durationCv`

分级逻辑：
- 如果 rep 数 < 2 → unknown
- `durationCv >= 0.35` → severe
- `(fast+slow) >= max(2, ceil(repCount*0.5))` 或 `durationCv >= 0.22` → moderate
- `(fast+slow) >= 1` 或 `durationCv >= 0.16` → minor
- 否则 ok

实现位置：
- [realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/realtimeSquat.ts#L678-L725)

数据位置：
- 实时：`feedback.coreCorrections` 中 `type=TEMPO_DRIFT`
- 会话累计：`feedback.session.tempoDriftCount / fastRepCount / slowRepCount / avgRepDurationSec`
- 报告：
  - `report_json.details.tempo`（来自 timeline 的额外检测）
  - `report_json.details.coreCorrections`（ratio）
  - `report_json.keyMetrics.formScore` breakdown
  - 生成位置：[squatReport.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/analyzer/squatReport.ts#L68-L109)

### 4.6 Knee over toe（膝盖过脚尖，额外实时提醒）
特征：`kneeOverToeRatio = (knee.x - footIndex.x) * dir`（dir 由 ankle 与 hip x 方向推断）

阈值（ratio）：
- warn：`> 0.07`
- fail：`>= 0.1` 且连续硬帧 `>= 3`

实现位置：
- 阈值定义：[realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/realtimeSquat.ts#L69-L71)
- 计算与即时提示：[realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/realtimeSquat.ts#L231-L241)
- rep 失败条件：[realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/realtimeSquat.ts#L431-L455)

数据位置：
- 实时：`feedback.issues`/`feedback.warnings` 会出现相关文案；rep 失败会写入 `lastRepReasonCodes`
- 会话累计：`feedback.session.kneeOverToeCount`
- 报告：作为 `issues[]` 文案频次统计的一部分写入 `report_json.issues[]`（见 `messageFreq` 汇总）  
  - [squatReport.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/analyzer/squatReport.ts#L39-L108)

---

## 5. 可视化高亮（关节高亮/箭头）
高亮数据来自：
- `feedback.issues[].joints`（即时 issues）
- `feedback.coreCorrections[].joints`（核心纠错分级）

绘制位置：
- [draw.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/draw.ts) 中 `drawIssueHighlights`

页面接入位置：
- [PoseToolPage.tsx](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/pages/PoseToolPage.tsx)

---

## 6. 可解释评分（score x/100，允许 null）
评分在报告构建阶段生成（不是每帧实时滚动的最终分数），核心规则：
- `avgTrackingQuality < 0.45` → `score=null`（tracking 不足）
- `gatedFramePct >= 0.6` → `score=null`（门控帧过多）
- `assessedReps < 2` → `score=null`（可评估 rep 不足）
- 否则：从 100 扣除各项 penalty（Depth/Knee/Heel/Torso/Tempo），得到 `0..100`

实现位置：
- [squatReport.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/analyzer/squatReport.ts#L339-L413)

数据位置：
- 报告（落库）：`report_json.keyMetrics.formScore`（数值或 null）
- 解释：`report_json.details.score = { value, reason, breakdown[] }`
- `scoreEligibility`：`report_json.keyMetrics.scoreEligibility`（eligible / reason）

---

## 7. 训练报告（report_json）与后端落库位置

### 7.1 报告结构（深蹲对齐报告，version=3）
生成位置：
- [squatReport.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/analyzer/squatReport.ts#L20-L193)

核心字段（与深蹲标准强相关）：
- `keyMetrics.totalReps/correctReps/incorrectReps/unassessedReps`
- `keyMetrics.formScore`（可为空）
- `keyMetrics.gatedFrames/gatedFramePct/topGateCode`
- `details.coreCorrections[]`（5 类纠错汇总 ratio）
- `details.score`（解释性评分 breakdown）
- `details.gating`（门控统计与 last gate）
- `details.timelineSampled`（用于回放/调试的采样时间线）

### 7.2 后端存储位置
训练结束保存接口：
- `POST /api/pose/trainings`：`data.report` 会写入 `TrainingSession.report_json`（落库前会进行 schema/大小校验与必要的 compact）  
  - [pose.py](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/backend/app/routes/pose.py#L280-L335)

查询接口：
- `GET /api/pose/trainings` / `GET /api/pose/trainings/<id>` 返回 `session.report`
  - [pose.py](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/backend/app/routes/pose.py#L337-L377)

---

## 8. 回归与 KPI 评估（本地工具对照）
工具入口（frontend）：
- 离线回放 runner：[pose-offline-runner.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/tools/pose-offline-runner.ts)
- 快照回归：[pose-snapshot-regress.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/tools/pose-snapshot-regress.ts)
- KPI 评估：[pose-kpi-eval.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/tools/pose-kpi-eval.ts)

标注格式（仓库只提供模板/示例，不含真实视频）：
- [ANNOTATION_FORMAT.md](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/benchmarks/pose-baseline/ANNOTATION_FORMAT.md)
