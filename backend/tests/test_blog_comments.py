from app.extensions import db
from app.models import Tag


def _auth_headers(client, email="u@example.com", username="u1"):
    r = client.post("/api/auth/register", json={"email": email, "username": username, "password": "pass1234"})
    assert r.status_code == 200
    csrf_cookie = client.get_cookie("csrf_access_token")
    csrf_token = csrf_cookie.value if csrf_cookie is not None else ""
    return {"X-CSRF-TOKEN": csrf_token} if csrf_token else {}


def test_blog_list_detail_like_and_comment(client, app):
    with app.app_context():
        t = Tag(name="Fitness Tips")
        db.session.add(t)
        db.session.commit()
        tag_id = t.id

    headers = _auth_headers(client)

    r = client.post(
        "/api/blogs",
        headers=headers,
        json={"title": "Hello", "content": "World" * 50, "tag_ids": [tag_id], "is_published": True},
    )
    assert r.status_code == 201
    blog_id = r.get_json()["id"]

    r = client.get("/api/blogs")
    assert r.status_code == 200
    assert r.get_json()["total"] == 1

    r = client.get(f"/api/blogs/{blog_id}", headers=headers)
    assert r.status_code == 200
    assert r.get_json()["liked_by_me"] is False

    r = client.post(f"/api/blogs/{blog_id}/like", headers=headers)
    assert r.status_code == 200
    assert r.get_json()["liked"] is True

    r = client.post(f"/api/blogs/{blog_id}/comments", headers=headers, json={"content": "Nice"})
    assert r.status_code == 201

    r = client.get(f"/api/blogs/{blog_id}/comments", headers=headers)
    assert r.status_code == 200
    assert r.get_json()["total"] == 1
