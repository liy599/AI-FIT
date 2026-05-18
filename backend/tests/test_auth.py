def test_register_login_me(client):
    r = client.post(
        "/api/auth/register",
        json={"email": "a@example.com", "username": "alice", "password": "pass1234"},
    )
    assert r.status_code == 200
    assert r.get_json()["user"]["email"] == "a@example.com"

    r = client.post("/api/auth/login", json={"email": "a@example.com", "password": "pass1234"})
    assert r.status_code == 200
    assert r.get_json()["user"]["email"] == "a@example.com"

    r = client.get("/api/auth/me")
    assert r.status_code == 200
    assert r.get_json()["email"] == "a@example.com"


def test_register_rejects_invalid_inputs(client):
    r = client.post(
        "/api/auth/register",
        json={"email": "not-an-email", "username": "alice", "password": "pass1234"},
    )
    assert r.status_code == 400
    assert r.get_json()["error"] == "invalid email"

    r = client.post(
        "/api/auth/register",
        json={"email": "a@example.com", "username": "al", "password": "pass1234"},
    )
    assert r.status_code == 400
    assert r.get_json()["error"] == "username too short"

    r = client.post(
        "/api/auth/register",
        json={"email": "a@example.com", "username": "alice", "password": "short"},
    )
    assert r.status_code == 400
    assert r.get_json()["error"] == "password too short"


def test_disabled_user_cannot_login_or_continue_session(client, app):
    r = client.post(
        "/api/auth/register",
        json={"email": "disabled@example.com", "username": "disabled-user", "password": "pass1234"},
    )
    assert r.status_code == 200
    assert client.get("/api/auth/me").status_code == 200

    from app.extensions import db
    from app.models import User

    with app.app_context():
        user = User.query.filter_by(email="disabled@example.com").first()
        user.is_disabled = True
        db.session.commit()

    r = client.get("/api/auth/me")
    assert r.status_code == 403
    assert r.get_json()["error"] == "account disabled"

    fresh_client = client.application.test_client()
    r = fresh_client.post("/api/auth/login", json={"email": "disabled@example.com", "password": "pass1234"})
    assert r.status_code == 403
    assert r.get_json()["error"] == "account disabled"


def test_password_reset_flow(client):
    client.post(
        "/api/auth/register",
        json={"email": "b@example.com", "username": "bob", "password": "old-pass"},
    )

    r = client.post("/api/auth/forgot-password", json={"email": "b@example.com"})
    assert r.status_code == 200
    reset_link = r.get_json()["reset_link"]
    token = reset_link.split("token=", 1)[1]

    r = client.post("/api/auth/reset-password", json={"token": token, "new_password": "new-pass"})
    assert r.status_code == 200

    r = client.post("/api/auth/login", json={"email": "b@example.com", "password": "new-pass"})
    assert r.status_code == 200


def test_password_reset_rejects_short_password(client):
    client.post(
        "/api/auth/register",
        json={"email": "short-reset@example.com", "username": "shortreset", "password": "old-pass"},
    )
    r = client.post("/api/auth/forgot-password", json={"email": "short-reset@example.com"})
    reset_link = r.get_json()["reset_link"]
    token = reset_link.split("token=", 1)[1]

    r = client.post("/api/auth/reset-password", json={"token": token, "new_password": "short"})
    assert r.status_code == 400
    assert r.get_json()["error"] == "password too short"


def test_forgot_password_requires_email(client):
    r = client.post("/api/auth/forgot-password", json={})
    assert r.status_code == 400


def test_forgot_password_email_not_found(client):
    r = client.post("/api/auth/forgot-password", json={"email": "noone@example.com"})
    assert r.status_code == 404
    payload = r.get_json()
    assert payload["error"] == "email not found"

