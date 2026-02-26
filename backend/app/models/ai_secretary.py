import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, Text, Boolean, Integer, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AiSecretary(Base):
    __tablename__ = "ai_secretaries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True)

    business_name: Mapped[str] = mapped_column(String(255), nullable=False)
    industry: Mapped[str] = mapped_column(String(100), nullable=False)
    phone_number: Mapped[str | None] = mapped_column(String(50))
    cvr_number: Mapped[str | None] = mapped_column(String(20))
    contact_persons: Mapped[list] = mapped_column(JSONB, default=list)
    business_address: Mapped[str | None] = mapped_column(String(500))
    business_email: Mapped[str | None] = mapped_column(String(255))
    voice_id: Mapped[str | None] = mapped_column(String(100))
    greeting_text: Mapped[str | None] = mapped_column(Text)
    system_prompt: Mapped[str | None] = mapped_column(Text)
    required_fields: Mapped[list] = mapped_column(JSONB, default=list)
    knowledge_items: Mapped[list] = mapped_column(JSONB, default=list)
    ivr_options: Mapped[list] = mapped_column(JSONB, default=list)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    confirmation_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    confirmation_template: Mapped[str | None] = mapped_column(Text)
    response_deadline_hours: Mapped[int] = mapped_column(Integer, default=24)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="ai_secretary")
    calls = relationship("SecretaryCall", back_populates="secretary", cascade="all, delete-orphan")
