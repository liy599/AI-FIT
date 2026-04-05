# 项目现状总结（AI-FIT）

本文档用于固化当前仓库已实现功能、鉴权边界、测试/演示账号方式与启动要点。

## 技术栈与结构

- 后端：Flask + SQLAlchemy + Flask-JWT-Extended（JWT 鉴权）
- 前端：React + TypeScript + Vite + React Router
- 数据库：PostgreSQL（本项目推荐通过 Docker Desktop 统一启动）

关键入口：
- 后端入口：`backend/run.py`（本地开发）、`backend/wsgi.py`（部署入口）
- 前端入口：`frontend/src/main.tsx`
- 路由容器：`frontend/src/App.tsx`

## 已实现功能（按模块）

### 账号与鉴权

- 注册：`POST /api/auth/register`
- 登录：`POST /api/auth/login`
- 当前用户：`GET /api/auth/me`（需要登录）
- 登出：`POST /api/auth/logout`（需要登录）
- 忘记密码：`POST /api/auth/forgot-password`（开发态返回 `reset_link`）
- 重置密码：`POST /api/auth/reset-password`

说明：
- 前端鉴权通过本地存储保存 token/user，并在请求头附加 `Authorization: Bearer <token>`。
- 当前“登出”属于客户端清 token 形态：后端 `logout` 仅返回 `{ok:true}`，未做 token 拉黑/失效列表。

### 用户与个人中心

- 个人资料读取/更新：`GET/PUT /api/user/profile`（需要登录）
- 头像上传：`POST /api/user/avatar`（需要登录）
- 我的博客/我的评论：`GET /api/user/blogs`、`GET /api/user/comments`（需要登录）

### 博客与评论

- 博客列表：`GET /api/blogs`（仅返回已发布）
- 博客详情：`GET /api/blogs/<id>`（公开；可选携带 token 返回 `liked_by_me`）
- 创建/更新/删除博客：`POST/PUT/DELETE /api/blogs...`（需要登录）
- 上传封面：`POST /api/blogs/cover`（需要登录）
- 点赞/取消点赞：`POST /api/blogs/<id>/like`（需要登录）

评论（博客）：
- 评论列表：`GET /api/blogs/<blog_id>/comments`（公开；可选携带 token 返回 `liked_by_me`）
- 发表评论/回复：`POST /api/blogs/<blog_id>/comments`（需要登录）
- 编辑/删除/点赞：`PUT/DELETE /api/comments/<id>`、`POST /api/comments/<id>/like`（需要登录）

### 课程与课程评价

- 课程列表：`GET /api/courses`（当前需要登录）
- 课程详情：`GET /api/courses/<id>`（当前需要登录）
- 报名：`POST /api/courses/<id>/enroll`（需要登录，模拟支付/报名）

课程评价：
- 列表：`GET /api/courses/<course_id>/comments`（需要登录）
- 发表评论：`POST /api/courses/<course_id>/comments`（需要登录，且服务端校验“报名后才能评论”）
- 编辑/删除/点赞：`PUT/DELETE /api/course-comments/<id>`、`POST /api/course-comments/<id>/like`（需要登录）

### 训练与饮食记录

- 训练记录：`GET/POST /api/workouts`（需要登录）
- 饮食记录：`GET/POST /api/diets`（需要登录）

### 营养分析

- 营养分析：`POST /api/nutrition/analyze`（公开；调用 OpenFoodFacts，失败回退 mock）

### 反馈

- 反馈列表：`GET /api/feedback`（公开）
- 提交反馈：`POST /api/feedback`（可匿名；匿名 review 需要 `contact_email`）

## 前端页面与登录限制

### 路由级强制登录

未登录会跳转登录页：
- `/courses`、`/courses/:id`
- `/profile`

### 页面内操作级限制（页面可访问，但动作需要登录）

- Blog 详情：点赞、发表评论/回复、编辑/删除、评论点赞均要求登录
- Food：营养分析公开；保存到 diets（饮食记录）需要登录
- Course 详情：发表评论需要登录且已报名（UI 与服务端均有校验）

## 测试/演示账号与种子数据

- 固定测试账号：未内置
- 种子数据：`backend/seed.py` 仅包含 Tag + Course
- 演示账号：`backend/demo.ps1` 会用时间戳动态注册账号并获取 token

## 启动要点（简述）

- 建议以 Docker Desktop 方式启动 PostgreSQL，保证不同电脑环境一致。
- 一键启动入口：根目录 `dev.ps1`（创建虚拟环境、安装依赖、启动数据库并拉起前后端）。

## 已知限制/待改进建议

- 登出未做 token 失效（无黑名单/无刷新 token 机制）
- 当前用 `db.create_all()` 自动建表；正式演进建议引入数据库迁移工具
- CORS 已支持通过 `CORS_ORIGINS` 环境变量配置（逗号分隔）
