from dotenv import load_dotenv


def main():
    load_dotenv()
    from app import create_app
    from app.extensions import db
    from app.models import Course, Tag

    app = create_app()
    with app.app_context():
        if Tag.query.count() == 0:
            db.session.add_all(
                [
                    Tag(name="健身技巧"),
                    Tag(name="营养知识"),
                    Tag(name="训练计划"),
                    Tag(name="康复训练"),
                ]
            )

        if Course.query.count() == 0:
            db.session.add_all(
                [
                    Course(
                        title="基础力量训练入门",
                        description="适合零基础同学的力量训练路线，从动作规范到训练安排。",
                        instructor_name="Coach Nova",
                        instructor_bio="专注力量训练与动作规范，擅长用简单语言解释复杂动作。",
                        is_free=True,
                    ),
                    Course(
                        title="减脂有氧与间歇训练",
                        description="以可持续的训练频率与强度为目标，结合HIIT与低强度有氧。",
                        instructor_name="Coach Luna",
                        instructor_bio="擅长减脂周期规划与心肺训练强度控制。",
                        is_free=False,
                        price=9.99,
                    ),
                    Course(
                        title="办公室人群肩颈康复",
                        description="针对肩颈不适的日常训练与拉伸组合，循序渐进。",
                        instructor_name="Physio Kai",
                        instructor_bio="康复方向，关注疼痛管理与功能恢复。",
                        is_free=True,
                    ),
                ]
            )

        db.session.commit()
        print("seeded")


if __name__ == "__main__":
    main()

