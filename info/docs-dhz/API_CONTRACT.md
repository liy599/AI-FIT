# AI-FIT API 契约（当前基线）

## 1. 约定
- 本地 Base URL：`http://127.0.0.1:5000`
- API 前缀：`/api`
- 认证：浏览器端使用 HttpOnly Cookie JWT；状态变更请求需要 CSRF header。
- Content-Type：默认 JSON；上传接口使用 `multipart/form-data`。

## 2. 健康检查
- `GET /api/health`

## 3. Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/me`

## 4. User
- `GET /api/user/profile`
- `PUT /api/user/profile`
- `POST /api/user/avatar`
- `GET /api/user/blogs`
- `GET /api/user/comments`
- `POST /api/user/data-lifecycle/delete`

## 5. Workouts
- `GET /api/workouts`
- `POST /api/workouts`

## 6. Blog / Comments / Tags
- `GET /api/tags`
- `POST /api/blogs/cover`
- `GET /api/blogs`
- `GET /api/blogs/{blog_id}`
- `POST /api/blogs`
- `PUT /api/blogs/{blog_id}`
- `DELETE /api/blogs/{blog_id}`
- `POST /api/blogs/{blog_id}/like`
- `GET /api/blogs/{blog_id}/comments`
- `POST /api/blogs/{blog_id}/comments`
- `PUT /api/comments/{comment_id}`
- `DELETE /api/comments/{comment_id}`
- `POST /api/comments/{comment_id}/like`

## 7. Feedback
- `GET /api/feedback`
- `POST /api/feedback`

## 8. Food
- `GET /api/food/meta`
- `GET /api/foods/categories`
- `GET /api/foods`
- `GET /api/foods/{food_id}`
- `POST /api/foods/bulk`
- `GET /api/meals/today`
- `GET /api/meals/history`
- `GET /api/meals/{meal_id}`
- `POST /api/meals`
- `DELETE /api/meals/{meal_id}`
- `POST /api/recognize`

## 9. Pose
- `GET /api/pose/policy`
- `POST /api/pose/trainings`
- `GET /api/pose/trainings`
- `GET /api/pose/trainings/{session_id}`
- `PUT /api/pose/trainings/{session_id}/report`

说明：
- Pose 推理只在前端本地执行。
- 后端不提供 Pose 原视频上传、分析任务、server-analysis 接口。

## 10. Admin
- `GET /api/admin/data-lifecycle/policy`
- `POST /api/admin/data-lifecycle/cleanup`

## 11. Upload Access
- `GET /uploads/{path}`
- `GET /api/uploads/{path}`

规则：
- 公开前缀可通过 `UPLOAD_PUBLIC_PREFIXES` 配置，默认值为 `avatars,blog_covers`。
- 非公开上传资源必须带有效签名 token。

## 12. 契约治理
本文件是 API 契约基线。任何 endpoint 变更必须同步更新：

1. 本文件。
2. 前端 API caller（`frontend/src/lib/*`）。
3. 后端测试（`backend/tests/*`）。
