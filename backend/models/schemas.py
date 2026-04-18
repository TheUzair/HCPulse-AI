from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID
from enum import Enum


# --- Enums ---

class InteractionTypeEnum(str, Enum):
    IN_PERSON = "in_person"
    PHONE = "phone"
    EMAIL = "email"
    VIDEO = "video"


class SentimentEnum(str, Enum):
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"


# --- User ---

class UserResponse(BaseModel):
    id: UUID
    email: str
    name: str
    image: Optional[str] = None
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


# --- HCP ---

class HCPCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=255)
    last_name: str = Field(..., min_length=1, max_length=255)
    specialty: Optional[str] = None
    organization: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    npi_number: Optional[str] = None


class HCPUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=255)
    last_name: Optional[str] = Field(None, min_length=1, max_length=255)
    specialty: Optional[str] = None
    organization: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    npi_number: Optional[str] = None


class HCPResponse(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    specialty: Optional[str] = None
    organization: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    npi_number: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- Interaction ---

class InteractionCreate(BaseModel):
    hcp_id: UUID
    interaction_type: InteractionTypeEnum
    date: date
    notes: Optional[str] = None
    summary: Optional[str] = None
    products_discussed: Optional[List[str]] = []
    key_topics: Optional[List[str]] = []
    sentiment: Optional[SentimentEnum] = None
    follow_up_actions: Optional[List[str]] = []
    follow_up_date: Optional[date] = None


class InteractionUpdate(BaseModel):
    hcp_id: Optional[UUID] = None
    interaction_type: Optional[InteractionTypeEnum] = None
    date: Optional[date] = None
    notes: Optional[str] = None
    summary: Optional[str] = None
    products_discussed: Optional[List[str]] = None
    key_topics: Optional[List[str]] = None
    sentiment: Optional[SentimentEnum] = None
    follow_up_actions: Optional[List[str]] = None
    follow_up_date: Optional[date] = None


class InteractionResponse(BaseModel):
    id: UUID
    user_id: UUID
    hcp_id: UUID
    interaction_type: str
    date: date
    notes: Optional[str] = None
    summary: Optional[str] = None
    products_discussed: Optional[List[str]] = []
    key_topics: Optional[List[str]] = []
    sentiment: Optional[str] = None
    follow_up_actions: Optional[List[str]] = []
    follow_up_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- Chat ---

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    user_id: UUID
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    message: str
    tool_used: Optional[str] = None
    data: Optional[dict] = None
    follow_up_suggestions: Optional[List[str]] = None
