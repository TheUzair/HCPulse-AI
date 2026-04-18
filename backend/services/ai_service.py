from typing import Optional, List
from agent.graph import run_agent


class AIService:
    async def chat(
        self,
        message: str,
        user_id: str,
        history: Optional[List[dict]] = None,
    ) -> dict:
        result = await run_agent(
            message=message,
            user_id=user_id,
            history=history,
        )
        return result
