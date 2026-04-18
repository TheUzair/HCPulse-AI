import json
from langchain_core.tools import tool

from config import settings
from groq import Groq


@tool
async def summarize_interaction_tool(text: str) -> str:
    """Convert long interaction notes or chat conversations into a concise, 
    structured summary. Extracts key discussion points, decisions made, 
    and action items.
    
    Args:
        text: The long-form interaction notes or chat transcript to summarize
    """
    client = Groq(api_key=settings.GROQ_API_KEY)

    prompt = f"""Summarize the following HCP interaction notes into a concise, structured format.

Notes/Transcript:
{text}

Return a JSON object with:
- summary: A concise 2-3 sentence summary
- key_points: list of the main discussion points (max 5)
- decisions_made: list of any decisions or agreements reached
- action_items: list of follow-up actions needed
- products_mentioned: list of any pharmaceutical products mentioned
- sentiment: overall sentiment ("positive", "neutral", or "negative")
- duration_estimate: estimated meeting duration if discernible, otherwise null

Return ONLY the JSON object, no markdown formatting."""

    try:
        response = client.chat.completions.create(
            model="gemma2-9b-it",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=1024,
        )
        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0]
        result = json.loads(content)
        result["success"] = True
        return json.dumps(result)
    except Exception:
        try:
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=1024,
            )
            content = response.choices[0].message.content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1].rsplit("```", 1)[0]
            result = json.loads(content)
            result["success"] = True
            return json.dumps(result)
        except Exception as e:
            return json.dumps({
                "success": False,
                "error": f"Failed to summarize: {str(e)}",
            })
