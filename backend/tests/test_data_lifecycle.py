from app.extensions import db
from app.models import Comment, Tag


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


def test_user_data_delete_workout(client):
    token = _register_and_token(client, "dl-user@example.com", "dl-user")
    _ = token

    create_workout = client.post(
        "/api/workouts",
        headers=_auth_headers(client),
        json={"exercise_type": "squat", "workout_date": "2026-04-01", "duration": 120},
    )
    assert create_workout.status_code == 201

    preview = client.post(
        "/api/user/data-lifecycle/delete",
        headers=_auth_headers(client),
        json={"targets": ["workouts"], "dry_run": True},
    )
    assert preview.status_code == 200
    preview_payload = preview.get_json()
    assert preview_payload["counts"]["workouts"] >= 1

    execute = client.post(
        "/api/user/data-lifecycle/delete",
        headers=_auth_headers(client),
        json={"targets": ["workouts"], "dry_run": False},
    )
    assert execute.status_code == 200
    execute_payload = execute.get_json()
    assert execute_payload["counts"]["workouts"] >= 1

    workouts = client.get("/api/workouts?page=1&page_size=20")
    assert workouts.status_code == 200
    assert workouts.get_json()["total"] == 0


def test_user_data_delete_comments_preserves_replies(client, app):
    with app.app_context():
        t = Tag(name="Training")
        db.session.add(t)
        db.session.commit()
        tag_id = t.id

    _register_and_token(client, "dl-comment-owner@example.com", "dl-comment-owner")
    owner_headers = _auth_headers(client)
    create = client.post(
        "/api/blogs",
        headers=owner_headers,
        json={
            "title": "Lifecycle comment delete post",
            "content": "Public discussion body.",
            "tag_ids": [tag_id],
            "is_published": True,
        },
    )
    assert create.status_code == 201
    blog_id = create.get_json()["id"]

    commenter = app.test_client()
    _register_and_token(commenter, "dl-commenter@example.com", "dl-commenter")
    commenter_headers = _auth_headers(commenter)
    root = commenter.post(f"/api/blogs/{blog_id}/comments", headers=commenter_headers, json={"content": "Parent"})
    assert root.status_code == 201
    root_id = root.get_json()["id"]

    reply = client.post(f"/api/blogs/{blog_id}/comments", headers=owner_headers, json={"content": "Reply", "parent_id": root_id})
    assert reply.status_code == 201
    reply_id = reply.get_json()["id"]

    execute = commenter.post(
        "/api/user/data-lifecycle/delete",
        headers=commenter_headers,
        json={"targets": ["comments"], "dry_run": False},
    )
    assert execute.status_code == 200

    with app.app_context():
        assert db.session.get(Comment, root_id) is None
        preserved = db.session.get(Comment, reply_id)
        assert preserved is not None
        assert preserved.parent_id is None
