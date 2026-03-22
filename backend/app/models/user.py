import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    company_name: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))
    country: Mapped[str | None] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(50), default="user")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Email-verificering
    email_verified: Mapped[bool] = mapped_column(default=False)
    email_verify_token: Mapped[str | None] = mapped_column(String(255), index=True)
    email_verify_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Konto-gendannelse
    password_reset_token: Mapped[str | None] = mapped_column(String(255), index=True)
    password_reset_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # 2-trins sikkerhed (TOTP — Google Authenticator kompatibel)
    two_fa_enabled: Mapped[bool] = mapped_column(default=False)
    two_fa_secret: Mapped[str | None] = mapped_column(String(255))

    # Stripe abonnement
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), unique=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(255), unique=True)
    plan: Mapped[str] = mapped_column(String(50), default="free")             # free | starter | pro | business
    subscription_status: Mapped[str] = mapped_column(String(50), default="free")  # free | trialing | active | past_due | canceled
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    subscription_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    mail_accounts = relationship("MailAccount", back_populates="user", cascade="all, delete-orphan")
    templates = relationship("Template", back_populates="user", cascade="all, delete-orphan")
    knowledge_entries = relationship("KnowledgeBase", back_populates="user", cascade="all, delete-orphan")
    calendar_events = relationship("CalendarEvent", back_populates="user", cascade="all, delete-orphan")
    meeting_notes = relationship("MeetingNote", back_populates="user", cascade="all, delete-orphan")
