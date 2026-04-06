# FOODIDENTITY 。AI-FIT 全量功能比对报告

日期：026-04-05

## 丢、目。
本报告用于回答两个问题：

1. `foodidentity` 当前到底包含哪些核心 food 功能。2. 这些功能里，哪些已经迁入当前 `AI-FIT`，哪些只是部分迁移，哪些已经明确不再保留。
注意。- 本报告关注的是”`foodidentity` 。food 产品能力。`AI-FIT` 当前状态的对照”。- `AI-FIT` 本身还包含博它69”课程”用户中心”pose 等原生功能，这些不属于从 `foodidentity` 迁入的范围。
## 二””体结论

当前可以下结论：

- `foodidentity` 的核心价值主要集中在“今日饮食”览 + 餐次编辑 + 食物库查。+ 图片识别入餐 + meals 持久化”。- 这些核心能力已经基本完成正式迁移，并收敛至`AI-FIT` 的正式food 链路中。- 。`foodidentity` 相比，当。`AI-FIT` 已经不再保留 demo `userId` 方案，”是改为正式 JWT 用户体系，这属于正式化升级，不是缺失。- 与此同时，`AI-FIT` 已经明确下线 legacy `/tools/food`、`/api/diets`、`/api/nutrition`，说明本次不是”双系统并存”，而是正式 runtime 替换。
丢句话判断：- `AI-FIT` 已经迁入 `foodidentity` 的正式food 主链路。- 当前剩下的不是功能闭环缺口，而是文档、提交边界和历史目录是否继续保留的问题。
## 三”foodidentity 功能全景

结合已归档的功能分析、实施方案与迁移日志，`foodidentity` 当前可拆成以下模块：

### 1. 今日饮食总览。
`foodidentity` 包含。- 今日热量与三大营养素总览
- 四个餐次入口
- 当日已保存餐次列。- 删除餐次
- 跳转到餐次编辑页

证据：- [`FOODIDENTITY_核心功能盘点与迁移影响分析_2026-04-05.md`](/d:/trae/trae_projects/AI-FIT/info/food/FOODIDENTITY_核心功能盘点与迁移影响分析_2026-04-05.md)
- [`FOODIDENTITY_正式迁移实施方案_2026-04-05.md`](/d:/trae/trae_projects/AI-FIT/info/food/FOODIDENTITY_正式迁移实施方案_2026-04-05.md)

### 2. 餐次编辑主链。
`foodidentity` 包含。- 进入指定餐次编辑。- 查询 food 列表
- 按分类与关键词筛。- 。food 列表加入或移出餐。- 打开餐次抽屉
- 调整 grams
- 保存当前餐次
- 编辑已保存餐。
证据：- [`FOODIDENTITY_核心功能盘点与迁移影响分析_2026-04-05.md`](/d:/trae/trae_projects/AI-FIT/info/food/FOODIDENTITY_核心功能盘点与迁移影响分析_2026-04-05.md)
- [`FOODIDENTITY_正式迁移实施方案_2026-04-05.md`](/d:/trae/trae_projects/AI-FIT/info/food/FOODIDENTITY_正式迁移实施方案_2026-04-05.md)

### 3. 食物库查。
`foodidentity` 包含。- `GET /foods`
- `GET /foods/:id`
- `POST /foods/bulk`
- 支持 query / category / limit / offset

证据：- [`FOODIDENTITY_核心功能盘点与迁移影响分析_2026-04-05.md`](/d:/trae/trae_projects/AI-FIT/info/food/FOODIDENTITY_核心功能盘点与迁移影响分析_2026-04-05.md)
- [`FOODIDENTITY_正式迁移实施方案_2026-04-05.md`](/d:/trae/trae_projects/AI-FIT/info/food/FOODIDENTITY_正式迁移实施方案_2026-04-05.md)

### 4. meals 数据读写

`foodidentity` 包含。- `GET /meals/today`
- `GET /meals/:mealId`
- `POST /meals`
- `DELETE /meals/:mealId`
- 基于 `userId` + `mealType` + `recordedOn` 覆盖保存

证据：- [`FOODIDENTITY_核心功能盘点与迁移影响分析_2026-04-05.md`](/d:/trae/trae_projects/AI-FIT/info/food/FOODIDENTITY_核心功能盘点与迁移影响分析_2026-04-05.md)
- [`FOODIDENTITY_正式迁移实施方案_2026-04-05.md`](/d:/trae/trae_projects/AI-FIT/info/food/FOODIDENTITY_正式迁移实施方案_2026-04-05.md)

### 5. 图片识别入餐

`foodidentity` 包含。- 上传图片
- 调用 Stepfun 识别 food labels
- 。food match 逻辑映射内部 foods
- 返回 `foodIds`

证据：- [`FOODIDENTITY_核心功能盘点与迁移影响分析_2026-04-05.md`](/d:/trae/trae_projects/AI-FIT/info/food/FOODIDENTITY_核心功能盘点与迁移影响分析_2026-04-05.md)
- [`FOODIDENTITY_正式迁移实施方案_2026-04-05.md`](/d:/trae/trae_projects/AI-FIT/info/food/FOODIDENTITY_正式迁移实施方案_2026-04-05.md)

### 6. 不属于正式迁移目标的内容

`foodidentity` 还包含：
- `yolo_project/`
- `calorie_demo/`
- 独立 Docker / nginx / Express 部署包装
- demo `useUserId` 机制

这些在实施方案中已明确不纳入正式迁移目标。
## 四”AI-FIT 当前对应能力

当前 `AI-FIT` 中，。`foodidentity` 对应的能力主要来自以下部分：

### A. 已从 foodidentity 迁入或对齐的能力

- 正式 food 首页：`/food`
- 正式餐次页：`/food/meal/:mealType`
- 正式 food API。  - `/api/food/meta`
  - `/api/foods`
  - `/api/meals`
  - `/api/recognize`
- 正式 food 数据模型。  - `foods`
  - `meal_records`
  - `meal_items`
- 正式 meals 历史接口。  - `/api/meals/history`
- 正式用户绑定。  - meals 改为基于 JWT 身份，”不是客户端直接。`userId`

证据：- [`frontend/src/App.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/App.tsx#L33)
- [`frontend/src/App.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/App.tsx#L34)
- [`backend/app/__init__.py`](/d:/trae/trae_projects/AI-FIT/backend/app/__init__.py#L62)
- [`backend/app/__init__.py`](/d:/trae/trae_projects/AI-FIT/backend/app/__init__.py#L63)
- [`backend/app/__init__.py`](/d:/trae/trae_projects/AI-FIT/backend/app/__init__.py#L64)
- [`backend/app/__init__.py`](/d:/trae/trae_projects/AI-FIT/backend/app/__init__.py#L66)
- [`backend/app/models.py`](/d:/trae/trae_projects/AI-FIT/backend/app/models.py#L70)
- [`backend/app/models.py`](/d:/trae/trae_projects/AI-FIT/backend/app/models.py#L87)
- [`backend/app/models.py`](/d:/trae/trae_projects/AI-FIT/backend/app/models.py#L100)

### B. AI-FIT 当前。foodidentity 的正式化升级

- 认证。demo `userId` 切换为正式JWT
- 后端从独。Express + SQL 文件初始化，切到主项。Flask + SQLAlchemy + runtime seed
- 首页与餐次页改为主站风格页面，”不是保留原 demo UI
- profile 页饮食记录已切到正式 `/api/meals/history`

证据：- [`backend/app/routes/meals.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/meals.py#L59)
- [`backend/app/routes/meals.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/meals.py#L95)
- [`backend/app/routes/meals.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/meals.py#L127)
- [`frontend/src/pages/FoodModulePage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/FoodModulePage.tsx#L54)
- [`frontend/src/pages/FoodMealPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/FoodMealPage.tsx#L83)
- [`frontend/src/pages/ProfilePage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/ProfilePage.tsx#L193)

## 五”全量比对矩。
### 1. 今日饮食总览。
`foodidentity`。- 今日总览
- 四餐入口
- 当日已保存餐次列。- 删除餐次

`AI-FIT` 当前状态：
- 已有 `/food` 总览。- 已有四餐入口
- 已展。today summary
- 删除动作从首页移到餐次编辑页完成

结论。- `核心能力已迁移`
- `交互布局不完全同形，但正式语义已对齐`

### 2. 餐次编辑主链。
`foodidentity`。- 搜索 foods
- 分类筛。- 加入餐次
- grams 调整
- 保存 meal
- 编辑已保。meal

`AI-FIT` 当前状态：
- `/food/meal/:mealType` 已实。food 列表、分类筛选”加入移除”grams 调整、保存”删。- 会回填今日当前餐次已。meal
- 非法 mealType 路由有明确错误回逢

结论。- `已迁移`

### 3. 食物库查。
`foodidentity`。- `GET /foods`
- `GET /foods/:id`
- `POST /foods/bulk`

`AI-FIT` 当前状态：
- `GET /api/foods`
- `GET /api/foods/<id>`
- `POST /api/foods/bulk`
- 已有 runtime catalog 。seed 兼容。
结论。- `已迁移`

### 4. meals 数据读写

`foodidentity`。- `GET /meals/today`
- `GET /meals/:mealId`
- `POST /meals`
- `DELETE /meals/:mealId`
- 。`userId` 标识用户

`AI-FIT` 当前状态：
- 对应能力都已存在。`/api/meals/*`
- 额外新增 `/api/meals/history`
- 认证升级。JWT 用户身份
- 增加。items、非。foodId、非法日期的防御校验

结论。- `已迁移`
- `并且完成了正式化增强`

### 5. 图片识别入餐

`foodidentity`。- 上传图片
- Stepfun 识别
- food 匹配
- 返回 `foodIds`

`AI-FIT` 当前状态：
- `/api/recognize` 已承接该链路
- 返回 `names / foodIds / unmatchedNames`
- 配置缺失时返。`503 stepfun not configured`

结论。- `已迁移`
- `错误语义更清晰`

### 6. 用户标识机制

`foodidentity`。- 前端 `useUserId` 生成 demo 身份
- 后端信任客户端传。`userId`

`AI-FIT` 当前状态：
- 使用正式 JWT 身份
- meals 不再接受任意客户。`userId`

结论。- `未保留旧方案`
- `这是正式替换，不是缺失`

### 7. legacy food 链路

`foodidentity` / 。AI-FIT food。- 。`/tools/food`
- 。`/api/diets`
- 。`/api/nutrition`
- 。`FoodPage.tsx`
- 。`DietRecord`

`AI-FIT` 当前状态：
- `/tools/food` 已重定向。`/food`
- `/api/diets` 。`/api/nutrition` 已下线为 404
- `FoodPage.tsx` 已移。- `DietRecord` 已移。
结论。- `已完成旧链路逢场`

## 六”迁移状态”表

### 已迁。
- 今日饮食总览核心能力
- 餐次编辑核心链路
- foods 查询 / bulk 查询
- meals 保存 / 查询 / 删除
- 图片识别入餐
- 正式 food 数据模型
- profile 。food 数据源切换到正式 meals
- legacy food 运行入口下线

### 正式化增。
- demo `userId` -> JWT 用户身份
- 后端 seed 。runtime catalog 内置到主项目
- meals 增加 history 接口
- 日期 / foodId / 。items 校验更严。- 识别失败路径定义更清。
### 未保留且不应视为缺失

- `foodidentity/yolo_project/`
- `foodidentity/calorie_demo/`
- `foodidentity` 独立部署包装
- demo `useUserId` 机制

## 七”foodidentity 目录是否还能删除

从”运行时依赖”角度看。
- 当前正式前后端运行链路已经不依赖 `foodidentity/`。- 删除该目录后，正式`/food` 。`/api/food*` 运行逻辑本身不应受影响。
但从“当前仓库状态”角度看。
- 只要先完成文档归档与失效链接清理，就可以删除。`foodidentity/` 目录。- 目录下的实施方案与历史分析文档，当前仍然是本次迁移的源文档。
更准确的结论是：

- `运行时层面：可以脱离`
- `仓库整理层面：暂不建议立刻物理删除`

如果后续决定彻底删除，建议先完成。
1. 将需要保留的 `foodidentity` 文档迁入 `info/` 或归档目录。2. 更新扢有引。`foodidentity/` 的文档与注释。3. 再统丢删除 `foodidentity/` 目录。
## 八”最终判。
如果比较对象。`foodidentity` 的正式food 产品能力。`AI-FIT` 当前状态，那么现在的真实状态是。
- `foodidentity` 的正式food 主链路已经迁。AI-FIT。- `AI-FIT` 已经不是“继续挂睢。food 方案跑”的状态，而是“正式runtime 已切换完成”的状态。- 当前剩余问题主要是文档收口”提交边界和历史源目录是否归档，而不。food 功能是否迁完。


