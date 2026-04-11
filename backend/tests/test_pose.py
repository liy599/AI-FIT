from io import BytesIO


def register_and_token(client, email="pose@example.com", username="pose-user", password="pass1234"):
    response = client.post(
        "/api/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    assert response.status_code == 200
    return response.get_json()["access_token"]


def auth_header(token: str):
    return {"Authorization": f"Bearer {token}"}


def upload_video(client, token: str, filename="sample.mp4", content=b"fake mp4 bytes"):
    response = client.post(
        "/api/pose/videos",
        headers=auth_header(token),
        data={"file": (BytesIO(content), filename, "video/mp4")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 201
    return response.get_json()["video"]


def test_pose_video_upload_list_and_file_access(client):
    token = register_and_token(client)
    video = upload_video(client, token)

    response = client.get("/api/pose/videos", headers=auth_header(token))
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["total"] == 1
    assert payload["items"][0]["id"] == video["id"]

    response = client.get(f"/api/pose/videos/{video['id']}/file", headers=auth_header(token))
    assert response.status_code == 200
    assert response.data == b"fake mp4 bytes"
    assert response.mimetype == "video/mp4"

    signed = client.get(f"/api/pose/videos/{video['id']}/signed-url", headers=auth_header(token))
    assert signed.status_code == 200
    signed_url = signed.get_json()["url"]
    public_fetch = client.get(signed_url)
    assert public_fetch.status_code == 200
    assert public_fetch.data == b"fake mp4 bytes"


def test_pose_analysis_task_complete_flow(client):
    token = register_and_token(client)
    video = upload_video(client, token)

    response = client.post(
        "/api/pose/analysis/tasks",
        headers=auth_header(token),
        json={
            "video_asset_id": video["id"],
            "exercise_type": "squat",
            "view_angle": "side",
            "instruction": "keep stable",
        },
    )
    assert response.status_code == 201
    task = response.get_json()["task"]
    assert task["status"] == "running"
    assert task["video"]["id"] == video["id"]

    report = {
        "version": 3,
        "status": "ok",
        "summary": "analysis ok",
        "keyMetrics": {"avgScore": 88},
        "issues": [],
        "suggestions": ["brace harder"],
    }
    response = client.post(
        f"/api/pose/analysis/tasks/{task['id']}/complete",
        headers=auth_header(token),
        json={"report": report},
    )
    assert response.status_code == 200
    completed = response.get_json()["task"]
    assert completed["status"] == "succeeded"
    assert completed["result"]["report"]["summary"] == "analysis ok"

    response = client.get(f"/api/pose/analysis/tasks/{task['id']}", headers=auth_header(token))
    assert response.status_code == 200
    fetched = response.get_json()["task"]
    assert fetched["status"] == "succeeded"
    assert fetched["result"]["report"]["keyMetrics"]["avgScore"] == 88


def test_pose_analysis_task_fail_flow(client):
    token = register_and_token(client, email="pose2@example.com", username="pose-user-2")
    video = upload_video(client, token, filename="sample2.mp4", content=b"another fake mp4")

    response = client.post(
        "/api/pose/analysis/tasks",
        headers=auth_header(token),
        json={"video_asset_id": video["id"], "exercise_type": "squat", "view_angle": "front"},
    )
    assert response.status_code == 201
    task = response.get_json()["task"]

    response = client.post(
        f"/api/pose/analysis/tasks/{task['id']}/fail",
        headers=auth_header(token),
        json={"error": "MediaPipe analysis failed"},
    )
    assert response.status_code == 200
    failed = response.get_json()["task"]
    assert failed["status"] == "failed"
    assert failed["error_message"] == "MediaPipe analysis failed"


def test_pose_training_save(client):
    token = register_and_token(client, email="pose3@example.com", username="pose-user-3")

    response = client.post(
        "/api/pose/trainings",
        headers=auth_header(token),
        json={
            "started_at": "2026-04-05T12:00:00Z",
            "ended_at": "2026-04-05T12:05:00Z",
            "exercise_type": "squat",
            "note": "saved from live page",
            "sets": [{"reps": 12, "note": "live coaching"}],
            "report": {"summary": "live report"},
        },
    )
    assert response.status_code == 201
    session = response.get_json()["session"]
    assert session["note"] == "saved from live page"
    assert session["report"]["summary"] == "live report"
    assert len(session["sets"]) == 1
    assert session["sets"][0]["exercise_type"] == "squat"
    assert session["sets"][0]["reps"] == 12


def test_pose_training_list_and_detail_with_date_filter(client):
    token = register_and_token(client, email="pose4@example.com", username="pose-user-4")

    response = client.post(
        "/api/pose/trainings",
        headers=auth_header(token),
        json={
            "started_at": "2026-04-01T08:00:00Z",
            "ended_at": "2026-04-01T08:04:00Z",
            "exercise_type": "squat",
            "sets": [{"reps": 10}],
            "report": {"summary": "older"},
        },
    )
    assert response.status_code == 201
    older_id = response.get_json()["session"]["id"]

    response = client.post(
        "/api/pose/trainings",
        headers=auth_header(token),
        json={
            "started_at": "2026-04-08T09:00:00Z",
            "ended_at": "2026-04-08T09:06:00Z",
            "exercise_type": "squat",
            "sets": [{"reps": 14}],
            "report": {"summary": "newer"},
        },
    )
    assert response.status_code == 201
    newer_id = response.get_json()["session"]["id"]

    response = client.get("/api/pose/trainings?page=1&page_size=20", headers=auth_header(token))
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["total"] == 2
    assert payload["items"][0]["id"] == newer_id
    assert payload["items"][1]["id"] == older_id

    response = client.get("/api/pose/trainings?date_from=2026-04-05&date_to=2026-04-10", headers=auth_header(token))
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["total"] == 1
    assert payload["items"][0]["id"] == newer_id

    response = client.get(f"/api/pose/trainings/{newer_id}", headers=auth_header(token))
    assert response.status_code == 200
    detail = response.get_json()["session"]
    assert detail["id"] == newer_id
    assert detail["report"]["summary"] == "newer"


def test_pose_training_report_schema_invalid_version_is_dropped_on_create(client):
    token = register_and_token(client, email="pose5@example.com", username="pose-user-5")

    response = client.post(
        "/api/pose/trainings",
        headers=auth_header(token),
        json={
            "started_at": "2026-04-05T12:00:00Z",
            "ended_at": "2026-04-05T12:05:00Z",
            "exercise_type": "squat",
            "sets": [{"reps": 12}],
            "report": {"version": 999, "status": "ok", "summary": "bad schema"},
        },
    )
    assert response.status_code == 201
    payload = response.get_json()
    assert payload["session"]["report"] is None
    assert "warnings" in payload
    assert "report_dropped" in payload["warnings"]


def test_pose_training_report_too_large_is_compacted(client):
    token = register_and_token(client, email="pose6@example.com", username="pose-user-6")
    app = client.application
    app.config["POSE_TRAINING_REPORT_MAX_BYTES"] = 40000

    timeline = [{"frame": i, "tMs": i * 33, "phase": "down", "trackingQuality": 0.8} for i in range(400)]
    report = {
        "version": 3,
        "status": "ok",
        "summary": "x" * 500,
        "keyMetrics": {"totalReps": 12},
        "issues": [{"severity": "warning", "message": "m" * 900} for _ in range(10)],
        "suggestions": ["s" * 500 for _ in range(20)],
        "details": {"timelineSampled": timeline},
        "sections": {"timelineSampled": timeline},
    }

    response = client.post(
        "/api/pose/trainings",
        headers=auth_header(token),
        json={
            "started_at": "2026-04-05T12:00:00Z",
            "ended_at": "2026-04-05T12:05:00Z",
            "exercise_type": "squat",
            "sets": [{"reps": 12}],
            "report": report,
        },
    )
    assert response.status_code == 201
    payload = response.get_json()
    assert payload["session"]["report"] is not None
    assert "warnings" in payload
    assert "report_compacted" in payload["warnings"]
    assert len(payload["session"]["report"]["details"]["timelineSampled"]) == 180


def test_pose_training_update_report_rejects_invalid_schema(client):
    token = register_and_token(client, email="pose7@example.com", username="pose-user-7")

    response = client.post(
        "/api/pose/trainings",
        headers=auth_header(token),
        json={
            "started_at": "2026-04-05T12:00:00Z",
            "ended_at": "2026-04-05T12:05:00Z",
            "exercise_type": "squat",
            "sets": [{"reps": 12}],
            "report": {"summary": "ok"},
        },
    )
    assert response.status_code == 201
    session_id = response.get_json()["session"]["id"]

    response = client.put(
        f"/api/pose/trainings/{session_id}/report",
        headers=auth_header(token),
        json={"report": {"version": 999, "status": "ok", "summary": "bad"}},
    )
    assert response.status_code == 400


def test_pose_training_internal_recompute_report_stub(client):
    token = register_and_token(client, email="pose8@example.com", username="pose-user-8")

    response = client.post(
        "/api/pose/trainings",
        headers=auth_header(token),
        json={
            "started_at": "2026-04-05T12:00:00Z",
            "ended_at": "2026-04-05T12:05:00Z",
            "exercise_type": "squat",
            "sets": [{"reps": 5}],
        },
    )
    assert response.status_code == 201
    session_id = response.get_json()["session"]["id"]

    response = client.post(
        f"/api/pose/internal/trainings/{session_id}/recompute-report",
        headers=auth_header(token),
        json={"mode": "stub"},
    )
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["session"]["report"] is not None
    assert payload["session"]["report"]["details"]["type"] == "recomputed_stub"
