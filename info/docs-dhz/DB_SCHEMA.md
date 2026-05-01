# AI-FIT Database Schema Baseline

## 1. Engine
- Primary DB: PostgreSQL
- SQLAlchemy ORM models: `backend/app/models.py`

## 2. Current Core Tables (from models)
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
- `video_assets`
- `analysis_tasks`
- `analysis_results`
- `training_sessions`
- `training_sets`

## 3. Relationship Highlights
- `users` -> many blogs/comments/workout_records/feedback/video_assets/analysis_tasks/training_sessions/meal_records
- `blogs` -> many comments/tags/likes
- `meal_records` -> many `meal_items`
- `video_assets` -> many `analysis_tasks`
- `analysis_tasks` -> many `analysis_results`
- `training_sessions` -> many `training_sets`

## 4. Key Constraints (examples)
- Unique user identity: `users.username`, `users.email`
- Meal uniqueness: `(user_id, meal_type, recorded_on)` on `meal_records`
- Like uniqueness:
  - `(blog_id, user_id)` on `blog_likes`
  - `(comment_id, user_id)` on `comment_likes`
  - `(course_comment_id, user_id)` on `course_comment_likes`
- Enrollment uniqueness: `(user_id, course_id)` on `user_courses`
- Course rating check: `rating >= 1 AND rating <= 5`

## 5. Startup Behavior (Current)
Current app startup runs `db.create_all()` and seed bootstrap logic in app init.
- Location: `backend/app/__init__.py`
- Risk: schema drift and release rollback are hard to control across environments.

## 6. Migration Plan (Target State)
- Introduce Alembic / Flask-Migrate.
- Freeze current schema as baseline migration `0001_initial`.
- For every schema change:
  1. create migration script
  2. code review migration
  3. apply in staging
  4. run rollback test
  5. promote to production

## 7. Data Retention / Lifecycle
- Cleanup endpoints exist under `/api/admin/data-lifecycle/*`.
- User-initiated deletion endpoint exists under `/api/user/data-lifecycle/delete`.
- Future: align retention policy with legal/compliance requirements and document SLA.

## 8. Action Items
- P0: Add migration framework and remove schema creation from runtime startup path.
- P1: Add explicit DB index review for hot query endpoints.
- P1: Add backup/restore runbook and restore drill cadence.
