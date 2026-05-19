from app.routes.account import auth as auth_routes


def _verify_email(client, monkeypatch, email):
    code = _request_verification_email(client, monkeypatch, email)
    r = client.post("/api/auth/verify-email", json={"email": email, "code": code})
    assert r.status_code == 200
    assert r.get_json()["email"] == email


def _request_verification_email(client, monkeypatch, email):
    sent = {}

    def fake_send_email_verification_email(*, to_email, verification_code):
        sent["to_email"] = to_email
        sent["verification_code"] = verification_code

    client.application.config.update(
        EMAIL_VERIFY_DEBUG_RETURN_LINK=False,
        SMTP_HOST="smtp.example.test",
        SMTP_FROM="noreply@example.test",
    )
    monkeypatch.setattr(auth_routes, "send_email_verification_email", fake_send_email_verification_email)

    r = client.post("/api/auth/request-email-verification", json={"email": email})
    assert r.status_code == 200
    assert r.get_json()["email_sent"] is True
    assert sent["to_email"] == email
    assert sent["verification_code"]
    return sent["verification_code"]


def test_request_verification_resets_previous_confirmation(client, monkeypatch):
    email = "again@example.com"
    client.application.config["EMAIL_VERIFY_REQUIRED"] = True
    _verify_email(client, monkeypatch, email)

    r = client.get(f"/api/auth/email-verification-status?email={email}")
    assert r.status_code == 200
    assert r.get_json()["email_verified"] is True

    _request_verification_email(client, monkeypatch, email)

    r = client.get(f"/api/auth/email-verification-status?email={email}")
    assert r.status_code == 200
    assert r.get_json()["email_verified"] is False

    r = client.post(
        "/api/auth/register",
        json={"email": email, "username": "again", "password": "pass1234"},
    )
    assert r.status_code == 403
    assert r.get_json()["error"] == "email not verified"


def test_email_confirmation_accepts_valid_earlier_link_after_resend(client, monkeypatch):
    email = "delayed@example.com"
    first_code = _request_verification_email(client, monkeypatch, email)
    _request_verification_email(client, monkeypatch, email)

    r = client.post("/api/auth/verify-email", json={"email": email, "code": first_code})
    assert r.status_code == 400
    assert r.get_json()["error"] in {"invalid code", "code expired"}

    second_code = _request_verification_email(client, monkeypatch, email)
    r = client.post("/api/auth/verify-email", json={"email": email, "code": second_code})
    assert r.status_code == 200
    assert r.get_json()["email"] == email


def test_register_requires_verified_email(client):
    client.application.config["EMAIL_VERIFY_REQUIRED"] = True
    r = client.post(
        "/api/auth/register",
        json={"email": "locked@example.com", "username": "locked", "password": "pass1234"},
    )
    assert r.status_code == 403
    assert r.get_json()["error"] == "email not verified"


def test_register_login_me(client, monkeypatch):
    _verify_email(client, monkeypatch, "a@example.com")

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


def test_password_reset_flow(client, monkeypatch):
    _verify_email(client, monkeypatch, "b@example.com")

    client.post(
        "/api/auth/register",
        json={"email": "b@example.com", "username": "bob", "password": "oldpass1"},
    )

    r = client.post("/api/auth/forgot-password", json={"email": "b@example.com"})
    assert r.status_code == 200
    code = r.get_json()["reset_code"]

    r = client.post("/api/auth/reset-password", json={"email": "b@example.com", "code": code, "new_password": "newpass1"})
    assert r.status_code == 200

    r = client.post("/api/auth/login", json={"email": "b@example.com", "password": "newpass1"})
    assert r.status_code == 200


def test_forgot_password_requires_email(client):
    r = client.post("/api/auth/forgot-password", json={})
    assert r.status_code == 400


def test_forgot_password_email_not_found(client):
    r = client.post("/api/auth/forgot-password", json={"email": "noone@example.com"})
    assert r.status_code == 404
    payload = r.get_json()
    assert payload["error"] == "email not found"

