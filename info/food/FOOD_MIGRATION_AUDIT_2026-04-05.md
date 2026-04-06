# FOOD Migration Audit

日期：026-04-05

审查范围：- 对照 [`FOODIDENTITY_正式迁移实施方案_2026-04-05.md`](/d:/trae/trae_projects/AI-FIT/info/food/FOODIDENTITY_正式迁移实施方案_2026-04-05.md) 审查 food 正式迁移目标是否已经真实落地
- 交叉核对 `info/FOOD_MIGRATION_LOG.md` 中记录的迁移过程
- 核查当前AI-FIT 前后端实现是否与日志结论一致。- 判断当前状态是否已经达到“正式food 运行时收敛”，以及还剩哪些提交前风险。
本次基于代码与测试记录确认的验证项：
- `frontend`：`npm.cmd run typecheck` 已在迁移日志中记录通过
- `backend`：`.\.venv\Scripts\python.exe -m pytest tests/test_food.py tests/test_food_recognize.py -q` 已在迁移日志中记录通过
- legacy API 探针：`/api/food/meta -> 200`、`/api/foods -> 200`、`/api/diets -> 404`、`/api/nutrition/analyze -> 404`

## 一、执行结果
当前结论比较明确：
- 这次 food 迁移已经完成了“正式运行时收敛”，不是停留在迁移设计或双链路并存阶段。- 前端正式入口已经收敛至`/food` 。`/food/meal/:mealType`，旧 `/tools/food` 只保留兼容重定向。- 后端正式入口已经收敛至`/api/food`、`/api/foods`、`/api/meals`、`/api/recognize`，旧 `/api/diets` 。`/api/nutrition` 已彻底退出运行时。- 正式数据模型已经切到 `foods / meal_records / meal_items`，旧 `DietRecord` 已从代码主干移除。
更准确的状态表述应为：

- `正式 food 运行链路已完成`
- `legacy food 运行入口已下线`
- `foodidentity 已不再是当前正式运行时依赖`
- `仓库仍有少量提交边界与安全性问题需要在最终提交前单独处理`

一句话总结：
- 如果标准是“AI-FIT 是否已经具备独立运行的正式food 模块”-> 是- 如果标准是”这一批改动是否可以不加筛选直接整体提交”-> 还不建议

## 二”主要发现
### 高优先级问题

1. `backend/.env.example` 当前包含具体。`STEPFUN_API_KEY`，这属于提交安全风险，不应混入本次food 迁移提交。
证据：- [`backend/.env.example`](/d:/trae/trae_projects/AI-FIT/backend/.env.example#L7)
- [`backend/.env.example`](/d:/trae/trae_projects/AI-FIT/backend/.env.example#L8)
- [`backend/.env.example`](/d:/trae/trae_projects/AI-FIT/backend/.env.example#L9)

影响：- 即使 food 迁移本身已经完成，带真实样式的密钥仍会污染提交边界。- 这类变更不属。food 迁移核心功能，且会给后续仓库安全审计带来额外风险。
判断：- `不影响迁移完成度`
- `影响最终提交安全性`

### 中优先级问题

1. 仓库里仍有与 food 主线无直接关系的并行改动，当前不适合整体打包提交。
证据：- `git status` 中仍有这些非 food 核心改动：  - `backend/app/config.py`
  - `backend/.env.example`
  - `frontend/src/components/Footer.tsx`
  - `frontend/src/components/Navbar.tsx`
  - `frontend/src/pages/HomePage.tsx`
  - `foodidentity/`
  - `info/FOOD_MIGRATION_STAGE1_DESIGN_2026-04-05.md`

影响：- 会模糊本次food 迁移的提交边界。- 会让代码审查者难以区分”food 正式迁移事实”与“仓库里原本存在的其他改动”。
判断：- `不影响当前运行时结论`
- `影响提交清晰度`

2. 仓库文档中仍有陈旧描述，说明运行时已经完成收敛，但文档体系尚未完全同步。
证据：- [`info/PROJECT_STATUS.md`](/d:/trae/trae_projects/AI-FIT/info/project/PROJECT_STATUS.md#L68)
- [`info/PROJECT_STATUS.md`](/d:/trae/trae_projects/AI-FIT/info/project/PROJECT_STATUS.md#L72)

影响：- 代码事实已经显示 legacy API 下线，但部分项目状态文档仍提到 `/api/diets` 。`/api/nutrition`。- 会”成“日志”代码”状态文档”三者表述不完全丢致。
判断：- `不是迁移阻塞项`
- `属于后续文档收口项`

### 低优先级问题

1. `ProfilePage` 已经切到正式 meals 历史接口，但该文件本身仍存在历史编码问题，不宜作为本次food 迁移质量结论的反向证据。
证据：- [`frontend/src/pages/ProfilePage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/ProfilePage.tsx#L193)
- [`frontend/src/pages/ProfilePage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/ProfilePage.tsx#L194)
- [`frontend/src/pages/ProfilePage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/ProfilePage.tsx#L412)

影响：- 该页已经不再依赖 `/api/diets`，这丢点是正向完成项。- 但页面中残留的历史编码问题说明这部分属于仓库已有质量债，不建议把它与本次 food 迁移主线混为丢谈。
判断：- `不构。food 迁移失败`
- `属于独立前端质量债`

## 三”对齐矩。
### 1. 正式前端入口

状态：`已对齐`

已确认完成：

- 正式入口。`/food`
- 正式餐次页为 `/food/meal/:mealType`
- `/tools/food` 已改为重定向。`/food`

证据：- [`frontend/src/App.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/App.tsx#L33)
- [`frontend/src/App.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/App.tsx#L34)
- [`frontend/src/App.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/App.tsx#L36)

结论。- 前端正式运行面已经完成单入口收敛至
### 2. 正式后端入口

状态：`已对齐`

已确认完成：

- 注册正式 `food / foods / meals / recognize` 蓝图
- 未继续注。`diets` 。`nutrition`

证据：- [`backend/app/__init__.py`](/d:/trae/trae_projects/AI-FIT/backend/app/__init__.py#L47)
- [`backend/app/__init__.py`](/d:/trae/trae_projects/AI-FIT/backend/app/__init__.py#L48)
- [`backend/app/__init__.py`](/d:/trae/trae_projects/AI-FIT/backend/app/__init__.py#L49)
- [`backend/app/__init__.py`](/d:/trae/trae_projects/AI-FIT/backend/app/__init__.py#L51)
- [`backend/app/__init__.py`](/d:/trae/trae_projects/AI-FIT/backend/app/__init__.py#L62)
- [`backend/app/__init__.py`](/d:/trae/trae_projects/AI-FIT/backend/app/__init__.py#L63)
- [`backend/app/__init__.py`](/d:/trae/trae_projects/AI-FIT/backend/app/__init__.py#L64)
- [`backend/app/__init__.py`](/d:/trae/trae_projects/AI-FIT/backend/app/__init__.py#L66)

结论。- legacy API 已经从运行时注册层面逢出。
### 3. 正式数据模型

状态：`已对齐`

已确认完成：

- 新模型落。`foods`
- 新模型落。`meal_records`
- 新模型落。`meal_items`
- `User` 关联切到 `food_meal_records`
- `DietRecord` 已从主干移除

证据：- [`backend/app/models.py`](/d:/trae/trae_projects/AI-FIT/backend/app/models.py#L48)
- [`backend/app/models.py`](/d:/trae/trae_projects/AI-FIT/backend/app/models.py#L70)
- [`backend/app/models.py`](/d:/trae/trae_projects/AI-FIT/backend/app/models.py#L87)
- [`backend/app/models.py`](/d:/trae/trae_projects/AI-FIT/backend/app/models.py#L100)

结论。- food 数据模型已经迁入 AI-FIT 正式主干，不再依附旧 diets 模型。
### 4. meals 正式闭环

状态：`已对齐`

已确认完成：

- `GET /api/meals/today`
- `GET /api/meals/history`
- `GET /api/meals/<id>`
- `POST /api/meals`
- `DELETE /api/meals/<id>`
- meals 接口基于 JWT 用户身份
- 。items、非。foodId、非法日期会被明确拒。
证据：- [`backend/app/routes/meals.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/meals.py#L59)
- [`backend/app/routes/meals.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/meals.py#L95)
- [`backend/app/routes/meals.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/meals.py#L117)
- [`backend/app/routes/meals.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/meals.py#L127)
- [`backend/app/routes/meals.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/meals.py#L185)
- [`backend/tests/test_food.py`](/d:/trae/trae_projects/AI-FIT/backend/tests/test_food.py#L30)
- [`backend/tests/test_food.py`](/d:/trae/trae_projects/AI-FIT/backend/tests/test_food.py#L79)
- [`backend/tests/test_food.py`](/d:/trae/trae_projects/AI-FIT/backend/tests/test_food.py#L96)
- [`backend/tests/test_food.py`](/d:/trae/trae_projects/AI-FIT/backend/tests/test_food.py#L113)

结论。- meals 已具备正式可用的保存、查诃69”删除与历史查询能力，不再是 legacy 兼容层。
### 5. recognize 正式链路

状态：`已对齐`

已确认完成：

- `POST /api/recognize` 直接。AI-FIT 后端提供
- 缺少 Stepfun 配置时返。`503 stepfun not configured`
- 成功时返。`names / foodIds / unmatchedNames`

证据：- [`backend/app/routes/recognize.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/recognize.py#L12)
- [`backend/app/routes/recognize.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/recognize.py#L18)
- [`backend/app/routes/recognize.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/recognize.py#L31)
- [`backend/app/routes/recognize.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/recognize.py#L41)
- [`backend/tests/test_food_recognize.py`](/d:/trae/trae_projects/AI-FIT/backend/tests/test_food_recognize.py#L23)

结论。- recognize 正式入口已经迁入主项目，且失败路径有明确行为定义。
### 6. 正式首页与餐次页承接

状态：`已对齐`

已确认完成：

- `/food` 已承接今日概览与四餐入口
- `/food/meal/:mealType` 已承接搜紃69”识别”加餐”克数调整”保存”删。- 非法餐次路由会明确提示，而不是静默回逢

证据：- [`frontend/src/pages/FoodModulePage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/FoodModulePage.tsx#L54)
- [`frontend/src/pages/FoodModulePage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/FoodModulePage.tsx#L173)
- [`frontend/src/pages/FoodModulePage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/FoodModulePage.tsx#L261)
- [`frontend/src/pages/FoodMealPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/FoodMealPage.tsx#L83)
- [`frontend/src/pages/FoodMealPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/FoodMealPage.tsx#L210)
- [`frontend/src/pages/FoodMealPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/FoodMealPage.tsx#L255)
- [`frontend/src/pages/FoodMealPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/FoodMealPage.tsx#L280)
- [`frontend/src/pages/FoodMealPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/FoodMealPage.tsx#L303)

结论。- 正式 food 前端页面已经不是占位页，而是具备业务闭环的正式承接面。
### 7. 。`foodidentity` 的运行时依赖

状态：`已对齐`

已确认完成：

- 正式运行时代码未再直。import `foodidentity`
- seed 。runtime catalog 已落到主项目后端
- 实施方案要求的”主项目独立承接正式 food 能力”已基本满足

证据：- [`backend/app/__init__.py`](/d:/trae/trae_projects/AI-FIT/backend/app/__init__.py#L8)
- [`backend/app/__init__.py`](/d:/trae/trae_projects/AI-FIT/backend/app/__init__.py#L80)
- [`backend/app/routes/food.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/food.py#L21)
- 代码棢索未发现当前正式前后端运行时代码直接依赖 `foodidentity` 目录

结论。- `foodidentity` 当前更接近”迁移来源工程”，而不是正式运行时依赖。
## 四”不应误判为迁移失败的问。
以下内容不应算作本次 food 迁移失败。
- `foodidentity/` 目录仍存在工作区
  - 迁移方案要求的关键点是”正式运行时不再依赖它”，不是必须在本轮立刻物理删除整个目录。- `ProfilePage`、`Navbar`、`Footer`、`HomePage` 等文件仍有并行改。  - 这会影响提交边界，但不推翻正式food 链路已经收敛的事实。- 识别接口在未配置 Stepfun 时返。`503`
  - 这是明确设计的配置前置条件，不是迁移未完成。
## 五”最终评。
当前 food 迁移完成度可分为。
- `正式运行时收敛度`：高
- `与实施方案的丢致”`：高
- `legacy 运行面清理完成度`：高
- `最终提交边界清晰度`：中
- `提交前安全卫生状态`：中偏低

建议的最终动作顺序：

1. 先将 [`backend/.env.example`](/d:/trae/trae_projects/AI-FIT/backend/.env.example#L8) 中的 `STEPFUN_API_KEY` 改回显式占位符，再决定是否纳入本次提交”2. 严格。food 主线筛”提交文件，不要。`backend/app/config.py`、`foodidentity/` 与其他并行改动默认混入。3. 如需补文档一致”，再同步更。[`info/PROJECT_STATUS.md`](/d:/trae/trae_projects/AI-FIT/info/project/PROJECT_STATUS.md#L68) 。[`info/PROJECT_STATUS.md`](/d:/trae/trae_projects/AI-FIT/info/project/PROJECT_STATUS.md#L72)。
底线结论。
- 这次 food 迁移已经是真实完成的正式迁移，不是”保。legacy 运行面”的半迁移状态。- 当前朢主要的剩余问题不是功能缺口，而是最终提交边界与示例配置安全性。


