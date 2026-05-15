from datetime import datetime, timedelta

from app.extensions import db
from app.models import User, UserFeedback, WorkoutRecord


def _register_and_token(client, email: str, username: str):
    response = client.post(
        "/api/auth/register",
        json={"email": email, "username": username, "password": "pass1234"},
    )
    assert response.status_code == 200
    return response.get_json()["user"]["id"]


def _auth_headers(client):
    csrf_cookie = client.get_cookie("csrf_access_token")
    csrf_token = csrf_cookie.value if csrf_cookie is not None else ""
    return {"X-CSRF-TOKEN": csrf_token} if csrf_token else {}


def test_user_data_delete_workout_and_feedback(client):
    token = _register_and_token(client, "dl-user@example.com", "dl-user")
    _ = token

    create_workout = client.post(
        "/api/workouts",
        headers=_auth_headers(client),
        json={"exercise_type": "squat", "workout_date": "2026-04-01", "duration": 120},
    )
    assert create_workout.status_code == 201

    create_feedback = client.post(
        "/api/feedback",
        headers=_auth_headers(client),
        json={"type": "Review", "content": "keep improving", "rating": 5},
    )
    assert create_feedback.status_code == 201

    preview = client.post(
        "/api/user/data-lifecycle/delete",
        headers=_auth_headers(client),
        json={"targets": ["workouts", "feedback"], "dry_run": True},
    )
    assert preview.status_code == 200
    preview_payload = preview.get_json()
    assert preview_payload["counts"]["workouts"] >= 1
    assert preview_payload["counts"]["feedback"] >= 1

    execute = client.post(
        "/api/user/data-lifecycle/delete",
        headers=_auth_headers(client),
        json={"targets": ["workouts", "feedback"], "dry_run": False},
    )
    assert execute.status_code == 200
    execute_payload = execute.get_json()
    assert execute_payload["counts"]["workouts"] >= 1
    assert execute_payload["counts"]["feedback"] >= 1

    workouts = client.get("/api/workouts?page=1&page_size=20")
    assert workouts.status_code == 200
    assert workouts.get_json()["total"] == 0


def test_admin_cleanup_requires_admin_and_deletes_old_data(client, app):
    user_client = client.application.test_client()
    admin_client = client.application.test_client()

    user_token = _register_and_token(user_client, "normal@example.com", "normal")
    _ = user_token
    user_headers = _auth_headers(user_client)
    admin_token = _register_and_token(admin_client, "admin@example.com", "admin")
    _ = admin_token
    admin_headers = _auth_headers(admin_client)

    forbidden = user_client.post(
        "/api/admin/data-lifecycle/cleanup",
        headers=user_headers,
        json={"dry_run": True},
    )
    assert forbidden.status_code == 403

    with app.app_context():
        admin_user = User.query.filter_by(email="admin@example.com").first()
        assert admin_user is not None
        admin_user.is_admin = True
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
        db.session.commit()

    preview = admin_client.post(
        "/api/admin/data-lifecycle/cleanup",
        headers=admin_headers,
        json={"dry_run": True, "retention_days": {"workouts": 7, "feedback": 7}},
    )
    assert preview.status_code == 200
    preview_payload = preview.get_json()
    assert preview_payload["summary"]["workouts"]["matched"] >= 1
    assert preview_payload["summary"]["feedback"]["matched"] >= 1

    execute = admin_client.post(
        "/api/admin/data-lifecycle/cleanup",
        headers=admin_headers,
        json={"dry_run": False, "retention_days": {"workouts": 7, "feedback": 7}},
    )
    assert execute.status_code == 200
    execute_payload = execute.get_json()
    assert execute_payload["summary"]["workouts"]["deleted"] >= 1
    assert execute_payload["summary"]["feedback"]["deleted"] >= 1
