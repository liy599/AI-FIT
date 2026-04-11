def _register_and_token(client, email: str, username: str):
    response = client.post(
        "/api/auth/register",
        json={"email": email, "username": username, "password": "pass1234"},
    )
    assert response.status_code == 200
    return response.get_json()["access_token"]


def _auth_header(token: str):
    return {"Authorization": f"Bearer {token}"}


def test_feedback_list_requires_auth(client):
    response = client.get("/api/feedback")
    assert response.status_code == 401


def test_feedback_list_requires_admin(client):
    user_token = _register_and_token(client, "user@example.com", "normal-user")
    admin_token = _register_and_token(client, "admin@example.com", "admin-user")

    submit = client.post(
        "/api/feedback",
        json={"type": "Review", "content": "good", "rating": 5, "contact_email": "anon@example.com"},
    )
    assert submit.status_code == 201

    forbidden = client.get("/api/feedback", headers=_auth_header(user_token))
    assert forbidden.status_code == 403

    allowed = client.get("/api/feedback", headers=_auth_header(admin_token))
    assert allowed.status_code == 200
    payload = allowed.get_json()
    assert payload["total"] == 1


def test_feedback_submit_without_type_still_works(client):
    response = client.post(
        "/api/feedback",
        json={"content": "great app", "rating": 5, "contact_email": "anon@example.com"},
    )
    assert response.status_code == 201
