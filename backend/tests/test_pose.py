
def register_and_token(client, email="pose@example.com", username="pose-user", password="pass1234"):
    response = client.post(
        "/api/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    assert response.status_code == 200
    return response.get_json()["user"]["id"]


def auth_headers(client):
    # Cookie-based JWT requires explicit CSRF header on state-changing requests.
    csrf_cookie = client.get_cookie("csrf_access_token")
    csrf_token = csrf_cookie.value if csrf_cookie is not None else ""
    return {"X-CSRF-TOKEN": csrf_token} if csrf_token else {}


def test_pose_training_save(client):
    token = register_and_token(client, email="pose3@example.com", username="pose-user-3")

    response = client.post(
        "/api/pose/trainings",
        headers=auth_headers(client),
        json={
            "started_at": "2026-04-05T12:00:00Z",
            "ended_at": "2026-04-05T12:05:00Z",
            "exercise_type": "squat",
            "note": "saved from video analysis",
            "sets": [{"reps": 12, "note": "video analysis"}],
            "report": {
                "summary": "video report",
                "details": {"policy": {"version": "2026-05-04.v1"}},
                "sections": {"overview": {"policyVersion": "2026-05-04.v1"}},
            },
        },
    )
    assert response.status_code == 201
    session = response.get_json()["session"]
    assert session["note"] == "saved from video analysis"
    assert session["report"]["summary"] == "video report"
    assert session["report"]["details"]["policy"]["version"] == "2026-05-04.v1"
    assert session["report"]["sections"]["overview"]["policyVersion"] == "2026-05-04.v1"
    assert len(session["sets"]) == 1
    assert session["sets"][0]["exercise_type"] == "squat"
    assert session["sets"][0]["reps"] == 12


def test_pose_policy_version_switch_is_traceable(client):
    client.application.config["POSE_POLICY_VERSION"] = "2026-05-04.test-switch"
    policy_response = client.get("/api/pose/policy")
    assert policy_response.status_code == 200
    assert policy_response.get_json()["version"] == "2026-05-04.test-switch"

    token = register_and_token(client, email="pose-policy-switch@example.com", username="pose-switch")
    _ = token
    response = client.post(
        "/api/pose/trainings",
        headers=auth_headers(client),
        json={
            "started_at": "2026-05-04T10:00:00Z",
            "ended_at": "2026-05-04T10:02:00Z",
            "exercise_type": "squat",
            "sets": [{"reps": 3}],
            "report": {
                "summary": "policy switch",
                "details": {"policy": {"version": "2026-05-04.test-switch"}},
                "sections": {"overview": {"policyVersion": "2026-05-04.test-switch"}},
            },
        },
    )
    assert response.status_code == 201
    session_id = response.get_json()["session"]["id"]

    detail = client.get(f"/api/pose/trainings/{session_id}", headers=auth_headers(client))
    assert detail.status_code == 200
    report = detail.get_json()["session"]["report"]
    assert report["details"]["policy"]["version"] == "2026-05-04.test-switch"
    assert report["sections"]["overview"]["policyVersion"] == "2026-05-04.test-switch"


def test_pose_training_list_and_detail_with_date_filter(client):
    token = register_and_token(client, email="pose4@example.com", username="pose-user-4")

    response = client.post(
        "/api/pose/trainings",
        headers=auth_headers(client),
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
        headers=auth_headers(client),
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

    response = client.get("/api/pose/trainings?page=1&page_size=20")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["total"] == 2
    assert payload["items"][0]["id"] == newer_id
    assert payload["items"][1]["id"] == older_id

    response = client.get("/api/pose/trainings?date_from=2026-04-05&date_to=2026-04-10")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["total"] == 1
    assert payload["items"][0]["id"] == newer_id

    response = client.get(f"/api/pose/trainings/{newer_id}")
    assert response.status_code == 200
    detail = response.get_json()["session"]
    assert detail["id"] == newer_id
    assert detail["report"]["summary"] == "newer"


def test_pose_training_delete_own_session_only(client):
    register_and_token(client, email="pose-delete-owner@example.com", username="posedeleteown")

    response = client.post(
        "/api/pose/trainings",
        headers=auth_headers(client),
        json={
            "started_at": "2026-04-12T08:00:00Z",
            "ended_at": "2026-04-12T08:05:00Z",
            "exercise_type": "squat",
            "sets": [{"reps": 8}],
            "report": {"summary": "owner report"},
        },
    )
    assert response.status_code == 201
    owner_session_id = response.get_json()["session"]["id"]

    register_and_token(client, email="pose-delete-other@example.com", username="posedeleteoth")
    denied = client.delete(f"/api/pose/trainings/{owner_session_id}", headers=auth_headers(client))
    assert denied.status_code == 404

    register_and_token(client, email="pose-delete-owner-2@example.com", username="posedelete2")
    own = client.post(
        "/api/pose/trainings",
        headers=auth_headers(client),
        json={
            "started_at": "2026-04-13T08:00:00Z",
            "ended_at": "2026-04-13T08:05:00Z",
            "exercise_type": "pushup",
            "sets": [{"reps": 11}],
            "report": {"summary": "delete me"},
        },
    )
    assert own.status_code == 201
    own_session_id = own.get_json()["session"]["id"]

    deleted = client.delete(f"/api/pose/trainings/{own_session_id}", headers=auth_headers(client))
    assert deleted.status_code == 200
    assert deleted.get_json()["ok"] is True

    missing = client.get(f"/api/pose/trainings/{own_session_id}")
    assert missing.status_code == 404


def test_pose_policy_contract_shape(client):
    response = client.get("/api/pose/policy")
    assert response.status_code == 200
    payload = response.get_json()
    assert isinstance(payload.get("version"), str) and payload["version"]

    offline = payload.get("offline") or {}
    assert isinstance(offline.get("max_video_bytes"), int)
    assert isinstance(offline.get("analysis_limit_seconds"), int)
    assert isinstance(offline.get("analysis_target_fps"), int)
    assert isinstance(offline.get("allowed_actions"), list)
    assert offline["allowed_actions"] == ["squat", "pushup", "lateral-raise", "bent-over-row"]

    rules = payload.get("rules") or {}
    privacy = rules.get("privacy") or {}
    analyzer_common = rules.get("analyzer_common") or {}
    squat = rules.get("squat") or {}
    pushup = rules.get("pushup") or {}
    lateral_raise = rules.get("lateral_raise") or {}
    bent_over_row = rules.get("bent_over_row") or {}
    analyzer = rules.get("analyzer") or {}

    assert privacy.get("local_inference_only") is True
    assert isinstance(analyzer_common.get("tracking_quality_min"), float)
    assert isinstance(analyzer_common.get("tempo_fast_threshold_seconds"), float)
    assert isinstance(squat.get("knee_forward_warn_ratio"), float)
    assert isinstance(squat.get("knee_forward_fail_ratio"), float)
    assert isinstance(squat.get("forward_lean_warn_deg"), int)
    assert isinstance(squat.get("forward_lean_fail_deg"), int)
    assert isinstance(pushup.get("body_line_warn_ratio"), float)
    assert isinstance(pushup.get("body_line_fail_ratio"), float)
    assert isinstance(pushup.get("depth_warn_ratio"), float)
    assert isinstance(pushup.get("depth_fail_ratio"), float)
    assert isinstance(lateral_raise.get("torso_sway_warn_ratio"), float)
    assert isinstance(lateral_raise.get("torso_sway_fail_ratio"), float)
    assert isinstance(lateral_raise.get("symmetry_warn_ratio"), float)
    assert isinstance(lateral_raise.get("symmetry_fail_ratio"), float)
    assert isinstance(bent_over_row.get("back_angle_warn_deg"), int)
    assert isinstance(bent_over_row.get("back_angle_fail_deg"), int)
    assert isinstance(bent_over_row.get("range_warn_ratio"), float)
    assert isinstance(bent_over_row.get("range_fail_ratio"), float)
    assert isinstance((analyzer.get("squat") or {}).get("knee_forward_fail_min_frames"), int)
    assert isinstance((analyzer.get("squat") or {}).get("forward_lean_fail_min_frames"), int)
    assert isinstance((analyzer.get("squat") or {}).get("tracking_quality_min"), float)
    assert isinstance((analyzer.get("pushup") or {}).get("depth_required_elbow_angle"), int)
    assert isinstance((analyzer.get("lateral_raise") or {}).get("torso_sway_warn_deg"), int)
    assert isinstance((analyzer.get("bent_over_row") or {}).get("torso_lean_warn_deg"), int)


def test_pose_policy_runtime_bounds(client):
    payload = client.get("/api/pose/policy").get_json()
    assert payload["offline"]["max_video_bytes"] >= 5 * 1024 * 1024
    assert payload["offline"]["analysis_limit_seconds"] >= 10
    assert payload["offline"]["analysis_target_fps"] >= 1



def test_pose_video_upload_and_server_analysis_routes_are_removed(client):
    token = register_and_token(client, email="pose-local-only@example.com", username="pose-local-only")
    _ = token

    upload_response = client.post(
        "/api/pose/videos",
        headers=auth_headers(client),
        data={},
        content_type="multipart/form-data",
    )
    assert upload_response.status_code == 404

    task_response = client.post(
        "/api/pose/analysis/tasks",
        headers=auth_headers(client),
        json={"video_asset_id": 1, "exercise_type": "squat", "view_angle": "side"},
    )
    assert task_response.status_code == 404

    server_response = client.post(
        "/api/pose/server-analysis/submit",
        headers=auth_headers(client),
        data={},
        content_type="multipart/form-data",
    )
    assert server_response.status_code == 404

    tuning_response = client.get("/api/pose/config/squat-tuning")
    assert tuning_response.status_code == 404
