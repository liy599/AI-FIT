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


def test_forgot_password_requires_email(client):
    r = client.post("/api/auth/forgot-password", json={})
    assert r.status_code == 400


def test_forgot_password_email_not_found(client):
    r = client.post("/api/auth/forgot-password", json={"email": "noone@example.com"})
    assert r.status_code == 404
    payload = r.get_json()
    assert payload["error"] == "email not found"

