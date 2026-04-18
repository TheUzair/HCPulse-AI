from uuid import UUID
from typing import Optional, List
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.database_models import HCP


class HCPRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, data: dict) -> HCP:
        hcp = HCP(**data)
        self.session.add(hcp)
        await self.session.commit()
        await self.session.refresh(hcp)
        return hcp

    async def get_by_id(self, hcp_id: UUID) -> Optional[HCP]:
        result = await self.session.execute(
            select(HCP).where(HCP.id == hcp_id)
        )
        return result.scalar_one_or_none()

    async def get_all(
        self,
        skip: int = 0,
        limit: int = 50,
        search: Optional[str] = None,
        specialty: Optional[str] = None,
    ) -> tuple[List[HCP], int]:
        query = select(HCP)
        count_query = select(func.count()).select_from(HCP)

        if search:
            search_filter = (
                HCP.first_name.ilike(f"%{search}%")
                | HCP.last_name.ilike(f"%{search}%")
                | HCP.organization.ilike(f"%{search}%")
            )
            query = query.where(search_filter)
            count_query = count_query.where(search_filter)

        if specialty:
            query = query.where(HCP.specialty.ilike(f"%{specialty}%"))
            count_query = count_query.where(HCP.specialty.ilike(f"%{specialty}%"))

        total_result = await self.session.execute(count_query)
        total = total_result.scalar()

        result = await self.session.execute(
            query.order_by(HCP.last_name).offset(skip).limit(limit)
        )
        return result.scalars().all(), total

    async def update(self, hcp_id: UUID, data: dict) -> Optional[HCP]:
        hcp = await self.get_by_id(hcp_id)
        if not hcp:
            return None
        for key, value in data.items():
            if value is not None:
                setattr(hcp, key, value)
        await self.session.commit()
        await self.session.refresh(hcp)
        return hcp

    async def delete(self, hcp_id: UUID) -> bool:
        hcp = await self.get_by_id(hcp_id)
        if not hcp:
            return False
        await self.session.delete(hcp)
        await self.session.commit()
        return True
