# AI-FIT API Contract (Current Baseline)

## 1. Conventions
- Base URL (local): `http://127.0.0.1:5000`
- API prefix: `/api`
- Auth: JWT Bearer token in `Authorization` header
- Content-Type: JSON unless upload endpoint (multipart/form-data)

## 2. Health
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
- `GET /api/pose/config/squat17-tuning`
- `PUT /api/pose/config/squat17-tuning`
- `GET /api/pose/videos`
- `POST /api/pose/videos`
- `GET /api/pose/videos/{video_id}/file`
- `GET /api/pose/videos/{video_id}/signed-url`
- `POST /api/pose/analysis/tasks`
- `GET /api/pose/analysis/tasks/{task_id}`
- `POST /api/pose/analysis/tasks/{task_id}/complete`
- `POST /api/pose/analysis/tasks/{task_id}/fail`
- `POST /api/pose/trainings`
- `GET /api/pose/trainings`
- `GET /api/pose/trainings/{session_id}`
- `PUT /api/pose/trainings/{session_id}/report`
- `POST /api/pose/reports/ai`

## 10. Admin
- `GET /api/admin/data-lifecycle/policy`
- `POST /api/admin/data-lifecycle/cleanup`

## 11. Upload Access
- `GET /uploads/{path}`
- `GET /api/uploads/{path}`

Rules:
- Public prefixes are configurable (`UPLOAD_PUBLIC_PREFIXES`, default: `avatars,blog_covers`).
- Non-public uploads require a signed token parameter.

## 12. Contract Governance
This file is the contract baseline. Any endpoint change must update:
1. This file
2. Frontend API caller (`frontend/src/lib/*`)
3. Test cases in `backend/tests/*`

