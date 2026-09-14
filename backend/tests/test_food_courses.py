from datetime import datetime

from app.extensions import db
from app.models import Course


def register(client, email="module@example.com", username="module-user"):
    response = client.post("/api/auth/register", json={
        "email": email, "username": username, "password": "ModulePass1",
    })
    assert response.status_code == 200
    return response


def auth(client):
    csrf = client.get_cookie("csrf_access_token")
    return {"X-CSRF-TOKEN": csrf.value} if csrf else {}


def test_food_catalog_and_meal_flow(client):
    user = register(client)
    foods = client.get("/api/foods")
    assert foods.status_code == 200
    assert foods.get_json()
    token_cookie = auth(client)
    food_id = foods.get_json()[0]["id"]
    saved = client.post("/api/meals", headers=token_cookie, json={
        "mealType": "lunch", "recordedOn": "2026-09-14",
        "items": [{"foodId": food_id, "grams": 100}],
    })
    assert saved.status_code == 201
    summary = client.get("/api/meals/today?date=2026-09-14", headers=token_cookie)
    assert summary.status_code == 200
    assert summary.get_json()["totals"]["kcal"] > 0


def test_course_requires_auth_and_supports_enrollment(client, app):
    assert client.get("/api/courses").status_code in (401, 422)
    with app.app_context():
        course = Course(
            title="Strength Basics", description="A structured course",
            instructor_name="AI-FIT Coach", is_free=True,
            created_at=datetime.utcnow(), updated_at=datetime.utcnow(),
        )
        db.session.add(course)
        db.session.commit()
        course_id = course.id
    user = register(client, "course@example.com", "course-user")
    headers = auth(client)
    listed = client.get("/api/courses", headers=headers)
    assert listed.status_code == 200
    enrolled = client.post(f"/api/courses/{course_id}/enroll", headers=headers)
    assert enrolled.status_code == 200
