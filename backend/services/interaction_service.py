from uuid import UUID
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from repositories.interaction_repository import InteractionRepository
from models.schemas import InteractionCreate, InteractionUpdate
from models.database_models import ActivityLog


class InteractionService:
    def __init__(self, session: AsyncSession):
        self.repo = InteractionRepository(session)
        self.session = session

    async def create_interaction(self, user_id: UUID, data: InteractionCreate):
        interaction_data = data.model_dump()
        interaction_data["user_id"] = user_id
        interaction = await self.repo.create(interaction_data)

        # Log activity
        activity = ActivityLog(
            user_id=user_id,
            action="create_interaction",
            entity_type="interaction",
            entity_id=interaction.id,
            details={"source": "form"},
        )
        self.session.add(activity)
        await self.session.commit()

        return interaction

    async def get_interaction(self, interaction_id: UUID):
        return await self.repo.get_by_id(interaction_id)

    async def list_interactions(
        self,
        skip: int = 0,
        limit: int = 50,
        user_id: Optional[UUID] = None,
        hcp_id: Optional[UUID] = None,
    ):
        return await self.repo.get_all(
            skip=skip, limit=limit, user_id=user_id, hcp_id=hcp_id
        )

    async def update_interaction(self, interaction_id: UUID, user_id: UUID, data: InteractionUpdate):
        interaction = await self.repo.update(
            interaction_id, data.model_dump(exclude_unset=True)
        )
        if interaction:
            activity = ActivityLog(
                user_id=user_id,
                action="update_interaction",
                entity_type="interaction",
                entity_id=interaction.id,
                details={"updated_fields": list(data.model_dump(exclude_unset=True).keys())},
            )
            self.session.add(activity)
            await self.session.commit()
        return interaction

    async def delete_interaction(self, interaction_id: UUID):
        return await self.repo.delete(interaction_id)

    async def get_recent_interactions(self, user_id: UUID, limit: int = 5):
        return await self.repo.get_recent(user_id, limit)
