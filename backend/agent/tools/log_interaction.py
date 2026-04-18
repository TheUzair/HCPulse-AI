import json
from datetime import date, datetime
from typing import Optional
from langchain_core.tools import tool
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session
from models.database_models import Interaction, HCP, ActivityLog, InteractionType, Sentiment
from config import settings
from groq import Groq


def _extract_interaction_data(raw_text: str) -> dict:
    """Use Groq LLM to extract structured interaction data from raw text."""
    client = Groq(api_key=settings.GROQ_API_KEY)

    extraction_prompt = f"""Extract structured interaction data from the following text. 
Return a JSON object with these fields:
- hcp_name: string (the healthcare professional's name)
- interaction_type: one of "in_person", "phone", "email", "video"
- date: string in YYYY-MM-DD format (use today's date {date.today().isoformat()} if not mentioned)
- notes: string (key discussion points)
- products_discussed: list of strings (pharmaceutical products or drugs mentioned)
- key_topics: list of strings (main topics discussed)
- sentiment: one of "positive", "neutral", "negative"
- follow_up_actions: list of strings (any follow-up items)
- follow_up_date: string in YYYY-MM-DD format or null
- summary: string (brief 2-3 sentence summary)
- materials_shared: list of strings (any materials shared like brochures, pamphlets, studies, etc.)
- samples_distributed: list of strings (any drug samples given)
- attendees: list of strings (names of other people present at the meeting besides the HCP)

Text: {raw_text}

Return ONLY the JSON object, no markdown formatting or extra text."""

    try:
        response = client.chat.completions.create(
            model="gemma2-9b-it",
            messages=[{"role": "user", "content": extraction_prompt}],
            temperature=0.1,
            max_tokens=1024,
        )
        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(content)
    except Exception:
        # Fallback to llama model
        try:
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": extraction_prompt}],
                temperature=0.1,
                max_tokens=1024,
            )
            content = response.choices[0].message.content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1].rsplit("```", 1)[0]
            return json.loads(content)
        except Exception as e:
            return {"error": str(e)}


@tool
async def log_interaction_tool(
    user_id: str,
    raw_text: str,
    hcp_id: Optional[str] = None,
) -> str:
    """Log a new HCP interaction. Accepts raw conversation text or form data,
    uses LLM to extract structured fields (HCP name, products, sentiment, follow-ups),
    and stores the interaction record in the database.
    
    Args:
        user_id: The ID of the user logging the interaction
        raw_text: Raw text describing the interaction (from chat or form notes)
        hcp_id: Optional HCP ID if already known
    """
    extracted = _extract_interaction_data(raw_text)

    if "error" in extracted:
        return json.dumps({"success": False, "error": extracted["error"]})

    async with async_session() as session:
        # Resolve HCP
        resolved_hcp_id = hcp_id
        if not resolved_hcp_id and extracted.get("hcp_name"):
            hcp_name = extracted["hcp_name"]
            clean_name = hcp_name.replace("Dr.", "").replace("Dr", "").strip()
            name_parts = clean_name.split()

            hcp = None
            # Try exact first+last match
            if len(name_parts) >= 2:
                result = await session.execute(
                    select(HCP).where(
                        func.lower(HCP.first_name) == name_parts[0].lower(),
                        func.lower(HCP.last_name) == name_parts[-1].lower(),
                    ).limit(1)
                )
                hcp = result.scalar_one_or_none()

            # Fall back to last name match (handles "Dr. Johnson" → find "Sarah Johnson")
            if not hcp:
                search_name = name_parts[-1].lower() if name_parts else clean_name.lower()
                result = await session.execute(
                    select(HCP).where(
                        func.lower(HCP.last_name) == search_name
                    ).order_by(HCP.created_at.asc()).limit(1)
                )
                hcp = result.scalar_one_or_none()

            # Fall back to first name match
            if not hcp and name_parts:
                result = await session.execute(
                    select(HCP).where(
                        func.lower(HCP.first_name) == name_parts[0].lower()
                    ).order_by(HCP.created_at.asc()).limit(1)
                )
                hcp = result.scalar_one_or_none()

            if hcp:
                resolved_hcp_id = str(hcp.id)
            else:
                # Auto-create only if truly not found — use last name as last_name
                first = name_parts[0] if len(name_parts) >= 2 else clean_name
                last = " ".join(name_parts[1:]) if len(name_parts) >= 2 else clean_name
                new_hcp = HCP(first_name=first, last_name=last)
                session.add(new_hcp)
                await session.flush()
                resolved_hcp_id = str(new_hcp.id)
                extracted["hcp_auto_created"] = True

        # Map interaction type
        type_map = {
            "in_person": InteractionType.IN_PERSON,
            "phone": InteractionType.PHONE,
            "email": InteractionType.EMAIL,
            "video": InteractionType.VIDEO,
        }
        interaction_type = type_map.get(
            extracted.get("interaction_type", "in_person"),
            InteractionType.IN_PERSON,
        )

        # Map sentiment
        sentiment_map = {
            "positive": Sentiment.POSITIVE,
            "neutral": Sentiment.NEUTRAL,
            "negative": Sentiment.NEGATIVE,
        }
        sentiment = sentiment_map.get(extracted.get("sentiment"))

        # Parse date
        try:
            interaction_date = date.fromisoformat(extracted.get("date", date.today().isoformat()))
        except (ValueError, TypeError):
            interaction_date = date.today()

        # Parse follow-up date
        follow_up_date = None
        if extracted.get("follow_up_date"):
            try:
                follow_up_date = date.fromisoformat(extracted["follow_up_date"])
            except (ValueError, TypeError):
                pass

        interaction = Interaction(
            user_id=user_id,
            hcp_id=resolved_hcp_id,
            interaction_type=interaction_type,
            date=interaction_date,
            notes=extracted.get("notes", raw_text),
            summary=extracted.get("summary", ""),
            products_discussed=extracted.get("products_discussed", []),
            key_topics=extracted.get("key_topics", []),
            sentiment=sentiment,
            follow_up_actions=extracted.get("follow_up_actions", []),
            follow_up_date=follow_up_date,
        )

        session.add(interaction)

        # Log activity
        activity = ActivityLog(
            user_id=user_id,
            action="log_interaction",
            entity_type="interaction",
            entity_id=interaction.id,
            details={"source": "ai_chat", "extracted_data": extracted},
        )
        session.add(activity)
        await session.commit()
        await session.refresh(interaction)

        return json.dumps({
            "success": True,
            "interaction_id": str(interaction.id),
            "summary": extracted.get("summary", ""),
            "extracted_data": extracted,
        })
