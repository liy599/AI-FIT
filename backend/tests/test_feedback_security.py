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


def test_feedback_list_requires_auth(client):
    response = client.get("/api/feedback")
    assert response.status_code == 401


def test_feedback_list_requires_admin(client):
    user_client = client.application.test_client()
    admin_client = client.application.test_client()

    user_token = _register_and_token(user_client, "user@example.com", "normal-user")
    _ = user_token
    user_headers = _auth_headers(user_client)
    admin_token = _register_and_token(admin_client, "admin@example.com", "admin-user")
    _ = admin_token
    admin_headers = _auth_headers(admin_client)

    submit = admin_client.post(
        "/api/feedback",
        headers=admin_headers,
        json={"type": "Review", "content": "good", "rating": 5, "contact_email": "anon@example.com"},
    )
    assert submit.status_code == 201

    forbidden = user_client.get("/api/feedback", headers=user_headers)
    assert forbidden.status_code == 403

    allowed = admin_client.get("/api/feedback", headers=admin_headers)
    assert allowed.status_code == 200
    payload = allowed.get_json()
    assert payload["total"] == 1


def test_feedback_submit_without_type_still_works(client):
    response = client.post(
        "/api/feedback",
        json={"content": "great app", "rating": 5, "contact_email": "anon@example.com"},
    )
    assert response.status_code == 201
