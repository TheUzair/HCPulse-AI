import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, DateTime, ForeignKey, Enum as SAEnum, JSON, Date
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from database import Base
import enum


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    REP = "rep"
    MANAGER = "manager"


class InteractionType(str, enum.Enum):
    IN_PERSON = "in_person"
    PHONE = "phone"
    EMAIL = "email"
    VIDEO = "video"


class Sentiment(str, enum.Enum):
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    image = Column(String(500), nullable=True)
    role = Column(SAEnum(UserRole), default=UserRole.REP, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    interactions = relationship("Interaction", back_populates="user")
    activity_logs = relationship("ActivityLog", back_populates="user")


class HCP(Base):
    __tablename__ = "hcps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name = Column(String(255), nullable=False)
    last_name = Column(String(255), nullable=False)
    specialty = Column(String(255), nullable=True)
    organization = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    npi_number = Column(String(20), nullable=True, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    interactions = relationship("Interaction", back_populates="hcp")


class Interaction(Base):
    __tablename__ = "interactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    hcp_id = Column(UUID(as_uuid=True), ForeignKey("hcps.id"), nullable=False)
    interaction_type = Column(SAEnum(InteractionType), nullable=False)
    date = Column(Date, nullable=False)
    notes = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    products_discussed = Column(JSON, default=list)
    key_topics = Column(JSON, default=list)
    sentiment = Column(SAEnum(Sentiment), nullable=True)
    follow_up_actions = Column(JSON, default=list)
    follow_up_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="interactions")
    hcp = relationship("HCP", back_populates="interactions")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="activity_logs")
