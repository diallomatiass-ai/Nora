import uuid
from datetime import datetime

from sqlalchemy import String, Text, Boolean, Integer, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AiSecretary(Base):
    __tablename__ = "ai_secretaries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    business_name: Mapped[str] = mapped_column(String(255), nullable=False)
    industry: Mapped[str] = mapped_column(String(100), nullable=False)
    phone_number: Mapped[str | None] = mapped_column(String(50))
    cvr_number: Mapped[str | None] = mapped_column(String(20))
    contact_persons: Mapped[dict] = mapped_column(JSON, default=list)
    business_address: Mapped[str | None] = mapped_column(String(500))
    business_email: Mapped[str | None] = mapped_column(String(255))
    voice_id: Mapped[str] = mapped_column(String(50), default="professional_male")
    greeting_text: Mapped[str] = mapped_column(Text, nullable=False)
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    required_fields: Mapped[dict] = mapped_column(JSON, default=list)
    knowledge_items: Mapped[dict] = mapped_column(JSON, default=dict)
    ivr_options: Mapped[dict] = mapped_column(JSON, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    # Confirmation settings
    confirmation_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    confirmation_template: Mapped[str | None] = mapped_column(Text)
    response_deadline_hours: Mapped[int] = mapped_column(Integer, default=24)
    # Booking / kalender-regler
    booking_rules: Mapped[dict | None] = mapped_column(JSON, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", backref="ai_secretaries")
    calls = relationship("SecretaryCall", back_populates="secretary", cascade="all, delete-orphan")
