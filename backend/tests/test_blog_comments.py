from app.extensions import db
from app.models import Blog, Comment, Tag


def _auth_headers(client, email="u@example.com", username="user1"):
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
        json={
            "title": "Hello fitness training blog post",
            "content": "World " * 50,
            "tag_ids": [tag_id],
            "is_published": True,
        },
    )
    assert r.status_code == 201
    blog_id = r.get_json()["id"]

    r = client.get("/api/blogs")
    assert r.status_code == 200
    assert r.get_json()["total"] == 1

    r = client.get(f"/api/blogs/{blog_id}?view=1", headers=headers)
    assert r.status_code == 200
    assert r.get_json()["liked_by_me"] is False

    r = client.get(f"/api/blogs/{blog_id}?view=1", headers=headers)
    assert r.status_code == 200
    with app.app_context():
        assert db.session.get(Blog, blog_id).view_count == 1

    r = client.get(f"/api/blogs/{blog_id}", headers=headers)
    assert r.status_code == 200
    with app.app_context():
        assert db.session.get(Blog, blog_id).view_count == 1

    r = client.post(f"/api/blogs/{blog_id}/like", headers=headers)
    assert r.status_code == 200
    assert r.get_json()["liked"] is True

    r = client.post(f"/api/blogs/{blog_id}/comments", headers=headers, json={"content": "Nice"})
    assert r.status_code == 201

    r = client.get(f"/api/blogs/{blog_id}/comments", headers=headers)
    assert r.status_code == 200
    assert r.get_json()["total"] == 1


def test_blog_tag_filter_uses_canonical_aliases(client, app):
    with app.app_context():
        legacy = Tag(name="Nutrition")
        db.session.add(legacy)
        db.session.commit()
        legacy_id = legacy.id

    headers = _auth_headers(client, email="diet@example.com", username="dietuser")
    r = client.post(
        "/api/blogs",
        headers=headers,
        json={
            "title": "Healthy meal prep for training",
            "content": "A short nutrition post.",
            "tag_ids": [legacy_id],
            "is_published": True,
        },
    )
    assert r.status_code == 201

    r = client.get("/api/tags")
    assert r.status_code == 200
    diet_tag = next(tag for tag in r.get_json() if tag["name"] == "Diet")

    r = client.get(f"/api/blogs?tag={diet_tag['id']}")
    assert r.status_code == 200
    data = r.get_json()
    assert data["total"] == 1
    assert data["items"][0]["tags"][0]["name"] == "Nutrition"


def test_comment_like_requires_public_blog(client, app):
    with app.app_context():
        t = Tag(name="Training")
        db.session.add(t)
        db.session.commit()
        tag_id = t.id

    headers = _auth_headers(client, email="comment-like@example.com", username="commentlike")
    create = client.post(
        "/api/blogs",
        headers=headers,
        json={
            "title": "Comment privacy boundary post",
            "content": "Public body before moderation.",
            "tag_ids": [tag_id],
            "is_published": True,
        },
    )
    assert create.status_code == 201
    blog_id = create.get_json()["id"]

    comment = client.post(f"/api/blogs/{blog_id}/comments", headers=headers, json={"content": "Nice update"})
    assert comment.status_code == 201
    comment_id = comment.get_json()["id"]

    with app.app_context():
        blog = db.session.get(Blog, blog_id)
        blog.is_published = False
        blog.moderation_status = "unpublished"
        db.session.commit()

    response = client.post(f"/api/comments/{comment_id}/like", headers=headers)
    assert response.status_code == 404


def test_comment_reply_creates_notification_with_target_page(client, app):
    with app.app_context():
        t = Tag(name="Training")
        db.session.add(t)
        db.session.commit()
        tag_id = t.id

    author_headers = _auth_headers(client, email="notify-author@example.com", username="notifyauthor")
    create = client.post(
        "/api/blogs",
        headers=author_headers,
        json={
            "title": "Reply notification post",
            "content": "Public discussion body.",
            "tag_ids": [tag_id],
            "is_published": True,
        },
    )
    assert create.status_code == 201
    blog_id = create.get_json()["id"]

    commenter = app.test_client()
    commenter_headers = _auth_headers(commenter, email="notify-commenter@example.com", username="notifycommenter")
    root = commenter.post(f"/api/blogs/{blog_id}/comments", headers=commenter_headers, json={"content": "Question"})
    assert root.status_code == 201
    root_id = root.get_json()["id"]

    reply = client.post(f"/api/blogs/{blog_id}/comments", headers=author_headers, json={"content": "Answer", "parent_id": root_id})
    assert reply.status_code == 201
    reply_id = reply.get_json()["id"]

    notifications = commenter.get("/api/user/notifications", headers=commenter_headers)
    assert notifications.status_code == 200
    data = notifications.get_json()
    assert data["unread_count"] == 1
    assert data["items"][0]["comment_id"] == reply_id
    assert data["items"][0]["root_comment_id"] == root_id
    assert data["items"][0]["comment_page"] == 1

    mark = commenter.post(f"/api/user/notifications/{data['items'][0]['id']}/read", headers=commenter_headers)
    assert mark.status_code == 200
    assert commenter.get("/api/user/notifications", headers=commenter_headers).get_json()["unread_count"] == 0


def test_deleting_parent_comment_preserves_replies(client, app):
    with app.app_context():
        t = Tag(name="Training")
        db.session.add(t)
        db.session.commit()
        tag_id = t.id

    author_headers = _auth_headers(client, email="delete-parent-author@example.com", username="deleteparentauthor")
    create = client.post(
        "/api/blogs",
        headers=author_headers,
        json={
            "title": "Comment parent delete post",
            "content": "Public discussion body.",
            "tag_ids": [tag_id],
            "is_published": True,
        },
    )
    assert create.status_code == 201
    blog_id = create.get_json()["id"]

    commenter = app.test_client()
    commenter_headers = _auth_headers(commenter, email="delete-parent-commenter@example.com", username="deleteparentcommenter")
    root = commenter.post(f"/api/blogs/{blog_id}/comments", headers=commenter_headers, json={"content": "Parent"})
    assert root.status_code == 201
    root_id = root.get_json()["id"]

    reply = client.post(f"/api/blogs/{blog_id}/comments", headers=author_headers, json={"content": "Reply", "parent_id": root_id})
    assert reply.status_code == 201
    reply_id = reply.get_json()["id"]

    delete = commenter.delete(f"/api/comments/{root_id}", headers=commenter_headers)
    assert delete.status_code == 200

    with app.app_context():
        assert db.session.get(Comment, root_id) is None
        preserved = db.session.get(Comment, reply_id)
        assert preserved is not None
        assert preserved.parent_id is None


def test_author_can_read_existing_comments_after_moving_blog_to_draft(client, app):
    with app.app_context():
        t = Tag(name="Training")
        db.session.add(t)
        db.session.commit()
        tag_id = t.id

    author_headers = _auth_headers(client, email="draft-comments@example.com", username="draftcomments")
    create = client.post(
        "/api/blogs",
        headers=author_headers,
        json={
            "title": "Published post with comments",
            "content": "Public before becoming a draft.",
            "tag_ids": [tag_id],
            "is_published": True,
        },
    )
    assert create.status_code == 201
    blog_id = create.get_json()["id"]

    comment = client.post(f"/api/blogs/{blog_id}/comments", headers=author_headers, json={"content": "Historical comment"})
    assert comment.status_code == 201

    move_to_draft = client.put(f"/api/blogs/{blog_id}", headers=author_headers, json={"is_published": False})
    assert move_to_draft.status_code == 200

    author_read = client.get(f"/api/blogs/{blog_id}/comments", headers=author_headers)
    assert author_read.status_code == 200
    assert author_read.get_json()["total"] == 1

    anonymous_client = app.test_client()
    anonymous_read = anonymous_client.get(f"/api/blogs/{blog_id}/comments")
    assert anonymous_read.status_code == 404

    new_comment = client.post(f"/api/blogs/{blog_id}/comments", headers=author_headers, json={"content": "New private comment"})
    assert new_comment.status_code == 404


def test_private_published_blog_is_owner_only_and_not_interactive(client, app):
    with app.app_context():
        t = Tag(name="Other")
        db.session.add(t)
        db.session.commit()
        tag_id = t.id

    headers = _auth_headers(client, email="private-blog@example.com", username="privateblog")
    create = client.post(
        "/api/blogs",
        headers=headers,
        json={
            "title": "Private progress update",
            "content": "Private caption with training context.",
            "tag_ids": [tag_id],
            "is_published": True,
            "visibility": "private",
            "image_urls": ["/uploads/blog_covers/a.png", "/uploads/blog_covers/b.png"],
        },
    )
    assert create.status_code == 201
    blog_id = create.get_json()["id"]

    listing = client.get("/api/blogs")
    assert listing.status_code == 200
    assert listing.get_json()["total"] == 0

    detail = client.get(f"/api/blogs/{blog_id}", headers=headers)
    assert detail.status_code == 200
    assert detail.get_json()["visibility"] == "private"
    assert detail.get_json()["image_urls"] == ["/uploads/blog_covers/a.png", "/uploads/blog_covers/b.png"]

    anonymous = app.test_client()
    assert anonymous.get(f"/api/blogs/{blog_id}").status_code == 404
    assert client.post(f"/api/blogs/{blog_id}/like", headers=headers).status_code == 404
    assert client.post(f"/api/blogs/{blog_id}/comments", headers=headers, json={"content": "No public interaction"}).status_code == 404
