from dotenv import load_dotenv


def main():
    load_dotenv()
    from app import create_app
    from app.extensions import db
    from app.models import Course, Tag
    from app.services.food.catalog_runtime import ensure_food_seed_data

    app = create_app()
    with app.app_context():
        ensure_food_seed_data()

        if Tag.query.count() == 0:
            db.session.add_all(
                [
                    Tag(name="Fitness Tips"),
                    Tag(name="Nutrition"),
                    Tag(name="Training Plan"),
                    Tag(name="Rehab"),
                ]
            )

        if Course.query.count() == 0:
            db.session.add_all(
                [
                    Course(
                        title="Strength Training Basics",
                        description="A beginner-friendly strength training path, from form fundamentals to programming.",
                        instructor_name="Coach Nova",
                        instructor_bio="Focuses on strength training and movement form, explaining complex lifts in simple language.",
                        is_free=True,
                    ),
                    Course(
                        title="Fat Loss Cardio & Intervals",
                        description="A sustainable cardio plan combining HIIT and low-intensity sessions.",
                        instructor_name="Coach Luna",
                        instructor_bio="Specializes in fat-loss cycle planning and cardio intensity management.",
                        is_free=False,
                        price=9.99,
                    ),
                    Course(
                        title="Desk Worker Neck & Shoulder Rehab",
                        description="Progressive daily mobility and strengthening for neck and shoulder discomfort.",
                        instructor_name="Physio Kai",
                        instructor_bio="Rehab-focused, with an emphasis on pain management and functional recovery.",
                        is_free=True,
                    ),
                ]
            )

        db.session.commit()
        print("seeded")


if __name__ == "__main__":
    main()
