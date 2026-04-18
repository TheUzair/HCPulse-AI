from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from services.ai_service import AIService
from models.schemas import ChatRequest, ChatResponse

router = APIRouter(prefix="/ai", tags=["AI"])


class ChatHistoryMessage(BaseModel):
    role: str
    content: str


class ChatRequestBody(BaseModel):
    message: str
    user_id: str
    history: Optional[List[ChatHistoryMessage]] = None


@router.post("/chat", response_model=ChatResponse)
async def ai_chat(body: ChatRequestBody):
    service = AIService()
    history = [msg.model_dump() for msg in body.history] if body.history else None

    try:
        result = await service.chat(
            message=body.message,
            user_id=body.user_id,
            history=history,
        )
        return ChatResponse(
            message=result.get("message", ""),
            tool_used=result.get("tool_used"),
            data=result.get("data"),
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI processing error: {str(e)}",
        )
