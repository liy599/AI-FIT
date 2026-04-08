def register_and_token(client, email="food@example.com", username="food-user", password="pass1234"):
    response = client.post(
        "/api/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    assert response.status_code == 200
    return response.get_json()["access_token"]


def auth_header(token: str):
    return {"Authorization": f"Bearer {token}"}


def test_foods_list_and_bulk(client):
    response = client.get("/api/foods")
    assert response.status_code == 200
    foods = response.get_json()
    assert len(foods) >= 1
    assert foods[0]["displayName"]
    assert foods[0]["displayName"] == "Steamed Rice"
    assert foods[0]["category"] == "Staples"

    response = client.post("/api/foods/bulk", json={"ids": [foods[0]["id"]]})
    assert response.status_code == 200
    bulk = response.get_json()
    assert len(bulk) == 1
    assert bulk[0]["id"] == foods[0]["id"]


def test_meals_save_fetch_today_and_delete(client):
    token = register_and_token(client)
    foods = client.get("/api/foods").get_json()
    assert len(foods) >= 2

    response = client.post(
        "/api/meals",
        headers=auth_header(token),
        json={
            "mealType": "lunch",
            "recordedOn": "2026-04-05",
            "items": [
                {"foodId": foods[0]["id"], "grams": 150},
                {"foodId": foods[1]["id"], "grams": 120},
            ],
        },
    )
    assert response.status_code == 201
    meal = response.get_json()
    assert meal["mealType"] == "lunch"
    assert len(meal["items"]) == 2

    response = client.get("/api/meals/today?date=2026-04-05", headers=auth_header(token))
    assert response.status_code == 200
    summary = response.get_json()
    assert summary["date"] == "2026-04-05"
    assert len(summary["meals"]) == 1
    assert summary["totals"]["kcal"] > 0

    response = client.get(f"/api/meals/{meal['id']}", headers=auth_header(token))
    assert response.status_code == 200
    fetched = response.get_json()
    assert fetched["id"] == meal["id"]
    assert fetched["items"][0]["food"] is not None

    response = client.get("/api/meals/history?page=1&page_size=10", headers=auth_header(token))
    assert response.status_code == 200
    history = response.get_json()
    assert history["total"] == 1
    assert history["items"][0]["id"] == meal["id"]

    response = client.delete(f"/api/meals/{meal['id']}", headers=auth_header(token))
    assert response.status_code == 200

    response = client.get("/api/meals/today?date=2026-04-05", headers=auth_header(token))
    assert response.status_code == 200
    assert response.get_json()["meals"] == []


def test_meals_reject_empty_items(client):
    token = register_and_token(client, email="empty-food@example.com", username="empty-food-user")

    response = client.post(
        "/api/meals",
        headers=auth_header(token),
        json={
            "mealType": "lunch",
            "recordedOn": "2026-04-05",
            "items": [],
        },
    )

    assert response.status_code == 400
    assert response.get_json()["error"] == "items must not be empty"


def test_meals_reject_invalid_food_ids(client):
    token = register_and_token(client, email="invalid-food@example.com", username="invalid-food-user")

    response = client.post(
        "/api/meals",
        headers=auth_header(token),
        json={
            "mealType": "dinner",
            "recordedOn": "2026-04-05",
            "items": [{"foodId": 999999, "grams": 100}],
        },
    )

    assert response.status_code == 400
    assert response.get_json()["error"] == "invalid foodIds: 999999"


def test_meals_reject_invalid_dates(client):
    token = register_and_token(client, email="date-food@example.com", username="date-food-user")
    foods = client.get("/api/foods").get_json()

    response = client.post(
        "/api/meals",
        headers=auth_header(token),
        json={
            "mealType": "breakfast",
            "recordedOn": "2026-13-99",
            "items": [{"foodId": foods[0]["id"], "grams": 100}],
        },
    )
    assert response.status_code == 400
    assert response.get_json()["error"] == "invalid recordedOn, expected YYYY-MM-DD"

    response = client.get("/api/meals/today?date=2026-13-99", headers=auth_header(token))
    assert response.status_code == 400
    assert response.get_json()["error"] == "invalid date, expected YYYY-MM-DD"
