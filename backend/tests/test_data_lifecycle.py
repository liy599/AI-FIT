from datetime import datetime, timedelta

from app.extensions import db
from app.models import User, UserFeedback, VideoAsset, WorkoutRecord


def _register_and_token(client, email: str, username: str):
    response = client.post(
        "/api/auth/register",
        json={"email": email, "username": username, "password": "pass1234"},
    )
    assert response.status_code == 200
    return response.get_json()["access_token"]


def _auth_header(token: str):
    return {"Authorization": f"Bearer {token}"}


def test_user_data_delete_workout_and_feedback(client):
    token = _register_and_token(client, "dl-user@example.com", "dl-user")

    create_workout = client.post(
        "/api/workouts",
        headers=_auth_header(token),
        json={"exercise_type": "squat", "workout_date": "2026-04-01", "duration": 120},
    )
    assert create_workout.status_code == 201

    create_feedback = client.post(
        "/api/feedback",
        headers=_auth_header(token),
        json={"type": "Review", "content": "keep improving", "rating": 5},
    )
    assert create_feedback.status_code == 201

    preview = client.post(
        "/api/user/data-lifecycle/delete",
        headers=_auth_header(token),
        json={"targets": ["workouts", "feedback"], "dry_run": True},
    )
    assert preview.status_code == 200
    preview_payload = preview.get_json()
    assert preview_payload["counts"]["workouts"] >= 1
    assert preview_payload["counts"]["feedback"] >= 1

    execute = client.post(
        "/api/user/data-lifecycle/delete",
        headers=_auth_header(token),
        json={"targets": ["workouts", "feedback"], "dry_run": False},
    )
    assert execute.status_code == 200
    execute_payload = execute.get_json()
    assert execute_payload["counts"]["workouts"] >= 1
    assert execute_payload["counts"]["feedback"] >= 1

    workouts = client.get("/api/workouts?page=1&page_size=20", headers=_auth_header(token))
    assert workouts.status_code == 200
    assert workouts.get_json()["total"] == 0


def test_admin_cleanup_requires_admin_and_deletes_old_data(client, app):
    user_token = _register_and_token(client, "normal@example.com", "normal")
    admin_token = _register_and_token(client, "admin@example.com", "admin")

    forbidden = client.post(
        "/api/admin/data-lifecycle/cleanup",
        headers=_auth_header(user_token),
        json={"dry_run": True},
    )
    assert forbidden.status_code == 403

    with app.app_context():
        user = User.query.filter_by(email="normal@example.com").first()
        assert user is not None
        old_time = datetime.utcnow() - timedelta(days=30)
        db.session.add(
            WorkoutRecord(
                user_id=user.id,
                exercise_type="squat",
                duration=60,
                workout_date=old_time.date(),
                created_at=old_time,
            )
        )
        db.session.add(
            UserFeedback(
                user_id=user.id,
                type="评价",
                content="old feedback",
                rating=4,
                created_at=old_time,
            )
        )
        db.session.add(
            VideoAsset(
                user_id=user.id,
                original_name="old.mp4",
                mime_type="video/mp4",
                size_bytes=123,
                storage_path="pose/videos/1/old.mp4",
                created_at=old_time,
                updated_at=old_time,
            )
        )
        db.session.commit()

    preview = client.post(
        "/api/admin/data-lifecycle/cleanup",
        headers=_auth_header(admin_token),
        json={"dry_run": True, "retention_days": {"workouts": 7, "feedback": 7, "pose_videos": 7}},
    )
    assert preview.status_code == 200
    preview_payload = preview.get_json()
    assert preview_payload["summary"]["workouts"]["matched"] >= 1
    assert preview_payload["summary"]["feedback"]["matched"] >= 1
    assert preview_payload["summary"]["pose_videos"]["matched"] >= 1

    execute = client.post(
        "/api/admin/data-lifecycle/cleanup",
        headers=_auth_header(admin_token),
        json={"dry_run": False, "retention_days": {"workouts": 7, "feedback": 7, "pose_videos": 7}},
    )
    assert execute.status_code == 200
    execute_payload = execute.get_json()
    assert execute_payload["summary"]["workouts"]["deleted"] >= 1
    assert execute_payload["summary"]["feedback"]["deleted"] >= 1
    assert execute_payload["summary"]["pose_videos"]["deleted"] >= 1

