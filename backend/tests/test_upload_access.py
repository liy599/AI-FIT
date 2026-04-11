import os

from app.utils.upload_access import build_upload_access_token


def _write_file(path: str, content: bytes) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(content)


def test_public_upload_whitelist_allows_avatars(client, app):
    with app.app_context():
        root = app.config["UPLOAD_FOLDER"]
    avatar_path = os.path.join(root, "avatars", "public.txt")
    _write_file(avatar_path, b"ok")

    response = client.get("/uploads/avatars/public.txt")
    assert response.status_code == 200
    assert response.data == b"ok"


def test_private_upload_blocked_without_token(client, app):
    with app.app_context():
        root = app.config["UPLOAD_FOLDER"]
    private_path = os.path.join(root, "pose", "videos", "1", "private.mp4")
    _write_file(private_path, b"secret")

    response = client.get("/uploads/pose/videos/1/private.mp4")
    assert response.status_code == 403


def test_private_upload_allows_valid_signed_token(client, app):
    with app.app_context():
        root = app.config["UPLOAD_FOLDER"]
        rel = "pose/videos/1/tokened.mp4"
        private_path = os.path.join(root, "pose", "videos", "1", "tokened.mp4")
        _write_file(private_path, b"secret-ok")
        token = build_upload_access_token(rel)

    response = client.get(f"/uploads/{rel}?token={token}")
    assert response.status_code == 200
    assert response.data == b"secret-ok"

