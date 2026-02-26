import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, Text, Float, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(255))

    address_street: Mapped[str | None] = mapped_column(String(255))
    address_zip: Mapped[str | None] = mapped_column(String(20))
    address_city: Mapped[str | None] = mapped_column(String(100))

    source: Mapped[str | None] = mapped_column(String(50))  # "email", "call", "manual", "ordrestyring"
    status: Mapped[str] = mapped_column(String(50), default="aktiv")
    tags: Mapped[list] = mapped_column(JSONB, default=list)
    estimated_value: Mapped[float | None] = mapped_column(Float)
    notes: Mapped[str | None] = mapped_column(Text)
    external_id: Mapped[str | None] = mapped_column(String(255))  # Ordrestyring ID

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="customers")
    emails = relationship("EmailMessage", back_populates="customer")
    calls = relationship("SecretaryCall", back_populates="customer")
    action_items = relationship("ActionItem", back_populates="customer", cascade="all, delete-orphan")
