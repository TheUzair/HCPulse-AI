import json
from typing import Optional
from langchain_core.tools import tool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session
from models.database_models import Interaction, ActivityLog
from config import settings
from groq import Groq


def _parse_edit_instructions(instructions: str, current_data: dict) -> dict:
    """Use LLM to interpret edit instructions and return updated fields."""
    client = Groq(api_key=settings.GROQ_API_KEY)

    prompt = f"""Given the current interaction data and the user's edit instructions, 
return a JSON object with ONLY the fields that need to be changed with their new values.

Current interaction data:
{json.dumps(current_data, indent=2, default=str)}

Edit instructions: {instructions}

Possible fields to edit: notes, summary, products_discussed (list), key_topics (list), 
sentiment (positive/neutral/negative), follow_up_actions (list), follow_up_date (YYYY-MM-DD), 
interaction_type (in_person/phone/email/video), date (YYYY-MM-DD)

Return ONLY a JSON object with changed fields. No markdown formatting."""

    try:
        response = client.chat.completions.create(
            model="gemma2-9b-it",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=512,
        )
        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(content)
    except Exception:
        try:
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=512,
            )
            content = response.choices[0].message.content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1].rsplit("```", 1)[0]
            return json.loads(content)
        except Exception as e:
            return {"error": str(e)}


@tool
async def edit_interaction_tool(
    interaction_id: str,
    user_id: str,
    edit_instructions: str,
) -> str:
    """Edit an existing HCP interaction. Fetches the interaction, uses LLM to interpret
    edit instructions, modifies specified fields, and saves the updated record.
    
    Args:
        interaction_id: The UUID of the interaction to edit
        user_id: The ID of the user making the edit
        edit_instructions: Natural language instructions for what to change
    """
    async with async_session() as session:
        result = await session.execute(
            select(Interaction).where(Interaction.id == interaction_id)
        )
        interaction = result.scalar_one_or_none()

        if not interaction:
            return json.dumps({
                "success": False,
                "error": f"Interaction {interaction_id} not found.",
            })

        current_data = {
            "notes": interaction.notes,
            "summary": interaction.summary,
            "products_discussed": interaction.products_discussed,
            "key_topics": interaction.key_topics,
            "sentiment": interaction.sentiment.value if interaction.sentiment else None,
            "follow_up_actions": interaction.follow_up_actions,
            "follow_up_date": str(interaction.follow_up_date) if interaction.follow_up_date else None,
            "interaction_type": interaction.interaction_type.value if interaction.interaction_type else None,
            "date": str(interaction.date),
        }

        updates = _parse_edit_instructions(edit_instructions, current_data)

        if "error" in updates:
            return json.dumps({"success": False, "error": updates["error"]})

        # Apply updates
        editable_fields = {
            "notes", "summary", "products_discussed", "key_topics",
            "sentiment", "follow_up_actions", "follow_up_date",
            "interaction_type", "date",
        }

        changes = {}
        for field, value in updates.items():
            if field in editable_fields:
                setattr(interaction, field, value)
                changes[field] = value

        activity = ActivityLog(
            user_id=user_id,
            action="edit_interaction",
            entity_type="interaction",
            entity_id=interaction.id,
            details={"changes": changes, "instructions": edit_instructions},
        )
        session.add(activity)
        await session.commit()

        return json.dumps({
            "success": True,
            "interaction_id": str(interaction.id),
            "changes_applied": changes,
            "message": f"Successfully updated {len(changes)} field(s).",
        })
