# FOODIDENTITY 正式迁移实施方案

日期：026-04-05

关联文档。- [FOODIDENTITY_核心功能盘点与迁移影响分析_2026-04-05.md](/d:/trae/trae_projects/AI-FIT/info/food/FOODIDENTITY_核心功能盘点与迁移影响分析_2026-04-05.md)

## 1. 方案定位

本方案以 [FOODIDENTITY_核心功能盘点与迁移影响分析_2026-04-05.md](/d:/trae/trae_projects/AI-FIT/info/food/FOODIDENTITY_核心功能盘点与迁移影响分析_2026-04-05.md) 为唯丢指导口径。
核心原则。- 业务基线。`foodidentity` 为主。- 正式抢术架构以主项目为主。- 主项目只继承 `foodidentity` 的核心能力，不继续依。`foodidentity` 目录运行。- 迁移完成后，`foodidentity` 目录应可整体清理。
本方案不是”两个系统并存联动方案”，而是“把 `foodidentity` 作为来源项目，完整收编进主项目”的实施方案。
## 2. 迁移目标

目标定义。- 在主项目中落地一个正式的 food 模块”- 该模块的业务流程、接口语义”数据库结构。`foodidentity` 为主。- 该模块的页面视觉、导航”整体外观对齐主项目。- 最终主项目独立运行，不再依。`foodidentity` 目录中的代码、脚本”静态资源和服务。
迁移完成后的正式能力范围。- 图片上传识别食物
- 识别结果匹配内部食物。- 按分类和关键字查询食。- 早餐 / 午餐 / 晚餐 / 加餐记录
- 餐次项克数调。- 当日营养汇。- 按餐次查看”编辑”删。
## 3. 非目。
以下内容不纳入本次正式迁移实施范围：
- `foodidentity/yolo_project/` 。YOLO 实验链路
- `foodidentity/calorie_demo/` 的独。Python demo
- 。`foodidentity` 原样当成子应用长期挂在主项目。- 以反向代理”iframe、跨目录 import 的方式完成”伪集成。- 保持 `foodidentity` 目录作为未来运行时依。
## 4. 迁移完成的判定标。
只有满足以下条件，才视为迁移完成。
1. 主项目中存在正式 food 模块前端页面与正式API。2. 主项目数据库中存在正式food 模块扢霢表结构。3. 主项目启动”构建”部署时不依。`foodidentity` 目录。4. 删除 `foodidentity` 目录后，主项目仍可独立运行。5. `foodidentity` 中的核心功能已被主项目等价承接。
## 5. 总体迁移策略

采用“三层迁。+ 丢次收口”策略。
### 5.1 三层迁移

三层分别为：
- 前端交互。- 后端接口。- 数据模型。
迁移思路。- 前端交互层：保留 `foodidentity` 的业务流程，重做为主站风格页。- 后端接口层：。`foodidentity` 的接口语义为蓝本，在主项目后端中重建
- 数据模型层：。`foodidentity` 的结构化 food 数据方案为蓝本，落到主项目正式数据库

### 5.2 丢次收。
含义。- 从第丢版正式迁移开始，代码就直接落到主项目目录。- 不做“先挂载 `foodidentity`，后续再迁”的长期过渡方案
- 不形成双系统并行维护

## 6. 主项目中的目标落。
以下是建议的正式落位方向。
说明。- 这里强调“落位原则”，不是强制具体文件名。- 若后续你们希望我实际实施，可以再按现有主项目目录生成具体文件清单。
### 6.1 前端落位

目标。- food 模块页面、组件”状态”API 调用封装全部进入主项。`frontend/`。
建议落位。- 页面。  - `frontend/src/pages/` 下新增正式food 模块页面
- 组件。  - `frontend/src/components/food/` 或类似目。- API 封装。  - `frontend/src/lib/` 下新。food 模块 API 文件
- 类型定义。  - `frontend/src/types/` 。`frontend/src/lib/` 下新。food 类型

要求。- 不再引用 `foodidentity/src/*`
- 不直接复。`foodidentity` 页面文件路径
- 样式、布屢、路由统丢纳入主项目前端体。
### 6.2 后端落位

目标。- food 模块接口、识别”辑、匹配”辑全部进入主项目正式后端。
建议落位。- `backend/app/routes/` 下新。food 模块蓝图
- `backend/app/services/food/` 或类似目录放识别与匹配”辑
- `backend/app/models.py` 或拆分模型文件中新增 food 模块相关模型

要求。- 不再依赖 `foodidentity/api/*`
- 不保留单独的 `foodidentity` Express 服务作为运行依赖
- 不”过调用本地 `foodidentity` 服务转发请求来完成集。
### 6.3 数据库落。
目标。- `foods / meal_records / meal_items` 进入主项目正式数据库结构

建议落位。- 主项目正式数据库初始化或迁移体系
- 不再。`foodidentity/db/init.sql` 作为唯一有效来源

要求。- 表结构归属主项目
- 初始化数据归属主项目
- 后续 schema 变更归属主项。
## 7. 迁移对象拆解

## 7.1 霢要迁移的核心对象

### A. 食物识别链路

来源。- `foodidentity/api/routes/recognize.ts`
- `foodidentity/api/utils/stepfun.ts`

迁移要求。- 保留提示词约束”想
- 保留返回 JSON 容错解析能力
- 保留图片上传识别接口能力
- 在主项目正式后端中重。
### B. 食物匹配逻辑

来源。- `foodidentity/api/utils/foodMatch.ts`
- `foodidentity/api/utils/text.ts`

迁移要求。- 保留文本归一化规。- 保留别名、包含”Jaccard、编辑距离综合匹配策。- 迁移为主项目正式业务服务模块

### C. 食物库模。
来源。- `foodidentity/db/init.sql`
- `foodidentity/api/routes/foods.ts`

迁移要求。- 保留 `foods` 结构化主表设。- 保留食物分类、别名”营养字。- 保留查询与批量查询接口能。
### D. 餐次记录模型

来源。- `foodidentity/db/init.sql`
- `foodidentity/api/routes/meals.ts`

迁移要求。- 保留 `meal_records`
- 保留 `meal_items`
- 保留按用户”日期”餐次覆盖保存语。- 保留按日汇”与按餐编辑能力

### E. 前端交互模型

来源。- `foodidentity/src/pages/Home.tsx`
- `foodidentity/src/pages/Meal.tsx`
- `foodidentity/src/components/meal/*`

迁移要求。- 保留按餐次进入的流程
- 保留图片识别加入食物的流。- 保留抽屉式克数编辑和统一保存体验
- UI 风格重做为主站风格，不保留原始视觉样。
## 7.2 不迁移或仅参考的对象

### A. YOLO 实验环境

来源。- `foodidentity/yolo_project/`

处理方式。- 不进入本次正式迁。
### B. 独立 calorie demo

来源。- `foodidentity/calorie_demo/`

处理方式。- 不进入本次正式迁。
### C. 独立部署包装

来源。- `foodidentity/Dockerfile`
- `foodidentity/docker-compose.yml`
- `foodidentity/nginx/`

处理方式。- 只作参。- 不作为必须保留的正式交付。
### D. demo 用户 ID 机制

来源。- `foodidentity/src/hooks/useUserId.ts`

处理方式。- 正式迁移时废。- 替换为主项目正式用户体系接入方式

## 8. 实施阶段划分

建议拆成四个阶段。
## 8.1 第一阶段：迁移设计落。
目标。- 确认主项目中 food 模块的正式目录归属”页面入口”后端蓝图归属”数据库归属

产出。- food 模块前端目录
- food 模块后端目录
- food 模块数据表定义方。- 环境变量清单

完成标准。- 明确正式代码应写入主项目哪里
- 明确 `foodidentity` 中哪些内容是迁移来源，哪些不。
## 8.2 第二阶段：后端与数据库迁。
目标。- 先把正式业务骨架迁入主项。
内容。- 建立 `foods` 。- 建立 `meal_records` 。- 建立 `meal_items` 。- 建立识别接口
- 建立 foods 查询接口
- 建立 meals 保存 / 查询 / 删除 / 当日汇”接。- 接入正式用户身份

完成标准。- 主项目后端已经可以在不依。`foodidentity` 的情况下单独提供完整 food API

## 8.3 第三阶段：前端主站化重做

目标。- 用主项目视觉风格实现 `foodidentity` 的交互闭。
内容。- food 首页总览
- 餐次。- 食物列表与搜。- 识别入口
- 餐次抽屉
- 保存与回。
完成标准。- 主项目中已经具备可用。food 模块页面
- 页面调用的是主项目自己的 API

## 8.4 第四阶段：去 foodidentity 依赖收口

目标。- 确保 `foodidentity` 不再是运行依。
内容。- 棢查是否仍有跨目录引用
- 棢查是否仍依赖 `foodidentity` 。SQL 文件
- 棢查是否仍要求启动 `foodidentity` 服务
- 清理重复文档和无效脚。
完成标准。- 删除 `foodidentity` 目录后主项目仍能构建与运。
## 9. 详细实施清单

## 9.1 前端实施清单

1. 在主项目前端新增正式 food 模块页面入口。2. 以主站风格重做”今日”览页”。3. 以主站风格重做”餐次编辑页”。4. 抽离食物列表、食物工具栏、餐次抽屉等组件到主项目前端目录。5. 在主项目前端新增 food 模块 API 封装。6. 接入图片上传识别。7. 接入当日汇”与餐次编辑回显。8. 替换 demo 用户 ID 机制为主项目正式用户态。
## 9.2 后端实施清单

1. 在主项目后端新增 food 模块路由。2. 实现识别接口。3. 实现 food 查询接口。4. 实现 food 批量查询接口。5. 实现。food 查询接口。6. 实现 meals 保存接口。7. 实现 meals 当日汇”接口。8. 实现 meal 明细查询接口。9. 实现 meal 删除接口。10. 实现识别结果到内。food 实体的匹配服务。
## 9.3 数据库实施清。
1. 在主项目正式数据库中建立 `foods`。2. 在主项目正式数据库中建立 `meal_records`。3. 在主项目正式数据库中建立 `meal_items`。4. 导入 food 基础样本数据。5. 为后续扩充词库预留别名与分类能力。6. 。food 模块初始化脚本纳入主项目自己的数据库管理路径。
## 9.4 配置实施清单

1. 。Stepfun 相关环境变量纳入主项目正式配置。2. 在主项目文档中补。food 模块运行说明。3. 在主项目部署脚本中纳。food 模块扢霢环境变量与初始化步骤。
## 10. 认证与用户接入策。
原则。- 正式模块不再使用 `demo_xxx` 方案。- 正式模块扢。meal 数据都必须与主项目正式用户绑定。
落地要求。- meals 查询与保存基于主项目正式用户身份
- 前端不再手动生成 userId
- 后端不再信任客户端直接传入任。userId

这部分属于接入改造，不影。`foodidentity` 作为业务基线。
## 11. 接口迁移策略

原则。- 接口语义尽量保持 `foodidentity` 原设。- 但接口实现落在主项目正式后端。
建议保留的接口族。- `recognize`
- `foods`
- `meals`

原因。- 它们是围绕同丢业务闭环设计出来。- 改得过多会破坏前后端协同结构

允许调整的内容：
- 鉴权接入方式
- 响应包裹字段命名细节
- 主项目统丢错误处理方式

不建议调整的内容。- 按餐次组织的业务语义
- 食物库与 meal 记录的结构化关系
- 当日汇”的核心返回模型

## 12. 数据迁移策略

本次更准确地说是“功能与结构迁移”，不是历史数据迁移。
因此当前建议。- 先迁 schema
- 再迁基础 food 样本数据
- 不把 `foodidentity` 目录中的本地 demo 数据当作长期依赖

如果后续存在历史 food 记录数据迁移霢求，可再单独补充数据迁移方案。
## 13. 风险控制

## 13.1 识别链路风险

风险。- 外部模型输出不稳。
措施。- 保留现有提示词约束与 JSON 容错解析
- 前端增加人工确认兜底

## 13.2 词库规模风险

风险。- food 样本数据不足

措施。- 先保证链路完。- 再进行食物库扩容

## 13.3 迁移过程中出现”伪完成。
风险。- 页面看起来可用，但底层仍调用 `foodidentity`

措施。- 把”删。`foodidentity` 后仍可运行”作为强制验收项

## 13.4 前端风格重做破坏原闭。
风险。- 套壳时把操作路径改复。
措施。- 视觉可重做，交互闭环尽量保持不变

## 14. 最终清理方。
在正式迁移完成后，建议执行一。`foodidentity` 清理收口。
清理前提。- 主项目已独立承接全部正式能力
- 已确认没有目录级依赖

清理对象。- `foodidentity/src/`
- `foodidentity/api/`
- `foodidentity/db/`
- `foodidentity/nginx/`
- `foodidentity/yolo_project/`
- `foodidentity/calorie_demo/`
- `foodidentity/package.json` 及其附属前后端运行文。
保留建议。- 如有必要，只保留迁移说明文档到主项目 `info/` 或正式文档目。- 不建议长期保留整。`foodidentity` 工程

## 15. 建议的验收清。
验收时至少检查以下内容：

1. 主项。food 页面可正常访问。2. 主项目后端可独立处理 food 识别、foods 查询、meals 记录。3. 主项目数据库中存在正式food 模块表结构。4. 用户可完成”识。-> 选品 -> 调整克数 -> 保存 -> 汇”查看”全流程。5. 全流程不调用 `foodidentity` 目录中的运行时代码。6. 删除或重命名 `foodidentity` 目录后，主项目仍可启动。
## 16. 丢句话执行结论

执行上应。`foodidentity` 视为 food 模块的来源工程，而不是未来并行子系统；实施重点不是””么接上去”，而是“”么完整迁进主项目并最终删。`foodidentity`”。


