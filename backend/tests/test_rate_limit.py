def _register(client, email: str, username: str, password: str = "pass1234"):
    return client.post("/api/auth/register", json={"email": email, "username": username, "password": password})


def test_login_rate_limit_by_ip(client, app):
    _register(client, "rl-login@example.com", "rl-login")
    app.config["AUTH_LOGIN_RATE_LIMIT_PER_IP"] = 2
    app.config["AUTH_LOGIN_RATE_LIMIT_IP_WINDOW_SECONDS"] = 3600
    app.config["AUTH_LOGIN_RATE_LIMIT_PER_ACCOUNT"] = 100
    app.config["AUTH_LOGIN_RATE_LIMIT_ACCOUNT_WINDOW_SECONDS"] = 3600

    r1 = client.post("/api/auth/login", json={"email": "rl-login@example.com", "password": "wrong"})
    r2 = client.post("/api/auth/login", json={"email": "rl-login@example.com", "password": "wrong"})
    r3 = client.post("/api/auth/login", json={"email": "rl-login@example.com", "password": "wrong"})

    assert r1.status_code == 401
    assert r2.status_code == 401
    assert r3.status_code == 429
    assert r3.get_json()["error"] == "too many requests"


def test_forgot_password_rate_limit_by_account(client, app):
    _register(client, "rl-forgot@example.com", "rl-forgot")
    app.config["AUTH_FORGOT_RATE_LIMIT_PER_IP"] = 100
    app.config["AUTH_FORGOT_RATE_LIMIT_IP_WINDOW_SECONDS"] = 3600
    app.config["AUTH_EMAIL_REQUEST_RATE_LIMIT_PER_ACCOUNT"] = 1
    app.config["AUTH_EMAIL_REQUEST_RATE_LIMIT_ACCOUNT_WINDOW_SECONDS"] = 3600

    r1 = client.post("/api/auth/forgot-password", json={"email": "rl-forgot@example.com"})
    r2 = client.post("/api/auth/forgot-password", json={"email": "rl-forgot@example.com"})

    assert r1.status_code == 200
    assert r2.status_code == 429
    assert r2.get_json()["error"] == "too many requests"


def test_verification_email_rate_limit_by_account(client, app):
    app.config["EMAIL_VERIFY_DEBUG_RETURN_LINK"] = True
    app.config["AUTH_FORGOT_RATE_LIMIT_PER_IP"] = 100
    app.config["AUTH_FORGOT_RATE_LIMIT_IP_WINDOW_SECONDS"] = 3600
    app.config["AUTH_EMAIL_REQUEST_RATE_LIMIT_PER_ACCOUNT"] = 1
    app.config["AUTH_EMAIL_REQUEST_RATE_LIMIT_ACCOUNT_WINDOW_SECONDS"] = 3600

    r1 = client.post("/api/auth/request-email-verification", json={"email": "rl-verify@example.com"})
    r2 = client.post("/api/auth/request-email-verification", json={"email": "rl-verify@example.com"})

    assert r1.status_code == 200
    assert r2.status_code == 429
    assert r2.get_json()["error"] == "too many requests"
