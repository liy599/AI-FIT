# Food Migration Log

## 2026-04-05 Step 1

目标：
- 按 [`FOODIDENTITY_正式迁移实施方案_2026-04-05.md`](/d:/trae/trae_projects/AI-FIT/info/food/FOODIDENTITY_正式迁移实施方案_2026-04-05.md) 先完成第一阶段“迁移设计落位”
- 不一次性完成 food 全量迁移，只在主项目中建立正式归属和后续实施入口

本步完成：
- 明确旧 food 链路与正式迁移目标的边界
  - `frontend/src/pages/FoodPage.tsx`
  - `backend/app/routes/nutrition.py`
  - `backend/app/routes/diets.py`
  - `DietRecord`
  - 以上仅保留为 legacy 参考，不再作为正式 food 模块基线
- 在主项目中建立正式 food 模块落位骨架
  - `frontend/src/pages/FoodModulePage.tsx`
  - `frontend/src/components/food/FoodModulePlaceholder.tsx`
  - `frontend/src/lib/food/types.ts`
  - `frontend/src/lib/food/api.ts`
- 在主项目后端建立正式 food 命名空间骨架
  - `backend/app/routes/food.py`
  - `backend/app/services/food/__init__.py`
- 新增正式入口说明
  - 新增 `/food`
  - `/tools/food` 暂保留为 legacy tool

本步结论：
- 正式前端归属：`frontend/src/pages/FoodModulePage.tsx`、`frontend/src/components/food/*`、`frontend/src/lib/food/*`
- 正式后端归属：`backend/app/routes/food.py`、`backend/app/services/food/*`
- 正式接口命名空间：`/api/food/*`、`/api/foods/*`、`/api/meals/*`、`/api/recognize`

## 2026-04-05 Step 2

目标：
- 在主项目后端落正式 `foods / meal_records / meal_items` 数据模型与 API
- 保持旧 `nutrition / diets` 可用，但不再作为正式 food 模块基线

本步完成：
- 在主项目正式模型中新增：
  - `FoodItem` -> `foods`
  - `FoodMealRecord` -> `meal_records`
  - `FoodMealItem` -> `meal_items`
- 在 `User` 模型中补充正式 meal 关联
- 增加 food 服务目录中的基础种子与序列化工具
- 自动补充最小 food 样本数据，不再依赖 `foodidentity/db/init.sql`
- 落地正式 food API：
  - `GET /api/foods`
  - `GET /api/foods/<id>`
  - `POST /api/foods/bulk`
  - `GET /api/meals/today`
  - `GET /api/meals/<id>`
  - `POST /api/meals`
  - `DELETE /api/meals/<id>`
- meals API 改为基于主项目 JWT 用户身份
  - 不再从客户端接收任意 `userId`
- 新增 `POST /api/recognize`
  - 当时为占位接口
- 增加专项测试：`backend/tests/test_food.py`

本步验证：
- 已执行：`backend/.venv/Scripts/python.exe -m pytest tests/test_food.py -q`
  - 通过
- 已执行：`backend/.venv/Scripts/python.exe -m pytest tests/test_auth.py tests/test_pose.py -q`
  - 通过

本步结论：
- 主项目后端已具备独立的正式 food 数据模型和 meals/foods 基础 API
- 下一步应继续迁移 recognize 正式识别链路与 food 匹配逻辑

## 2026-04-05 Step 3

目标：
- 继续第二阶段迁移
- 把 `foodidentity` 的文本归一、food 匹配与识别接口链路迁入主项目

本步完成：
- 新增 food 识别与匹配服务：
  - `backend/app/services/food/text.py`
  - `backend/app/services/food/matching.py`
  - `backend/app/services/food/stepfun.py`
- 新增干净的正式 food 样本与匹配数据源：
  - `backend/app/services/food/catalog_data.py`
- 正式 food 路由改为引用 `catalog_data.py`
- `POST /api/recognize` 改为正式识别入口：
  - 接收图片文件
  - 检查 Stepfun 配置
  - 调用 Stepfun 多模态识别
  - 解析非标准 JSON 字符串数组返回
  - 用 food 匹配逻辑输出 `foodIds`
  - 返回 `names / foodIds / unmatchedNames`
- 增加识别相关配置：
  - `backend/app/config.py`
  - `backend/.env.example`
- 修正前端 food API 图片上传方式：
  - `frontend/src/lib/food/api.ts`
  - 改为 `apiUpload(FormData)`
- 新增识别与匹配专项测试：
  - `backend/tests/test_food_recognize.py`

本步验证：
- 已执行：`backend/.venv/Scripts/python.exe -m pytest tests/test_food.py tests/test_food_recognize.py -q`
  - 通过
- 已执行：`backend/.venv/Scripts/python.exe -m pytest tests/test_auth.py tests/test_pose.py -q`
  - 通过
- 已执行：`frontend` 下的 `npm.cmd run typecheck`
  - 通过

本步结论：
- 主项目后端已正式承接 food 识别接口路径与核心匹配逻辑
- 若未配置 `STEPFUN_API_URL / STEPFUN_API_KEY`，`/api/recognize` 会返回 `503 stepfun not configured`

## 2026-04-05 Step 4

目标：
- 开始第三阶段前端承接，但只做可控步长
- 把 `/food` 从占位页升级成首版正式首页
- 补出正式餐次路由入口，避免入口点到空页面

本步完成：
- 重写 `frontend/src/pages/FoodModulePage.tsx`
  - 接入 `getFoodModuleMeta()`
  - 接入 `getTodaySummary()`
  - 登录后展示今日总览与四个餐次入口
  - 未登录时明确提示先登录
- 新增 `frontend/src/pages/FoodMealPage.tsx`
  - 建立 `/food/meal/:mealType` 正式承接路由
  - 作为餐次编辑页入口占位
- 更新前端路由：
  - `frontend/src/App.tsx` 新增 `/food/meal/:mealType`
- 更新导航入口：
  - `frontend/src/components/Navbar.tsx`
  - `frontend/src/pages/HomePage.tsx`
  - `frontend/src/components/Footer.tsx`
  - food 入口统一切到 `/food`

本步验证：
- 已执行：`frontend` 下的 `npm.cmd run typecheck`
  - 通过

本步结论：
- `/food` 已不再是纯说明页，而是正式 food 模块首页首版
- 下一步继续迁移餐次编辑页完整闭环

## 2026-04-05 Step 5

目标：
- 继续第三阶段前端迁移
- 把 `/food/meal/:mealType` 从占位页升级成首版可用餐次编辑页
- 打通搜索、选品、识别、克数调整与 meals 保存闭环

本步完成：
- 重写 `frontend/src/pages/FoodMealPage.tsx`
  - 登录后加载 food 列表
  - 同步加载今日该餐次已有记录并回填到草稿区
  - 支持按关键词与分类筛选 foods
  - 支持点击食物加入/移出餐次草稿
  - 支持图片识别后通过 `/api/recognize` + `/api/foods/bulk` 加入候选食物
  - 支持调整各食物 grams
  - 支持通过 `/api/meals` 保存
  - 支持删除当前已保存餐次
- 当前餐次页开始直接承接主项目正式 API：
  - `/api/foods`
  - `/api/foods/bulk`
  - `/api/meals/today`
  - `/api/meals`
  - `/api/recognize`

本步验证：
- 已执行：`frontend` 下的 `npm.cmd run typecheck`
  - 通过

本步结论：
- 正式 food 前端已具备最小可用闭环：
  - `/food` 查看今日概览
  - `/food/meal/:mealType` 编辑餐次
  - 搜索/识别加入食物
  - 调整克数并保存到正式 meals API
- 下一步更适合继续做：
  - 把当前餐次页进一步做成主站化完整交互页
  - 继续弱化 `/tools/food` 的入口与职责
  - 补 food 前端交互层的专项测试或手工联调记录

## 2026-04-05 Step 6

目标：
- 修复上一轮审查里已经确认的正式行为问题
- 继续把 `/food/meal/:mealType` 从“可用编辑页”收口成更接近主站体验的页面
- 保持主线仍然是 AI-FIT 正式 food 模块，不回退到 legacy `/tools/food`

本步完成：
- 修复正式 meals 保存链路中的高优先级问题
  - `backend/app/routes/meals.py`
  - 空 `items` 不再允许保存
  - 保存前增加 `foodId` 有效性校验，避免脏数据或外键错误直接落到数据库层
- 修复前端保存日期口径问题
  - `frontend/src/lib/food/api.ts`
  - `frontend/src/pages/FoodMealPage.tsx`
  - 前端保存 meals 时不再手工传 UTC 日期，改为交由正式后端口径处理
- 同步正式模块状态信息
  - `backend/app/routes/food.py`
  - `frontend/src/pages/FoodModulePage.tsx`
  - 修正仍停留在 step-1 / planning 的过期状态描述
- 继续主站化收口 `frontend/src/pages/FoodMealPage.tsx`
  - 新增顶部状态 Hero，展示当前餐次、保存状态、已选数量
  - 筛选区从下拉扩展为更直接的分类按钮流
  - 增强识别成功 / 识别提示 / 保存成功 / 错误提示反馈
  - 草稿区增加 clear、快捷克数按钮、状态卡片与更明确的营养汇总区
  - 保留正式 API 闭环不变，继续基于 `/api/foods`、`/api/meals`、`/api/recognize`
- 补充后端回归测试
  - `backend/tests/test_food.py`
  - 覆盖空餐次拒绝保存
  - 覆盖无效 `foodId` 拒绝保存

本步验证：
- 已执行：`backend/.venv/Scripts/python.exe -m pytest tests/test_food.py tests/test_food_recognize.py -q`
  - 通过
- 已执行：`frontend` 下的 `npm.cmd run typecheck`
  - 通过

本步结论：
- 正式 food 模块的 meals 保存语义已更接近可交付状态，不再允许空记录混入正式数据
- `/food/meal/:mealType` 仍在现有迁移增量上继续演进，没有回退到 legacy 方案
- 下一步更适合继续做：
  - 进一步弱化 `/food` 页面中的 legacy `/tools/food` 曝光
  - 为 food 前端主流程补专项联调记录或页面级测试
  - 后续阶段再集中清理旧 `nutrition / diets / FoodPage`

## 2026-04-05 Step 7

目标：
- 继续第三阶段前端主站化迁移
- 把 `/food` 首页从迁移说明页收口成正式模块首页
- 进一步降低 legacy `/tools/food` 的入口曝光，但暂不做最终清理

本步完成：
- 重写 `frontend/src/pages/FoodModulePage.tsx`
  - 首页改为正式 food 模块 Hero，而不是迁移说明板
  - 展示模块阶段、正式入口、今日已记录餐次数等概览状态
  - 汇总区改为更清晰的今日营养卡片
  - 4 个餐次入口改为更完整的卡片式入口
  - 将主 CTA 改为直接进入正式餐次编辑流，不再突出 legacy tool
- 增强首页错误与空态表达
  - `getFoodModuleMeta()` 增加独立错误反馈
  - 今日 summary 错误继续独立显示，不再和模块元信息混在一起
- 右侧信息区改为正式范围与迁移备注展示
  - 保留正式 API 快照
  - 保留迁移备注，但不再把页面主体做成迁移说明文案

本步验证：
- 已执行：`frontend` 下的 `npm.cmd run typecheck`
  - 通过

本步结论：
- `/food` 首页已更接近正式主站页面，而不是中间迁移展示页
- legacy `/tools/food` 仍保留，但首页曝光已明显降低
- 下一步更适合继续做：
  - 统一修复 food 首页与餐次页当前残留的接口失败、文案与布局细节问题
  - 继续补 food 前端主流程的联调记录或页面级测试
  - 最后阶段再集中清理 legacy food 页面与旧 `nutrition / diets` 入口

## 2026-04-05 Step 8

目标：
- 进入 food 前端收口阶段
- 统一修复首页与餐次页残留的半完成态布局问题
- 为最后一轮集中联调/错误修复做准备

本步完成：
- 收口 `frontend/src/pages/FoodMealPage.tsx`
  - 修复食物卡片区残留的半编辑状态
  - 食物卡片补齐名称、分类、热量与三大营养素展示
  - 已选状态统一为更清晰的卡片式表达
  - 草稿区移除食物逻辑收敛为单独函数，避免重复内联删除逻辑
- 保持正式 API 流程不变
  - 继续基于 `/api/foods`、`/api/foods/bulk`、`/api/meals`、`/api/recognize`
  - 不回退到 legacy `/tools/food` 链路

本步验证：
- 已执行：`frontend` 下的 `npm.cmd run typecheck`
  - 通过

本步结论：
- `/food` 与 `/food/meal/:mealType` 的前端结构已基本进入可集中联调与最终修复的阶段
- 下一步更适合继续做：
  - 集中排查当前 food 页面中的接口失败、鉴权状态与实际联调问题
  - 根据联调结果统一处理错误文案、空态和异常回退
  - 最后再决定 legacy 入口的最终保留或清理节奏

## 2026-04-05 Step 9

目标：
- 进入最后集中修复阶段
- 优先处理 `/food` 与 `/food/meal/:mealType` 的接口失败、鉴权状态、空态与异常回退问题
- 保持正式方案继续收口，不回退到 legacy `/tools/food`

本步完成：
- 收口前端 food 请求层错误解析
  - `frontend/src/lib/api.ts`
  - 不再只识别后端 `error`
  - 兼容 `error / msg / message` 三类错误字段
  - 增加网络失败与上传失败时的明确错误提示
  - 避免后端返回非 JSON 错误页时前端先在 `JSON.parse` 阶段崩掉
- 统一正式首页与餐次页的鉴权失败回退
  - `frontend/src/pages/FoodModulePage.tsx`
  - `frontend/src/pages/FoodMealPage.tsx`
  - 当 meals summary 或餐次编辑请求因 JWT 失效失败时，页面会明确提示重新登录
  - 增加重新登录入口与清理本地会话入口
- 修复非法餐次路由回退问题
  - `frontend/src/pages/FoodMealPage.tsx`
  - 非法 `mealType` 不再静默回退成 `lunch`
  - 改为明确展示当前路由不属于正式 meal flow，并给出返回 `/food` 的入口
- 继续收口空态与异常提示
  - `frontend/src/pages/FoodMealPage.tsx`
  - 区分“正式 food 库为空”与“筛选后无结果”两类状态
  - 保持识别提示、保存提示与错误提示分层展示
- 新增干净的正式 food runtime 类型文件
  - `frontend/src/lib/food/types_runtime.ts`
  - 正式 `/food` 新链路改为引用干净类型文件，避免继续依赖历史编码损坏的 `frontend/src/lib/food/types.ts`
- 补后端日期参数校验
  - `backend/app/routes/meals.py`
  - `GET /api/meals/today?date=...` 对非法日期返回 400
  - `POST /api/meals` 的 `recordedOn` 非法时返回 400
  - 避免坏日期直接落成 500
- 新增正式 food runtime 数据源兼容层
  - `backend/app/services/food/catalog_runtime.py`
  - `backend/app/__init__.py`
  - `backend/app/routes/foods.py`
  - `backend/app/routes/meals.py`
  - `backend/app/routes/recognize.py`
  - 不再继续依赖有历史编码问题的 `catalog.py`
  - 正式运行链路切到新的 runtime catalog
  - 在序列化阶段兼容纠正已有 seed 数据中的乱码 display/category 文本，避免现有库数据影响前端展示
- 补充后端回归测试
  - `backend/tests/test_food.py`
  - 覆盖 food seed 文本正常返回
  - 覆盖 meals 非法日期参数拒绝保存/查询

本步验证：
- 已执行：`frontend` 下的 `npm.cmd run typecheck`
  - 通过
- 已执行：`backend/.venv/Scripts/python.exe -m pytest tests/test_food.py tests/test_food_recognize.py -q`
  - 通过

本步结论：
- `/food` 与 `/food/meal/:mealType` 的最后集中修复已进入可联调状态，核心失败路径已有明确回退
- 正式 food 新链路已进一步摆脱历史编码损坏文件对运行时的影响
- 下一步更适合继续做：
  - 实机联查 `/food` 与 `/food/meal/:mealType` 在未登录、token 失效、Stepfun 未配置、后端不可达时的页面表现
  - 根据联调结果决定 legacy `/tools/food` 的最终收口方式
  - 后续阶段再集中清理旧 `FoodPage / nutrition / diets` 入口

## 2026-04-05 Step 10

目标：
- 在主流程联调通过后，开始 legacy 入口收口
- 停止让旧 `/tools/food` 页面继续承载正式 food 功能，避免用户误入旧链路

本步完成：
- 收口前端 legacy food 入口
  - `frontend/src/App.tsx`
  - 原 `/tools/food` 路由不再渲染旧 `FoodPage`
  - 改为直接重定向到正式 `/food`
- 明确正式入口唯一化
  - 正式 food 使用入口继续固定为 `/food`
  - legacy 链接仍可访问，但只作为兼容跳转，不再继续扩展旧页面能力

本步验证：
- 已执行：`frontend` 下的 `npm.cmd run typecheck`
  - 通过

本步结论：
- `/tools/food` 已不再是可继续演进的实际功能页，正式入口进一步收敛到 `/food`
- 下一步更适合继续做：
  - 评估是否彻底移除 `frontend/src/pages/FoodPage.tsx`
  - 后续阶段再集中清理旧 `nutrition / diets` 入口及其在 profile 等页面中的残留使用

## 2026-04-05 Step 11

目标：
- 继续清理用户侧仍可见的 legacy food 数据依赖
- 把 profile 页中的饮食记录与热量统计从旧 `/api/diets` 切到正式 meals 数据

本步完成：
- 新增正式 meals 历史接口
  - `backend/app/routes/meals.py`
  - 新增 `GET /api/meals/history`
  - 基于 JWT 用户返回分页 meal 记录
  - 返回正式 meals 的 `recordedOn / mealType / items / totals`
- 补充后端回归测试
  - `backend/tests/test_food.py`
  - 覆盖 `GET /api/meals/history` 的基本返回与分页数据存在性
- 收口 profile 页的 food 数据来源
  - `frontend/src/pages/ProfilePage.tsx`
  - 原饮食记录不再请求 `/api/diets`
  - 改为请求 `/api/meals/history?page=1&page_size=20`
  - “饮食记录”展示改为正式 meal 记录视图
  - 用户周报中的热量摄入均值改为基于正式 meal totals 计算

本步验证：
- 已执行：`frontend` 下的 `npm.cmd run typecheck`
  - 通过
- 已执行：`backend/.venv/Scripts/python.exe -m pytest tests/test_food.py tests/test_food_recognize.py -q`
  - 通过

本步结论：
- profile 页已不再依赖 legacy `/api/diets` 作为主要 food 数据源
- 正式 food 数据开始从模块页扩展到用户个人页视图
- 下一步更适合继续做：
  - 彻底移除未参与正式路由的旧 `FoodPage.tsx`
  - 评估 `backend/app/routes/diets.py` 在 profile 之外的剩余用途
  - 后续阶段再决定 legacy `nutrition / diets` 的下线策略

## 2026-04-05 Step 12

目标：
- 在用户侧与 profile 页都已切出 legacy food 数据后，正式下线旧 `/api/diets` 与 `/api/nutrition`
- 进一步收敛 AI-FIT 正式运行时只暴露新 food API

本步完成：
- 停止注册 legacy food API
  - `backend/app/__init__.py`
  - 不再注册 `diets_bp`
  - 不再注册 `nutrition_bp`
- 同步正式模块元信息
  - `backend/app/routes/food.py`
  - 将说明从“legacy /api/nutrition and /api/diets remain available during migration”
    更新为“不再作为 formal runtime entry points”

本步验证：
- 已执行：`backend/.venv/Scripts/python.exe -m pytest tests/test_food.py tests/test_food_recognize.py -q`
  - 通过
- 已执行：`frontend` 下的 `npm.cmd run typecheck`
  - 通过
- 已执行：应用内探针检查
  - `/api/food/meta` -> 200
  - `/api/foods` -> 200
  - `/api/diets` -> 404
  - `/api/nutrition/analyze` -> 404

本步结论：
- legacy `diets / nutrition` 已从运行时入口层面下线
- AI-FIT 正式 food 运行链路进一步收敛到 `/api/food`、`/api/foods`、`/api/meals`、`/api/recognize`
- 下一步更适合继续做：
  - 删除已失活的旧 food 前端/后端文件
  - 评估是否同时清理旧 `DietRecord` 模型及相关残留引用

## 2026-04-05 Step 13

目标：
- 在 legacy 路由已下线后，继续清理代码层残留
- 摘除已无任何运行时用途的 `DietRecord` 模型引用

本步完成：
- 清理 `DietRecord` 模型残留
  - `backend/app/models.py`
  - 从 `User` 模型中移除 `diet_records` 关系
  - 删除 `DietRecord` 模型定义
- 确认代码侧已无 `DietRecord / diet_records` 引用残留

本步验证：
- 已执行：`backend/.venv/Scripts/python.exe -m pytest tests/test_food.py tests/test_food_recognize.py -q`
  - 通过
- 已执行：`frontend` 下的 `npm.cmd run typecheck`
  - 通过
- 已执行：代码检索 `DietRecord|diet_records`
  - 无剩余引用

本步结论：
- 旧 diets 数据模型已从代码主干中摘除
- food legacy 剩余清理已主要收敛到文件层和历史脏文件层
- 下一步更适合继续做：
  - 删除仍残留在工作区的历史损坏文件 `frontend/src/lib/food/types.ts`
  - 整理当前可直接提交的最终迁移收尾清单

## 2026-04-05 Step 14

目标：
- 完成最后一批文件层清理确认
- 将 food 正式链路收敛状态推进到可提交收尾阶段

本步完成：
- 确认历史损坏类型文件已移除
  - `frontend/src/lib/food/types.ts`
  - 当前正式 food 前端仅保留 `frontend/src/lib/food/types_runtime.ts`
- 确认旧 food 页面与 legacy API 文件已移除
  - `frontend/src/pages/FoodPage.tsx`
  - `backend/app/routes/diets.py`
  - `backend/app/routes/nutrition.py`
- 确认正式前端 food 页面仅引用新的 runtime 类型文件
  - `frontend/src/pages/FoodModulePage.tsx`
  - `frontend/src/pages/FoodMealPage.tsx`

本步结论：
- food 迁移的代码层与文件层收尾已经基本完成
- 当前工作区已进入“整理提交与最终验收”阶段
- 下一步更适合继续做：
  - 统一整理本轮迁移涉及文件，准备提交
  - 视需要再补一次更大范围的回归测试


