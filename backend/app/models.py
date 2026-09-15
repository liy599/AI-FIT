from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .extensions import db
from .utils.privacy import decrypt_text, encrypt_text, privacy_hash


def _enc(value) -> str | None:
    if value is None or value == "":
        return None
    return encrypt_text(str(value))


def _dec(value: str | None) -> str | None:
    return decrypt_text(value)


def _dec_float(value: str | None) -> float | None:
    raw = _dec(value)
    if raw is None or raw == "":
        return None
    return float(raw)


def _dec_int(value: str | None, default: int = 0) -> int:
    raw = _dec(value)
    if raw is None or raw == "":
        return default
    return int(raw)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class User(db.Model, TimestampMixin):
    __tablename__ = "users"
    __table_args__ = (
        Index("ix_users_admin_disabled_id", "is_admin", "is_disabled", "id"),
        Index("ix_users_created_id", "created_at", "id"),
        Index("ix_users_username_trgm", "username", postgresql_using="gin", postgresql_ops={"username": "gin_trgm_ops"}),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    email_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_admin: Mapped[bool] = mapped_column(db.Boolean, default=False, nullable=False)
    is_disabled: Mapped[bool] = mapped_column(db.Boolean, default=False, nullable=False)

    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    gender_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    height_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    weight_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fitness_goal_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    blogs: Mapped[List["Blog"]] = relationship(back_populates="author", cascade="all, delete-orphan")
    comments: Mapped[List["Comment"]] = relationship(back_populates="author", cascade="all, delete-orphan")
    notifications: Mapped[List["Notification"]] = relationship(
        foreign_keys="Notification.recipient_user_id", back_populates="recipient", cascade="all, delete-orphan"
    )
    workout_records: Mapped[List["WorkoutRecord"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    training_sessions: Mapped[List["TrainingSession"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    enrollments: Mapped[List["UserCourse"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    course_comments: Mapped[List["CourseComment"]] = relationship(
        back_populates="author", cascade="all, delete-orphan"
    )
    food_meal_records: Mapped[List["FoodMealRecord"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    memberships: Mapped[List["UserMembership"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    orders: Mapped[List["MembershipOrder"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    @property
    def email(self) -> str:
        return _dec(self.email_encrypted) or ""

    @email.setter
    def email(self, value: str) -> None:
        text = (value or "").strip().lower()
        self.email_hash = privacy_hash(text)
        self.email_encrypted = encrypt_text(text) or ""

    @property
    def gender(self) -> str | None:
        return _dec(self.gender_encrypted)

    @gender.setter
    def gender(self, value: str | None) -> None:
        self.gender_encrypted = _enc(value)

    @property
    def height(self) -> float | None:
        return _dec_float(self.height_encrypted)

    @height.setter
    def height(self, value) -> None:
        self.height_encrypted = _enc(value)

    @property
    def weight(self) -> float | None:
        return _dec_float(self.weight_encrypted)

    @weight.setter
    def weight(self, value) -> None:
        self.weight_encrypted = _enc(value)

    @property
    def fitness_goal(self) -> str | None:
        return _dec(self.fitness_goal_encrypted)

    @fitness_goal.setter
    def fitness_goal(self, value: str | None) -> None:
        self.fitness_goal_encrypted = _enc(value)


class EmailVerification(db.Model, TimestampMixin):
    __tablename__ = "email_verifications"
    __table_args__ = (UniqueConstraint("email_hash", name="uq_email_verification_email_hash"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    email_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    code_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    @property
    def email(self) -> str:
        return _dec(self.email_encrypted) or ""

    @email.setter
    def email(self, value: str) -> None:
        text = (value or "").strip().lower()
        self.email_hash = privacy_hash(text)
        self.email_encrypted = encrypt_text(text) or ""


class PasswordResetCode(db.Model, TimestampMixin):
    __tablename__ = "password_reset_codes"
    __table_args__ = (UniqueConstraint("email_hash", name="uq_password_reset_codes_email_hash"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    email_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    email_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    code_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    @property
    def email(self) -> str:
        return _dec(self.email_encrypted) or ""

    @email.setter
    def email(self, value: str) -> None:
        text = (value or "").strip().lower()
        self.email_hash = privacy_hash(text)
        self.email_encrypted = encrypt_text(text) or ""


class WorkoutRecord(db.Model):
    __tablename__ = "workout_records"
    __table_args__ = (
        CheckConstraint("duration IS NULL OR duration >= 0", name="ck_workout_records_duration_nonnegative"),
        CheckConstraint(
            "calories_burned IS NULL OR calories_burned >= 0",
            name="ck_workout_records_calories_nonnegative",
        ),
        CheckConstraint(
            "form_score IS NULL OR (form_score >= 0 AND form_score <= 1)",
            name="ck_workout_records_form_score_range",
        ),
        Index("ix_workout_records_user_date_id", "user_id", "workout_date", "id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    exercise_type_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    exercise_type_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    calories_burned: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    form_score: Mapped[Optional[float]] = mapped_column(Numeric(3, 2), nullable=True)
    notes_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    workout_date: Mapped[datetime.date] = mapped_column(Date, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    user: Mapped["User"] = relationship(back_populates="workout_records")

    @property
    def exercise_type(self) -> str:
        return _dec(self.exercise_type_encrypted) or ""

    @exercise_type.setter
    def exercise_type(self, value: str) -> None:
        text = (value or "").strip()
        self.exercise_type_hash = privacy_hash(text)
        self.exercise_type_encrypted = encrypt_text(text) or ""

    @property
    def notes(self) -> str | None:
        return _dec(self.notes_encrypted)

    @notes.setter
    def notes(self, value: str | None) -> None:
        self.notes_encrypted = _enc(value)


class Tag(db.Model):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class Blog(db.Model, TimestampMixin):
    __tablename__ = "blogs"
    __table_args__ = (
        CheckConstraint("visibility IN ('public', 'private')", name="ck_blogs_visibility_allowed"),
        CheckConstraint(
            "moderation_status IN ('active', 'unpublished')",
            name="ck_blogs_moderation_status_allowed",
        ),
        CheckConstraint("view_count >= 0", name="ck_blogs_view_count_nonnegative"),
        CheckConstraint("like_count >= 0", name="ck_blogs_like_count_nonnegative"),
        Index("ix_blogs_public_created", "is_published", "moderation_status", "visibility", "created_at", "id"),
        Index("ix_blogs_public_views", "is_published", "moderation_status", "visibility", "view_count", "id"),
        Index("ix_blogs_public_likes", "is_published", "moderation_status", "visibility", "like_count", "id"),
        Index("ix_blogs_title_trgm", "title", postgresql_using="gin", postgresql_ops={"title": "gin_trgm_ops"}),
        Index(
            "ix_blogs_admin_status_id",
            "visibility",
            "moderation_status",
            "is_published",
            "moderation_restore_requested",
            "id",
        ),
        Index("ix_blogs_admin_updated_id", "visibility", "updated_at", "id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    cover_image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image_urls: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    visibility: Mapped[str] = mapped_column(String(20), default="public", nullable=False)
    view_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    like_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_published: Mapped[bool] = mapped_column(db.Boolean, default=False, nullable=False)
    moderation_status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    moderation_restore_requested: Mapped[bool] = mapped_column(db.Boolean, default=False, nullable=False)

    author: Mapped["User"] = relationship(back_populates="blogs")
    tags: Mapped[list["BlogTag"]] = relationship(back_populates="blog", cascade="all, delete-orphan")
    comments: Mapped[list["Comment"]] = relationship(back_populates="blog", cascade="all, delete-orphan")
    likes: Mapped[list["BlogLike"]] = relationship(back_populates="blog", cascade="all, delete-orphan")


class BlogView(db.Model):
    __tablename__ = "blog_views"
    __table_args__ = (UniqueConstraint("blog_id", "viewer_key", name="uq_blog_viewer"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    blog_id: Mapped[int] = mapped_column(ForeignKey("blogs.id", ondelete="CASCADE"), nullable=False, index=True)
    viewer_key: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


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
    __table_args__ = (
        CheckConstraint("like_count >= 0", name="ck_comments_like_count_nonnegative"),
        Index("ix_comments_blog_parent_created_id", "blog_id", "parent_id", "created_at", "id"),
        Index("ix_comments_user_blog_created_id", "user_id", "blog_id", "created_at", "id"),
        Index("ix_comments_content_trgm", "content", postgresql_using="gin", postgresql_ops={"content": "gin_trgm_ops"}),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    blog_id: Mapped[int] = mapped_column(ForeignKey("blogs.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("comments.id", ondelete="SET NULL"), nullable=True, index=True
    )

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

    enrollments: Mapped[List["UserCourse"]] = relationship(back_populates="course", cascade="all, delete-orphan")
    comments: Mapped[List["CourseComment"]] = relationship(back_populates="course", cascade="all, delete-orphan")


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
    likes: Mapped[List["CourseCommentLike"]] = relationship(back_populates="comment", cascade="all, delete-orphan")


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


class Notification(db.Model, TimestampMixin):
    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_recipient_created_id", "recipient_user_id", "created_at", "id"),
        Index("ix_notifications_recipient_read_created_id", "recipient_user_id", "is_read", "created_at", "id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    recipient_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    blog_id: Mapped[int] = mapped_column(ForeignKey("blogs.id", ondelete="CASCADE"), nullable=False, index=True)
    comment_id: Mapped[int] = mapped_column(ForeignKey("comments.id", ondelete="CASCADE"), nullable=False, index=True)
    root_comment_id: Mapped[int] = mapped_column(ForeignKey("comments.id", ondelete="CASCADE"), nullable=False, index=True)
    is_read: Mapped[bool] = mapped_column(db.Boolean, default=False, nullable=False, index=True)

    recipient: Mapped["User"] = relationship(
        foreign_keys=[recipient_user_id], back_populates="notifications"
    )
    actor: Mapped["User"] = relationship(foreign_keys=[actor_user_id])
    blog: Mapped["Blog"] = relationship()
    comment: Mapped["Comment"] = relationship(foreign_keys=[comment_id])
    root_comment: Mapped["Comment"] = relationship(foreign_keys=[root_comment_id])


class AuditLog(db.Model):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_actor_created_id", "actor_user_id", "created_at", "id"),
        Index("ix_audit_logs_action_created_id", "action", "created_at", "id"),
        Index("ix_audit_logs_target_created_id", "target_type", "target_id", "created_at", "id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    target_type: Mapped[str] = mapped_column(String(80), nullable=False)
    target_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    ip_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    metadata_json: Mapped[Optional[dict]] = mapped_column(db.JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class TrainingSession(db.Model, TimestampMixin):
    __tablename__ = "training_sessions"
    __table_args__ = (
        CheckConstraint("ended_at IS NULL OR ended_at >= started_at", name="ck_training_sessions_time_order"),
        Index("ix_training_sessions_user_started_id", "user_id", "started_at", "id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    note_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    report_summary_json: Mapped[Optional[dict]] = mapped_column(db.JSON, nullable=True)
    report_json: Mapped[Optional[dict]] = mapped_column(db.JSON, nullable=True)

    user: Mapped["User"] = relationship(back_populates="training_sessions")
    sets: Mapped[List["TrainingSet"]] = relationship(back_populates="training_session", cascade="all, delete-orphan")

    @property
    def note(self) -> str | None:
        return _dec(self.note_encrypted)

    @note.setter
    def note(self, value: str | None) -> None:
        self.note_encrypted = _enc(value)


class TrainingSet(db.Model):
    __tablename__ = "training_sets"
    __table_args__ = (
        CheckConstraint("set_order >= 1", name="ck_training_sets_set_order_positive"),
        Index("ix_training_sets_training_order_id", "training_id", "set_order", "id"),
        Index("ix_training_sets_exercise_training", "exercise_type_hash", "training_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    training_id: Mapped[int] = mapped_column(
        ForeignKey("training_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    exercise_type_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    exercise_type_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    set_order: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    reps_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    weight_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    note_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    training_session: Mapped["TrainingSession"] = relationship(back_populates="sets")

    @property
    def exercise_type(self) -> str:
        return _dec(self.exercise_type_encrypted) or ""

    @exercise_type.setter
    def exercise_type(self, value: str) -> None:
        text = (value or "").strip()
        self.exercise_type_hash = privacy_hash(text)
        self.exercise_type_encrypted = encrypt_text(text) or ""

    @property
    def reps(self) -> int:
        return _dec_int(self.reps_encrypted, 0)

    @reps.setter
    def reps(self, value) -> None:
        self.reps_encrypted = _enc(0 if value is None else int(value)) or ""

    @property
    def weight(self) -> float | None:
        return _dec_float(self.weight_encrypted)

    @weight.setter
    def weight(self, value) -> None:
        self.weight_encrypted = _enc(value)

    @property
    def note(self) -> str | None:
        return _dec(self.note_encrypted)

    @note.setter
    def note(self, value: str | None) -> None:
        self.note_encrypted = _enc(value)


# ── Membership / subscription ─────────────────────────────────────────────────

class MembershipPlan(db.Model):
    """Static catalogue of subscription tiers (seeded at startup)."""
    __tablename__ = "membership_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    price_monthly: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False, default=0)
    price_yearly: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False, default=0)
    features: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array of feature strings
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    user_memberships: Mapped[List["UserMembership"]] = relationship(back_populates="plan")


class UserMembership(db.Model, TimestampMixin):
    """Active or historical subscription for a user."""
    __tablename__ = "user_memberships"
    __table_args__ = (
        CheckConstraint("billing_cycle IN ('monthly','yearly')", name="ck_membership_billing_cycle"),
        CheckConstraint("status IN ('active','cancelled','expired','pending')", name="ck_membership_status"),
        Index("ix_user_memberships_user_status", "user_id", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    plan_id: Mapped[int] = mapped_column(ForeignKey("membership_plans.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    billing_cycle: Mapped[str] = mapped_column(String(10), nullable=False, default="monthly")
    starts_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship(back_populates="memberships")
    plan: Mapped["MembershipPlan"] = relationship(back_populates="user_memberships")
    orders: Mapped[List["MembershipOrder"]] = relationship(back_populates="membership", cascade="all, delete-orphan")


class MembershipOrder(db.Model, TimestampMixin):
    """Payment order linked to a membership subscription."""
    __tablename__ = "membership_orders"
    __table_args__ = (
        CheckConstraint("status IN ('pending','paid','failed','refunded')", name="ck_order_status"),
        Index("ix_membership_orders_user_created", "user_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    membership_id: Mapped[Optional[int]] = mapped_column(ForeignKey("user_memberships.id", ondelete="SET NULL"), nullable=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("membership_plans.id"), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="EUR")
    billing_cycle: Mapped[str] = mapped_column(String(10), nullable=False, default="monthly")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    payment_provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    payment_ref: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship(back_populates="orders")
    membership: Mapped[Optional["UserMembership"]] = relationship(back_populates="orders")
    plan: Mapped["MembershipPlan"] = relationship()
