from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from services.hcp_service import HCPService
from models.schemas import HCPCreate, HCPUpdate, HCPResponse

router = APIRouter(prefix="/hcp", tags=["HCP"])


@router.post("/", response_model=HCPResponse, status_code=201)
async def create_hcp(data: HCPCreate, db: AsyncSession = Depends(get_db)):
    service = HCPService(db)
    hcp = await service.create_hcp(data)
    return hcp


@router.get("/", response_model=dict)
async def list_hcps(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    specialty: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    service = HCPService(db)
    hcps, total = await service.list_hcps(
        skip=skip, limit=limit, search=search, specialty=specialty
    )
    return {
        "data": [HCPResponse.model_validate(h) for h in hcps],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/{hcp_id}", response_model=HCPResponse)
async def get_hcp(hcp_id: UUID, db: AsyncSession = Depends(get_db)):
    service = HCPService(db)
    hcp = await service.get_hcp(hcp_id)
    if not hcp:
        raise HTTPException(status_code=404, detail="HCP not found")
    return hcp


@router.put("/{hcp_id}", response_model=HCPResponse)
async def update_hcp(
    hcp_id: UUID, data: HCPUpdate, db: AsyncSession = Depends(get_db)
):
    service = HCPService(db)
    hcp = await service.update_hcp(hcp_id, data)
    if not hcp:
        raise HTTPException(status_code=404, detail="HCP not found")
    return hcp


@router.delete("/{hcp_id}", status_code=204)
async def delete_hcp(hcp_id: UUID, db: AsyncSession = Depends(get_db)):
    service = HCPService(db)
    deleted = await service.delete_hcp(hcp_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="HCP not found")
