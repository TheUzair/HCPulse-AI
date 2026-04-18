from uuid import UUID
from typing import Optional, List
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.database_models import Interaction


class InteractionRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, data: dict) -> Interaction:
        interaction = Interaction(**data)
        self.session.add(interaction)
        await self.session.commit()
        await self.session.refresh(interaction)
        return interaction

    async def get_by_id(self, interaction_id: UUID) -> Optional[Interaction]:
        result = await self.session.execute(
            select(Interaction).where(Interaction.id == interaction_id)
        )
        return result.scalar_one_or_none()

    async def get_all(
        self,
        skip: int = 0,
        limit: int = 50,
        user_id: Optional[UUID] = None,
        hcp_id: Optional[UUID] = None,
    ) -> tuple[List[Interaction], int]:
        query = select(Interaction)
        count_query = select(func.count()).select_from(Interaction)

        if user_id:
            query = query.where(Interaction.user_id == user_id)
            count_query = count_query.where(Interaction.user_id == user_id)

        if hcp_id:
            query = query.where(Interaction.hcp_id == hcp_id)
            count_query = count_query.where(Interaction.hcp_id == hcp_id)

        total_result = await self.session.execute(count_query)
        total = total_result.scalar()

        result = await self.session.execute(
            query.order_by(Interaction.date.desc()).offset(skip).limit(limit)
        )
        return result.scalars().all(), total

    async def get_by_hcp(self, hcp_id: UUID, limit: int = 20) -> List[Interaction]:
        result = await self.session.execute(
            select(Interaction)
            .where(Interaction.hcp_id == hcp_id)
            .order_by(Interaction.date.desc())
            .limit(limit)
        )
        return result.scalars().all()

    async def update(self, interaction_id: UUID, data: dict) -> Optional[Interaction]:
        interaction = await self.get_by_id(interaction_id)
        if not interaction:
            return None
        for key, value in data.items():
            if value is not None:
                setattr(interaction, key, value)
        await self.session.commit()
        await self.session.refresh(interaction)
        return interaction

    async def delete(self, interaction_id: UUID) -> bool:
        interaction = await self.get_by_id(interaction_id)
        if not interaction:
            return False
        await self.session.delete(interaction)
        await self.session.commit()
        return True

    async def get_recent(self, user_id: UUID, limit: int = 5) -> List[Interaction]:
        result = await self.session.execute(
            select(Interaction)
            .where(Interaction.user_id == user_id)
            .order_by(Interaction.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()
