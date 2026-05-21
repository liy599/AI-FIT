from dotenv import load_dotenv


def main():
    load_dotenv()
    from app import create_app
    from app.extensions import db
    from app.models import Tag

    app = create_app()
    with app.app_context():
        if Tag.query.count() == 0:
            db.session.add_all(
                [
                    Tag(name="Diet"),
                    Tag(name="Training"),
                    Tag(name="Other"),
                ]
            )

        db.session.commit()
        print("seeded")


if __name__ == "__main__":
    main()
