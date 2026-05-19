from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .extensions import db


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class User(db.Model, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_admin: Mapped[bool] = mapped_column(db.Boolean, default=False, nullable=False)

    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    gender: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    height: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    weight: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    fitness_goal: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    blogs: Mapped[List["Blog"]] = relationship(back_populates="author", cascade="all, delete-orphan")
    comments: Mapped[List["Comment"]] = relationship(back_populates="author", cascade="all, delete-orphan")
    workout_records: Mapped[List["WorkoutRecord"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    enrollments: Mapped[List["UserCourse"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    course_comments: Mapped[List["CourseComment"]] = relationship(
        back_populates="author", cascade="all, delete-orphan"
    )
    feedback: Mapped[List["UserFeedback"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    training_sessions: Mapped[List["TrainingSession"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    food_meal_records: Mapped[List["FoodMealRecord"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class EmailVerification(db.Model, TimestampMixin):
    __tablename__ = "email_verifications"
    __table_args__ = (UniqueConstraint("email", name="uq_email_verification_email"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    code_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class PasswordResetCode(db.Model, TimestampMixin):
    __tablename__ = "password_reset_codes"
    __table_args__ = (UniqueConstraint("email", name="uq_password_reset_codes_email"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    code_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class WorkoutRecord(db.Model):
    __tablename__ = "workout_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    exercise_type: Mapped[str] = mapped_column(String(50), nullable=False)
    duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    calories_burned: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    form_score: Mapped[Optional[float]] = mapped_column(Numeric(3, 2), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    workout_date: Mapped[datetime.date] = mapped_column(Date, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    user: Mapped["User"] = relationship(back_populates="workout_records")


class FoodItem(db.Model):
    __tablename__ = "foods"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    calories: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    protein: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    fat: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    carbs: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    aliases: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default="")

    meal_items: Mapped[List["FoodMealItem"]] = relationship(back_populates="food")


class FoodMealRecord(db.Model, TimestampMixin):
    __tablename__ = "meal_records"
    __table_args__ = (UniqueConstraint("user_id", "meal_type", "recorded_on", name="uq_food_meal_record"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    meal_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    recorded_on: Mapped[datetime.date] = mapped_column(Date, nullable=False, index=True)

    user: Mapped["User"] = relationship(back_populates="food_meal_records")
    items: Mapped[List["FoodMealItem"]] = relationship(back_populates="meal", cascade="all, delete-orphan")


class FoodMealItem(db.Model):
    __tablename__ = "meal_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    meal_id: Mapped[int] = mapped_column(
        ForeignKey("meal_records.id", ondelete="CASCADE"), nullable=False, index=True
    )
    food_id: Mapped[int] = mapped_column(ForeignKey("foods.id", ondelete="CASCADE"), nullable=False, index=True)
    grams: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    meal: Mapped["FoodMealRecord"] = relationship(back_populates="items")
    food: Mapped["FoodItem"] = relationship(back_populates="meal_items")


class Tag(db.Model):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class Blog(db.Model, TimestampMixin):
    __tablename__ = "blogs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    cover_image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    view_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    like_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_published: Mapped[bool] = mapped_column(db.Boolean, default=False, nullable=False)

    author: Mapped["User"] = relationship(back_populates="blogs")
    tags: Mapped[list["BlogTag"]] = relationship(back_populates="blog", cascade="all, delete-orphan")
    comments: Mapped[list["Comment"]] = relationship(back_populates="blog", cascade="all, delete-orphan")
    likes: Mapped[list["BlogLike"]] = relationship(back_populates="blog", cascade="all, delete-orphan")


class BlogTag(db.Model):
    __tablename__ = "blog_tags"
    __table_args__ = (UniqueConstraint("blog_id", "tag_id", name="uq_blog_tag"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    blog_id: Mapped[int] = mapped_column(ForeignKey("blogs.id", ondelete="CASCADE"), nullable=False, index=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id", ondelete="CASCADE"), nullable=False, index=True)

    blog: Mapped["Blog"] = relationship(back_populates="tags")
    tag: Mapped["Tag"] = relationship()


class Comment(db.Model, TimestampMixin):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    blog_id: Mapped[int] = mapped_column(ForeignKey("blogs.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("comments.id"), nullable=True, index=True)

    content: Mapped[str] = mapped_column(Text, nullable=False)
    like_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    blog: Mapped["Blog"] = relationship(back_populates="comments")
    author: Mapped["User"] = relationship(back_populates="comments")
    parent: Mapped[Optional["Comment"]] = relationship(remote_side="Comment.id")
    likes: Mapped[list["CommentLike"]] = relationship(back_populates="comment", cascade="all, delete-orphan")


class BlogLike(db.Model):
    __tablename__ = "blog_likes"
    __table_args__ = (UniqueConstraint("blog_id", "user_id", name="uq_blog_like"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    blog_id: Mapped[int] = mapped_column(ForeignKey("blogs.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    blog: Mapped["Blog"] = relationship(back_populates="likes")


class CommentLike(db.Model):
    __tablename__ = "comment_likes"
    __table_args__ = (UniqueConstraint("comment_id", "user_id", name="uq_comment_like"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    comment_id: Mapped[int] = mapped_column(ForeignKey("comments.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    comment: Mapped["Comment"] = relationship(back_populates="likes")


class Course(db.Model, TimestampMixin):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    cover_image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    intro_video_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    instructor_name: Mapped[str] = mapped_column(String(100), nullable=False)
    instructor_bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    instructor_avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_free: Mapped[bool] = mapped_column(db.Boolean, default=False, nullable=False)
    price: Mapped[Optional[float]] = mapped_column(Numeric(8, 2), nullable=True)
    view_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    enrollments: Mapped[list["UserCourse"]] = relationship(back_populates="course", cascade="all, delete-orphan")
    comments: Mapped[list["CourseComment"]] = relationship(back_populates="course", cascade="all, delete-orphan")


class UserCourse(db.Model):
    __tablename__ = "user_courses"
    __table_args__ = (UniqueConstraint("user_id", "course_id", name="uq_user_course"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)

    enrolled_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    payment_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship(back_populates="enrollments")
    course: Mapped["Course"] = relationship(back_populates="enrollments")


class CourseComment(db.Model, TimestampMixin):
    __tablename__ = "course_comments"
    __table_args__ = (CheckConstraint("rating >= 1 AND rating <= 5", name="ck_course_rating"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    like_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    course: Mapped["Course"] = relationship(back_populates="comments")
    author: Mapped["User"] = relationship(back_populates="course_comments")
    likes: Mapped[list["CourseCommentLike"]] = relationship(back_populates="comment", cascade="all, delete-orphan")


class CourseCommentLike(db.Model):
    __tablename__ = "course_comment_likes"
    __table_args__ = (UniqueConstraint("course_comment_id", "user_id", name="uq_course_comment_like"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    course_comment_id: Mapped[int] = mapped_column(
        ForeignKey("course_comments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    comment: Mapped["CourseComment"] = relationship(back_populates="likes")


class UserFeedback(db.Model):
    __tablename__ = "user_feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    contact_email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    user: Mapped[Optional["User"]] = relationship(back_populates="feedback")


class TrainingSession(db.Model, TimestampMixin):
    __tablename__ = "training_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    report_json: Mapped[Optional[dict]] = mapped_column(db.JSON, nullable=True)

    user: Mapped["User"] = relationship(back_populates="training_sessions")
    sets: Mapped[List["TrainingSet"]] = relationship(back_populates="training_session", cascade="all, delete-orphan")


class TrainingSet(db.Model):
    __tablename__ = "training_sets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    training_id: Mapped[int] = mapped_column(
        ForeignKey("training_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    exercise_type: Mapped[str] = mapped_column(String(50), nullable=False, default="squat")
    set_order: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    reps: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    weight: Mapped[Optional[float]] = mapped_column(Numeric(8, 2), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    training_session: Mapped["TrainingSession"] = relationship(back_populates="sets")

