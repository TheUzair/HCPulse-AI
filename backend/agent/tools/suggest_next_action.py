import json
from langchain_core.tools import tool
from sqlalchemy import select

from database import async_session
from models.database_models import HCP, Interaction
from config import settings
from groq import Groq


@tool
async def suggest_next_action_tool(hcp_id: str, user_id: str) -> str:
    """Analyze past interactions with an HCP and recommend follow-up actions.
    Uses LLM to generate intelligent suggestions based on interaction history,
    recent topics, and pending follow-ups.
    
    Args:
        hcp_id: The UUID of the HCP to suggest actions for
        user_id: The ID of the user requesting suggestions
    """
    async with async_session() as session:
        # Get HCP details
        hcp_result = await session.execute(
            select(HCP).where(HCP.id == hcp_id)
        )
        hcp = hcp_result.scalar_one_or_none()

        if not hcp:
            return json.dumps({
                "success": False,
                "error": f"HCP with ID {hcp_id} not found.",
            })

        # Get recent interactions
        ix_result = await session.execute(
            select(Interaction)
            .where(Interaction.hcp_id == hcp_id)
            .order_by(Interaction.date.desc())
            .limit(10)
        )
        interactions = ix_result.scalars().all()

        if not interactions:
            return json.dumps({
                "success": True,
                "hcp_name": f"{hcp.first_name} {hcp.last_name}",
                "suggestions": [
                    "Schedule an introductory meeting to establish the relationship.",
                    "Research the HCP's specialty and recent publications.",
                    "Prepare relevant product information for initial discussion.",
                ],
                "reasoning": "No prior interactions found. Suggesting initial engagement steps.",
            })

        # Build context for LLM
        history_text = ""
        for ix in interactions:
            history_text += f"""
Date: {ix.date}
Type: {ix.interaction_type.value if ix.interaction_type else 'N/A'}
Summary: {ix.summary or ix.notes or 'No summary'}
Products: {', '.join(ix.products_discussed or [])}
Sentiment: {ix.sentiment.value if ix.sentiment else 'N/A'}
Follow-ups: {', '.join(ix.follow_up_actions or [])}
---"""

        client = Groq(api_key=settings.GROQ_API_KEY)
        prompt = f"""Based on the interaction history with Dr. {hcp.first_name} {hcp.last_name} 
(Specialty: {hcp.specialty or 'N/A'}, Organization: {hcp.organization or 'N/A'}), 
suggest the next best actions for the field representative.

Interaction History:
{history_text}

Provide exactly 3-5 specific, actionable suggestions. Consider:
1. Pending follow-ups that haven't been completed
2. Products that showed interest
3. Optimal timing for next contact
4. Relationship-building opportunities
5. Any concerns that need addressing

Return a JSON object with:
- suggestions: list of actionable suggestion strings
- priority: "high", "medium", or "low"
- reasoning: brief explanation of your analysis
- recommended_date: suggested date for next contact (YYYY-MM-DD)

Return ONLY the JSON object."""

        try:
            response = client.chat.completions.create(
                model="gemma2-9b-it",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=1024,
            )
            content = response.choices[0].message.content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1].rsplit("```", 1)[0]
            result = json.loads(content)
            result["success"] = True
            result["hcp_name"] = f"{hcp.first_name} {hcp.last_name}"
            return json.dumps(result)
        except Exception:
            try:
                response = client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                    max_tokens=1024,
                )
                content = response.choices[0].message.content.strip()
                if content.startswith("```"):
                    content = content.split("\n", 1)[1].rsplit("```", 1)[0]
                result = json.loads(content)
                result["success"] = True
                result["hcp_name"] = f"{hcp.first_name} {hcp.last_name}"
                return json.dumps(result)
            except Exception as e:
                return json.dumps({
                    "success": False,
                    "error": f"Failed to generate suggestions: {str(e)}",
                })
