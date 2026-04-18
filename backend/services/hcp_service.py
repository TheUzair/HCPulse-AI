from uuid import UUID
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from repositories.hcp_repository import HCPRepository
from models.schemas import HCPCreate, HCPUpdate


class HCPService:
    def __init__(self, session: AsyncSession):
        self.repo = HCPRepository(session)

    async def create_hcp(self, data: HCPCreate):
        return await self.repo.create(data.model_dump())

    async def get_hcp(self, hcp_id: UUID):
        return await self.repo.get_by_id(hcp_id)

    async def list_hcps(
        self,
        skip: int = 0,
        limit: int = 50,
        search: Optional[str] = None,
        specialty: Optional[str] = None,
    ):
        return await self.repo.get_all(skip=skip, limit=limit, search=search, specialty=specialty)

    async def update_hcp(self, hcp_id: UUID, data: HCPUpdate):
        return await self.repo.update(hcp_id, data.model_dump(exclude_unset=True))

    async def delete_hcp(self, hcp_id: UUID):
        return await self.repo.delete(hcp_id)
