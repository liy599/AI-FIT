# 实时矫正·深蹲（Squat）产品化分阶段路线图（Roadmap）

## 背景与目标
本路线图只聚焦 **动作矫正 → 实时矫正 → 深蹲（Squat）** 做到“稳定可靠、可规模化”的产品级质量。深蹲作为样板动作：**框架（数据流、UI、报告、存储、测试、监控）与其他动作一致**，差异主要在“矫正算法与阈值/特征”。

### 产品成功标准（最终态）
- **计次可靠**：各种常见机位、光照、服饰与体型条件下，rep 计数稳定（可量化）。
- **纠错可信**：主要错误类型覆盖完整，误报可控，并提供可解释证据（Evidence）。
- **用户体验闭环**：上手校准 → 训练中实时反馈 → 训练后报告与历史可追踪 → 可复盘迭代。
- **工程可扩展**：新增动作只需要替换 Analyzer 与少量 UI 文案，不复制粘贴大量逻辑。

## 当前实现快照（便于对齐缺口）
- 实时入口与 UI：Pose 工具页（Live Coaching）[PoseToolPage.tsx](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/pages/PoseToolPage.tsx)
- 深蹲实时分析器：状态机计次 + 部分错误规则 [realtimeSquat.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/realtimeSquat.ts)
- 实时姿态提供方：MoveNet（浏览器端）[livePoseProvider.ts](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/lib/pose/livePoseProvider.ts)
- 训练记录入库：`POST /api/pose/trainings` [pose.py](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/backend/app/routes/pose.py)
- 报告展示：训练报告页（含 AI 卡片）[PoseTrainingReportPage.tsx](file:///Users/zjl/Desktop/Study/Program/4-2/TRAE/AI-FIT/frontend/src/pages/PoseTrainingReportPage.tsx)

## 原则（适用于所有动作）
1. **质量门控优先于“硬判断”**：低质量帧/非侧视角/遮挡严重时，宁可输出“无法可靠判断”也不要误判。
2. **可解释性是信任的核心**：每条问题必须可追溯到 rep/阶段/关键角度区间/证据文本。
3. **单一真源（Single Source of Truth）**：阈值、错误类型定义、建议映射、报告 schema 统一来源，禁止多处散落。
4. **可量化验收**：所有“更稳定/更准确”必须落到 KPI 与可复现的基准集回归。

---

## Phase 0 — 准备工作（现在就做，1–3 天量级）
目标：把“能跑”变成“能衡量、能回归、能扩展”的工程底座。

### 0.1 定义数据契约（Contracts）
- 训练中实时反馈结构：明确哪些字段必须真实产出，哪些字段允许为空；禁止“默认 0/空数组”冒充真实统计。
- 报告最小 schema（对 UI）：统一字段、类型、语义、默认值策略（如 `score: number|null`）。
- 质量门控的状态码：例如 `OK / LOW_LIGHT / OUT_OF_FRAME / WRONG_ANGLE / LOW_CONFIDENCE`，用于 UI 提示与日志统计。

### 0.2 建立基准集与标注规范（必须）
- 建立 `squat-benchmark` 数据集（私有，不进入 git）：至少 50 段短视频（不同人群/角度/光照/遮挡）。
- 标注内容（最小可用）：
  - rep 数（ground truth）
  - 关键错误类型（深度不足、膝内扣、脚跟抬起、躯干前倾、节奏失衡…）
  - 错误发生 rep 区间（例如 rep 4–6）
- 输出形式：CSV/JSON（统一格式），后续用于自动回归。

### 0.3 回归工具链
- 离线回放 runner（只跑算法，不跑 UI）：输入 landmark 序列或视频抽帧后的 landmark，输出报告 JSON。
- 快照回归：同一基准输入 → 输出报告对比（允许阈值内浮动的指标要定义容忍区间）。

### 0.4 监控与可观测性（最小集）
- 统计：有效帧占比、门控原因分布、平均 FPS、用户中断率。
- 崩溃/异常：前端关键路径 try/catch + 后端入库错误与 report 体积报警。

交付物（Phase 0）
- 一份“Squat Report Schema + QA Status Code”文档
- 一套私有 benchmark 与标注格式
- 一个可跑的回归 runner（本地）

---

## Phase 1 — 可靠可用（MVP→可交付，2–4 周量级）
目标：把深蹲的核心问题覆盖到“用户不会觉得瞎说”，并显著降低误判。

### 1.1 计次与阶段识别增强
- 计次门控：低质量时禁止推进状态机/禁止计次；恢复质量后再继续。
- 阶段稳定：加入去抖（debounce）与最小持续帧数，避免抖动导致误触发。
- 输出 rep 级别置信度：每个 rep 给出 `assessed | unassessed` 与原因。

### 1.2 核心纠错覆盖（必须覆盖的 5 类）
- 深度不足（Depth insufficient）
- 膝内扣/外翻（Knee valgus/varus）
- 脚跟抬起（Heel lift）
- 躯干前倾（Torso lean）
- 节奏失衡/后程崩盘（Tempo & fatigue drift）

每类都要有：
- 判定特征（角度/比值/轨迹）
- 门控条件（何时不判断）
- 分级（info/warn/error 或 light/medium/severe）
- 建议映射（可执行、短句、最多 3 条）
- Evidence（数值或 rep/阶段描述）

### 1.3 侧视角与距离校准闭环
- 侧视角不合格：强提示并暂停评分/纠错输出（或降级输出）。
- 距离不合格：明确提示“请后退/调整镜头”，同时暂停计次。

### 1.4 UI 解释性提升（仍保持简洁）
- 骨架高亮：对问题关节上色/加箭头（不要只给文字）。
- 只提示最关键 1–2 个问题（新手模式），避免信息过载。

交付物（Phase 1）
- 基准集回归：rep MAE 与主要错误 precision/recall 达到预设门槛
- 真实用户试用：误判率显著下降；“不可信提示”替换成明确门控原因

---

## Phase 2 — 产品级可靠（可商用，4–8 周量级）
目标：在更多真实环境下稳定运行，并把“可信”变成一致体验。

### 2.1 个体差异自适应
- 身高/比例差异：阈值从“绝对角度”向“相对比例 + 个体基线”过渡（例如取前 3 次 rep 的均值作为基线）。
- 左/右侧与镜像：自动识别并统一坐标方向，避免左右判定反了。

### 2.2 评分体系（score x/100，上线前必须可解释）
- 分数必须能解释：由“质量门控（可判断）”与“错误严重度/频次”构成。
- 分数允许为空（null）：当质量不足或样本不足时不评分。

### 2.3 报告体系收敛与一致性
- “实时报告”与“训练报告页”字段对齐：保证同一 session 的展示一致。
- History 支持按天/按动作筛选，形成可追踪闭环。

### 2.4 数据存储与成本控制
- report 入库前做 schema/大小校验；必要时只存摘要与统计，timeline 单独存或采样。
- 增加“重算报告”能力：算法升级后可对历史记录重新生成。

交付物（Phase 2）
- 一套可解释评分体系（含产品说明）
- 存储成本可控（report 大小有上限与降采样策略）
- 可对历史记录重算并保持兼容

---

## Phase 3 — 可规模化扩展（多动作复用框架，长期）
目标：深蹲成为模板，其他动作只替换 Analyzer + 少量配置即可接入。

### 3.1 Analyzer 插件化
- 统一接口：`analyze(frame) -> feedback`、`resetSession()`、`buildReport()`
- 统一错误码与建议映射机制：动作只提供“特征提取 + 规则/模型”，框架负责落库/展示/报告。

### 3.2 自动化测试与发布流程
- 每个动作都有 benchmark 子集与回归快照
- CI：typecheck/build + 后端 pytest +（可选）离线 runner 回归

### 3.3 运营与增长（可选）
- 新手引导、挑战模式、训练计划
- 训练报告可导出（PDF）与分享

交付物（Phase 3）
- 新动作接入时间显著下降（例如 1–3 天可出 MVP）
- 每个动作都有可量化质量指标与回归保障

---

## 立即开始的准备清单（下一步执行顺序）
1. 明确“深蹲实时”的必达 KPI（rep MAE、错误检测 precision/recall、无法判断率、平均 FPS）。
2. 建立私有 benchmark 数据集与标注格式（先 50 段起步）。
3. 定义统一报告 schema（深蹲作为第一个版本），并让前端展示完全依赖 schema（无隐藏逻辑）。
4. 实现质量门控闭环（不满足条件就暂停计次/不评分/明确提示原因）。
5. 为 5 类核心错误补齐：判定→证据→建议→UI 高亮→回归验证。

