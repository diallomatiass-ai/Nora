import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, Text, ForeignKey, Integer, Float, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class EmailMessage(Base):
    __tablename__ = "email_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("mail_accounts.id"), nullable=False)
    provider_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    thread_id: Mapped[str | None] = mapped_column(String(255))
    from_address: Mapped[str] = mapped_column(String(255), nullable=False)
    from_name: Mapped[str | None] = mapped_column(String(255))
    to_address: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str | None] = mapped_column(Text)
    body_text: Mapped[str | None] = mapped_column(Text)
    body_html: Mapped[str | None] = mapped_column(Text)
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_read: Mapped[bool] = mapped_column(default=False)
    is_replied: Mapped[bool] = mapped_column(default=False)

    # AI classification
    category: Mapped[str | None] = mapped_column(String(50))  # inquiry, complaint, order, support, spam, other
    urgency: Mapped[str | None] = mapped_column(String(20))   # high, medium, low
    topic: Mapped[str | None] = mapped_column(String(100))
    confidence: Mapped[float | None] = mapped_column(Float)

    processed: Mapped[bool] = mapped_column(default=False)
    is_outgoing: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Customer link
    customer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id"))

    account = relationship("MailAccount", back_populates="emails")
    suggestions = relationship("AiSuggestion", back_populates="email", cascade="all, delete-orphan")
    customer = relationship("Customer", back_populates="emails")
