# 后端架构

## 1. 职责边界

- 前端（`frontend`）：UI 渲染、本地 MoveNet 推理、实时/离线分析编排、报告生成。
- 后端（`backend`）：身份认证、Pose 训练记录持久化、policy/config 下发、审计与数据生命周期管理。
- Pose 原始摄像头流和离线原视频默认留在浏览器本地，后端只保存用户主动提交的训练摘要和受保护报告 JSON。

## 2. 当前路由分层

后端路由已从平铺文件收口为业务域目录：

| 目录 | 职责 |
|---|---|
| `app/routes/account/` | 注册、登录、用户资料、反馈、训练摘要等账号相关接口 |
| `app/routes/blog/` | 博客、评论、标签 |
| `app/routes/food/` | 食物元数据、食物记录、餐食、识别接口 |
| `app/routes/pose/` | Pose policy 与训练记录接口 |
| `app/routes/admin/` | 管理后台与数据生命周期接口 |

## 3. 核心模块

- `app/__init__.py`：创建 Flask app、注册扩展、注册蓝图。
- `app/models.py`：核心领域实体，例如用户、博客、食物、训练记录、训练组。
- `app/routes/*`：HTTP API 边界，只做鉴权、参数解析、响应组织和服务调用。
- `app/services/pose/policy.py`：Pose 四动作 policy 与 analyzer tuning 的后端唯一来源。
- `app/utils/*`：横切能力，包括安全、隐私保护、分页、上传访问 token 等。

## 4. Pose 后端边界

Pose 后端保留简洁接口：

- `GET /api/pose/policy`：下发版本化 policy、动作白名单、隐私规则、实时/离线限制和四动作 analyzer tuning。
- `POST /api/pose/trainings`：保存训练摘要、训练组、policy version 和受保护报告 JSON。
- `GET /api/pose/trainings`：读取训练历史。
- `GET /api/pose/trainings/<id>`：读取训练详情。
- `PUT /api/pose/trainings/<id>/report`：更新已有训练报告。

已下线的服务端 Pose 视频推理链路不再作为主路径存在，`/api/pose/config/squat-tuning` 也不再提供。

## 5. 运行时数据流

1. 前端加载 `GET /api/pose/policy`。
2. 实时模式在浏览器本地采样摄像头帧，运行 MoveNet 和动作 analyzer。
3. 离线模式在浏览器本地读取用户选择的视频，抽帧、推理、回放 analyzer，并生成 overlay 与报告。
4. 保存训练时前端调用 `POST /api/pose/trainings`，只提交结构化摘要和报告 JSON，不上传原视频。
5. 历史页和报告页通过 `GET /api/pose/trainings` 与 `GET /api/pose/trainings/<id>` 回显。

## 6. 工程原则

- 路由层保持薄边界，业务规则进入 service 或业务模块。
- Pose policy 由后端统一下发，前端负责本地推理和体验编排。
- 后端不接收 Pose 原视频，不参与逐帧姿态推理。
- 新路由按业务域放入 `app/routes/<domain>/`，避免回到平铺结构。
