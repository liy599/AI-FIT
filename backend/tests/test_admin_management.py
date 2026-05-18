def _csrf_headers(client):
    csrf_cookie = client.get_cookie("csrf_access_token")
    csrf_token = csrf_cookie.value if csrf_cookie is not None else ""
    return {"X-CSRF-TOKEN": csrf_token} if csrf_token else {}


def _register(client, email, username, password="pass1234"):
    response = client.post(
        "/api/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    assert response.status_code == 200
    return _csrf_headers(client)


def _set_admin(app, email):
    from app.extensions import db
    from app.models import User

    with app.app_context():
        user = User.query.filter_by(email=email).first()
        assert user is not None
        user.is_admin = True
        db.session.commit()


def _create_blog_tag(app, name="Training"):
    from app.extensions import db
    from app.models import Tag

    with app.app_context():
        tag = Tag.query.filter_by(name=name).first()
        if tag is None:
            tag = Tag(name=name)
            db.session.add(tag)
            db.session.commit()
        return tag.id


def test_admin_summary_and_users_require_admin(client):
    user_headers = _register(client, "normal-admin-test@example.com", "normal-admin-test")

    r = client.get("/api/admin/summary", headers=user_headers)
    assert r.status_code == 403

    r = client.get("/api/admin/users", headers=user_headers)
    assert r.status_code == 403


def test_admin_can_search_users_and_update_flags(client, app):
    admin_client = client.application.test_client()
    admin_headers = _register(admin_client, "admin-mgmt@example.com", "admin-mgmt")
    _set_admin(app, "admin-mgmt@example.com")

    user_client = client.application.test_client()
    _register(user_client, "member-mgmt@example.com", "member-mgmt")

    r = admin_client.get("/api/admin/users?q=member-mgmt", headers=admin_headers)
    assert r.status_code == 200
    payload = r.get_json()
    assert payload["total"] == 1
    user_id = payload["items"][0]["id"]
    assert payload["items"][0]["is_disabled"] is False

    r = admin_client.patch(
        f"/api/admin/users/{user_id}",
        headers=admin_headers,
        json={"is_admin": True, "is_disabled": True},
    )
    assert r.status_code == 200
    updated = r.get_json()
    assert updated["is_admin"] is True
    assert updated["is_disabled"] is True

    login = user_client.post("/api/auth/login", json={"email": "member-mgmt@example.com", "password": "pass1234"})
    assert login.status_code == 403


def test_admin_cannot_remove_or_disable_self(client, app):
    admin_client = client.application.test_client()
    admin_headers = _register(admin_client, "self-admin@example.com", "self-admin")
    _set_admin(app, "self-admin@example.com")

    me = admin_client.get("/api/auth/me", headers=admin_headers).get_json()

    r = admin_client.patch(f"/api/admin/users/{me['id']}", headers=admin_headers, json={"is_admin": False})
    assert r.status_code == 400

    r = admin_client.patch(f"/api/admin/users/{me['id']}", headers=admin_headers, json={"is_disabled": True})
    assert r.status_code == 400


def test_admin_can_reveal_user_contact(client, app):
    admin_client = client.application.test_client()
    admin_headers = _register(admin_client, "contact-admin@example.com", "contact-admin")
    _set_admin(app, "contact-admin@example.com")

    _register(client, "contact-user@example.com", "contact-user")
    users = admin_client.get("/api/admin/users?q=contact-user", headers=admin_headers).get_json()
    user_id = users["items"][0]["id"]

    r = admin_client.get(f"/api/admin/users/{user_id}/contact", headers=admin_headers)
    assert r.status_code == 200
    assert r.get_json()["email"] == "contact-user@example.com"


def test_admin_users_default_sort_is_id_ascending(client, app):
    admin_client = client.application.test_client()
    admin_headers = _register(admin_client, "sort-admin@example.com", "sort-admin")
    _set_admin(app, "sort-admin@example.com")

    _register(client.application.test_client(), "sort-a@example.com", "sort-a")
    _register(client.application.test_client(), "sort-b@example.com", "sort-b")

    r = admin_client.get("/api/admin/users?page=1&page_size=10", headers=admin_headers)
    assert r.status_code == 200
    ids = [item["id"] for item in r.get_json()["items"]]
    assert ids == sorted(ids)

    r = admin_client.get("/api/admin/users?sort_by=username&sort_dir=desc&page=1&page_size=10", headers=admin_headers)
    assert r.status_code == 200
    usernames = [item["username"] for item in r.get_json()["items"]]
    assert usernames == sorted(usernames, reverse=True)


def test_admin_can_manage_blogs(client, app):
    admin_client = client.application.test_client()
    admin_headers = _register(admin_client, "blog-admin@example.com", "blog-admin")
    _set_admin(app, "blog-admin@example.com")

    author_client = client.application.test_client()
    author_headers = _register(author_client, "blog-author@example.com", "blog-author")
    tag_id = _create_blog_tag(app)
    create = author_client.post(
        "/api/blogs",
        headers=author_headers,
        json={"title": "Admin managed blog", "content": "Body" * 40, "tag_ids": [tag_id], "is_published": True},
    )
    assert create.status_code == 201
    blog_id = create.get_json()["id"]

    r = admin_client.get("/api/admin/blogs?q=managed", headers=admin_headers)
    assert r.status_code == 200
    assert r.get_json()["total"] == 1

    r = admin_client.patch(f"/api/admin/blogs/{blog_id}", headers=admin_headers, json={"is_published": False})
    assert r.status_code == 200
    assert r.get_json()["is_published"] is False
    assert r.get_json()["status"] == "unpublished"
    assert client.get(f"/api/blogs/{blog_id}").status_code == 404

    r = author_client.put(f"/api/blogs/{blog_id}", headers=author_headers, json={"moderation_action": "request_restore"})
    assert r.status_code == 200
    r = admin_client.get("/api/admin/blogs?status=restore_requested", headers=admin_headers)
    assert r.status_code == 200
    assert r.get_json()["total"] == 1
    assert r.get_json()["items"][0]["restore_requested"] is True

    r = admin_client.patch(f"/api/admin/blogs/{blog_id}", headers=admin_headers, json={"is_published": True})
    assert r.status_code == 200
    assert r.get_json()["is_published"] is True
    assert r.get_json()["status"] == "published"
    assert r.get_json()["restore_requested"] is False

    draft = author_client.post(
        "/api/blogs",
        headers=author_headers,
        json={"title": "Private draft post", "content": "Draft body" * 40, "tag_ids": [tag_id], "is_published": False},
    )
    assert draft.status_code == 201
    draft_id = draft.get_json()["id"]

    r = admin_client.patch(f"/api/admin/blogs/{draft_id}", headers=admin_headers, json={"is_published": True})
    assert r.status_code == 400

    r = admin_client.delete(f"/api/admin/blogs/{blog_id}", headers=admin_headers)
    assert r.status_code == 200
    assert client.get(f"/api/blogs/{blog_id}").status_code == 404


def test_admin_blogs_default_sort_is_id_ascending(client, app):
    admin_client = client.application.test_client()
    admin_headers = _register(admin_client, "blog-sort-admin@example.com", "blog-sort-admin")
    _set_admin(app, "blog-sort-admin@example.com")

    author_client = client.application.test_client()
    author_headers = _register(author_client, "blog-sort-author@example.com", "blog-sort-author")
    tag_id = _create_blog_tag(app)
    for title in ["Charlie post", "Alpha post", "Bravo post"]:
        response = author_client.post(
            "/api/blogs",
            headers=author_headers,
            json={"title": title, "content": "Body" * 40, "tag_ids": [tag_id], "is_published": True},
        )
        assert response.status_code == 201

    r = admin_client.get("/api/admin/blogs?page=1&page_size=10", headers=admin_headers)
    assert r.status_code == 200
    ids = [item["id"] for item in r.get_json()["items"]]
    assert ids == sorted(ids)

    r = admin_client.get("/api/admin/blogs?sort_by=title&sort_dir=asc&page=1&page_size=10", headers=admin_headers)
    assert r.status_code == 200
    titles = [item["title"] for item in r.get_json()["items"]]
    assert titles == sorted(titles)
