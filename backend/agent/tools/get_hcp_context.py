import json
from langchain_core.tools import tool
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from database import async_session
from models.database_models import HCP, Interaction


@tool
async def get_hcp_context_tool(hcp_id: str) -> str:
    """Retrieve full context for a Healthcare Professional including their profile 
    and past interaction history. Useful for preparing before a meeting or understanding
    the relationship history with an HCP.
    
    Args:
        hcp_id: The UUID of the HCP to get context for
    """
    async with async_session() as session:
        result = await session.execute(
            select(HCP).where(HCP.id == hcp_id)
        )
        hcp = result.scalar_one_or_none()

        if not hcp:
            return json.dumps({
                "success": False,
                "error": f"HCP with ID {hcp_id} not found.",
            })

        # Fetch interactions
        interactions_result = await session.execute(
            select(Interaction)
            .where(Interaction.hcp_id == hcp_id)
            .order_by(Interaction.date.desc())
            .limit(20)
        )
        interactions = interactions_result.scalars().all()

        interaction_history = []
        for ix in interactions:
            interaction_history.append({
                "id": str(ix.id),
                "date": str(ix.date),
                "type": ix.interaction_type.value if ix.interaction_type else None,
                "summary": ix.summary,
                "products_discussed": ix.products_discussed,
                "sentiment": ix.sentiment.value if ix.sentiment else None,
                "follow_up_actions": ix.follow_up_actions,
                "key_topics": ix.key_topics,
            })

        context = {
            "success": True,
            "hcp": {
                "id": str(hcp.id),
                "name": f"{hcp.first_name} {hcp.last_name}",
                "specialty": hcp.specialty,
                "organization": hcp.organization,
                "email": hcp.email,
                "phone": hcp.phone,
                "city": hcp.city,
                "state": hcp.state,
            },
            "total_interactions": len(interaction_history),
            "recent_interactions": interaction_history[:10],
            "all_products_discussed": list(set(
                p for ix in interaction_history
                for p in (ix.get("products_discussed") or [])
            )),
            "overall_sentiment": _calculate_overall_sentiment(interaction_history),
        }

        return json.dumps(context, default=str)


def _calculate_overall_sentiment(interactions: list) -> str:
    if not interactions:
        return "unknown"
    sentiments = [ix["sentiment"] for ix in interactions if ix.get("sentiment")]
    if not sentiments:
        return "unknown"
    counts = {"positive": 0, "neutral": 0, "negative": 0}
    for s in sentiments:
        if s in counts:
            counts[s] += 1
    return max(counts, key=counts.get)
