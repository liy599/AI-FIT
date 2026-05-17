# AI-FIT 数据库 Schema 基线

## 1. 数据库引擎
- 主数据库：PostgreSQL。
- SQLAlchemy ORM 模型位置：`backend/app/models.py`。

## 2. 当前核心表（来自 models）
- `users`
- `workout_records`
- `foods`
- `meal_records`
- `meal_items`
- `tags`
- `blogs`
- `blog_tags`
- `comments`
- `blog_likes`
- `comment_likes`
- `courses`
- `user_courses`
- `course_comments`
- `course_comment_likes`
- `user_feedback`
- `training_sessions`
- `training_sets`

## 3. 关系摘要
- `users` -> 多个 `blogs`、`comments`、`workout_records`、`feedback`、`training_sessions`、`meal_records`。
- `blogs` -> 多个 `comments`、`tags`、`likes`。
- `meal_records` -> 多个 `meal_items`。
- `training_sessions` -> 多个 `training_sets`。

Pose 服务端推理表（`video_assets`、`analysis_tasks`、`analysis_results`）已从当前模型退役，并由迁移 `4f8d9f0a6c21` 删除。

## 4. 关键约束示例
- 用户身份唯一：`users.username`、`users.email`。
- 餐食记录唯一：`meal_records` 上的 `(user_id, meal_type, recorded_on)`。
- 点赞唯一：
  - `blog_likes` 上的 `(blog_id, user_id)`。
  - `comment_likes` 上的 `(comment_id, user_id)`。
  - `course_comment_likes` 上的 `(course_comment_id, user_id)`。
- 课程报名唯一：`user_courses` 上的 `(user_id, course_id)`。
- 课程评分检查：`rating >= 1 AND rating <= 5`。

## 5. 当前启动行为
当前应用启动会按配置执行 seed/bootstrap 逻辑。
- 位置：`backend/app/__init__.py`。
- 生产规则：生产环境应通过迁移管理 schema，不依赖运行时自动建表。

## 6. 迁移规范
- 使用 Alembic / Flask-Migrate 管理 schema。
- 当前 schema 以 baseline migration 固化。
- 每次模型变更都需要：
  1. 创建 migration 脚本。
  2. review migration。
  3. 在 staging 应用。
  4. 执行回滚验证。
  5. 再发布到生产。

## 7. 数据保留与生命周期
- 管理员清理接口：`/api/admin/data-lifecycle/*`。
- 用户自助删除接口：`/api/user/data-lifecycle/delete`。
- 后续需要按合规要求明确保留周期、清理频率和恢复 SLA。

## 8. 待办
- P0：生产环境坚持迁移驱动 schema 变更，禁止依赖运行时自动建表。
- P1：对高频查询接口做显式索引 review。
- P1：补充备份/恢复 runbook 和恢复演练节奏。
