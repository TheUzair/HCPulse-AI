from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from services.interaction_service import InteractionService
from models.schemas import InteractionCreate, InteractionUpdate, InteractionResponse

router = APIRouter(prefix="/interaction", tags=["Interaction"])


def _get_user_id(x_user_id: str = Header(...)) -> UUID:
    try:
        return UUID(x_user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")


@router.post("/", response_model=InteractionResponse, status_code=201)
async def create_interaction(
    data: InteractionCreate,
    user_id: UUID = Depends(_get_user_id),
    db: AsyncSession = Depends(get_db),
):
    service = InteractionService(db)
    interaction = await service.create_interaction(user_id, data)
    return interaction


@router.get("/", response_model=dict)
async def list_interactions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user_id: Optional[UUID] = None,
    hcp_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
):
    service = InteractionService(db)
    interactions, total = await service.list_interactions(
        skip=skip, limit=limit, user_id=user_id, hcp_id=hcp_id
    )
    return {
        "data": [InteractionResponse.model_validate(i) for i in interactions],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/recent", response_model=list[InteractionResponse])
async def get_recent_interactions(
    limit: int = Query(5, ge=1, le=20),
    user_id: UUID = Depends(_get_user_id),
    db: AsyncSession = Depends(get_db),
):
    service = InteractionService(db)
    interactions = await service.get_recent_interactions(user_id, limit)
    return [InteractionResponse.model_validate(i) for i in interactions]


@router.get("/{interaction_id}", response_model=InteractionResponse)
async def get_interaction(
    interaction_id: UUID, db: AsyncSession = Depends(get_db)
):
    service = InteractionService(db)
    interaction = await service.get_interaction(interaction_id)
    if not interaction:
        raise HTTPException(status_code=404, detail="Interaction not found")
    return interaction


@router.put("/{interaction_id}", response_model=InteractionResponse)
async def update_interaction(
    interaction_id: UUID,
    data: InteractionUpdate,
    user_id: UUID = Depends(_get_user_id),
    db: AsyncSession = Depends(get_db),
):
    service = InteractionService(db)
    interaction = await service.update_interaction(interaction_id, user_id, data)
    if not interaction:
        raise HTTPException(status_code=404, detail="Interaction not found")
    return interaction


@router.delete("/{interaction_id}", status_code=204)
async def delete_interaction(
    interaction_id: UUID, db: AsyncSession = Depends(get_db)
):
    service = InteractionService(db)
    deleted = await service.delete_interaction(interaction_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Interaction not found")
