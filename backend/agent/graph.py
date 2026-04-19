import json
import re
from datetime import date
from typing import Optional
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_groq import ChatGroq
from sqlalchemy import select, func

from agent.state import AgentState
from agent.tools import ALL_TOOLS
from config import settings
from database import async_session
from models.database_models import HCP, Interaction


SYSTEM_PROMPT = """You are an AI assistant for a pharmaceutical CRM system, helping field representatives manage their interactions with Healthcare Professionals (HCPs).

You help users with general questions about their CRM workflows, pharmaceutical sales best practices, and HCP relationship management.

Be helpful, professional, and proactive.
Always respond in a friendly, conversational manner while being precise with data.
Do NOT mention or describe any tools, tool names, or suggest using specific tools — the system handles tool execution automatically."""


def _get_llm(model: str = "gemma2-9b-it") -> ChatGroq:
    return ChatGroq(
        api_key=settings.GROQ_API_KEY,
        model_name=model,
        temperature=0.3,
        max_tokens=2048,
    )


async def _resolve_hcp(text: str) -> Optional[dict]:
    """Extract HCP name from text via LLM (with regex fallback), then look up in DB."""
    name = None

    # --- Step 1: LLM extraction ---
    try:
        llm = _get_llm()
        resp = await llm.ainvoke([
            SystemMessage(content="Extract the doctor/HCP name from the message. Return only valid JSON."),
            HumanMessage(content=f'Extract the HCP name.\nMessage: {text}\nReturn: {{"hcp_name": "<name or null>"}}'),
        ])
        content = resp.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        start = content.find("{")
        end = content.rfind("}") + 1
        if start >= 0 and end > start:
            content = content[start:end]
        parsed = json.loads(content)
        name = parsed.get("hcp_name")
    except Exception:
        pass

    # --- Step 2: Regex fallback if LLM didn't extract ---
    if not name:
        m = re.search(r"(?:dr\.?\s+)([A-Za-z]+(?:\s+[A-Za-z]+)*)", text, re.IGNORECASE)
        if m:
            name = m.group(1)

    if not name:
        return None

    # Strip "Dr." prefix and normalise
    clean = name.lower().replace("dr.", "").replace("dr ", "").strip()
    parts = clean.split()
    if not parts:
        return None

    def _hit(hcp):
        return {"id": str(hcp.id), "name": f"{hcp.first_name} {hcp.last_name}"}

    async with async_session() as session:
        # 1. Exact first + last
        if len(parts) >= 2:
            q = select(HCP).where(
                func.lower(HCP.first_name) == parts[0],
                func.lower(HCP.last_name) == parts[-1],
            ).limit(1)
            hcp = (await session.execute(q)).scalar_one_or_none()
            if hcp:
                return _hit(hcp)

        # 2. Last-name exact
        for part in reversed(parts):
            q = select(HCP).where(
                func.lower(HCP.last_name) == part
            ).order_by(HCP.created_at.asc()).limit(1)
            hcp = (await session.execute(q)).scalar_one_or_none()
            if hcp:
                return _hit(hcp)

        # 3. First-name exact
        for part in parts:
            q = select(HCP).where(
                func.lower(HCP.first_name) == part
            ).order_by(HCP.created_at.asc()).limit(1)
            hcp = (await session.execute(q)).scalar_one_or_none()
            if hcp:
                return _hit(hcp)

        # 4. Partial match on concatenated full name  ("sarah%johnson")
        like_pattern = "%".join(parts)
        q = select(HCP).where(
            func.concat(func.lower(HCP.first_name), ' ', func.lower(HCP.last_name)).like(f"%{like_pattern}%")
        ).order_by(HCP.created_at.asc()).limit(1)
        hcp = (await session.execute(q)).scalar_one_or_none()
        if hcp:
            return _hit(hcp)

        # 5. ILIKE on last_name, then first_name
        for part in reversed(parts):
            if len(part) < 2:
                continue
            q = select(HCP).where(
                func.lower(HCP.last_name).like(f"%{part}%")
            ).order_by(HCP.created_at.asc()).limit(1)
            hcp = (await session.execute(q)).scalar_one_or_none()
            if hcp:
                return _hit(hcp)

        for part in parts:
            if len(part) < 2:
                continue
            q = select(HCP).where(
                func.lower(HCP.first_name).like(f"%{part}%")
            ).order_by(HCP.created_at.asc()).limit(1)
            hcp = (await session.execute(q)).scalar_one_or_none()
            if hcp:
                return _hit(hcp)

    return None


def _keyword_intent(text: str) -> Optional[str]:
    """Fast keyword-based intent detection as primary classifier."""
    t = text.lower().strip()

    # Edit / update an existing interaction
    if t.startswith("edit") or t.startswith("change") or t.startswith("update") or t.startswith("modify"):
        return "edit_interaction"
    if any(kw in t for kw in ["change the ", "update the ", "modify the ", "set the ", "make it ", "switch to ", "change sentiment", "change type"]):
        return "edit_interaction"

    # Summarize notes
    if t.startswith("summarize") or t.startswith("summary"):
        return "summarize"

    # Get context / history
    if any(kw in t for kw in ["history", "context", "tell me about", "past interactions", "interaction history", "previous meetings"]):
        return "get_context"

    # Suggest next actions
    if any(kw in t for kw in ["suggest", "what should i do", "next steps", "recommend", "what next", "what's next"]):
        return "suggest_action"

    # Log interaction — user describes meeting/call/visit with a doctor
    if any(kw in t for kw in ["i met", "i visited", "i called", "i spoke", "i had a meeting",
                               "met with dr", "meeting with dr", "discussed with dr",
                               "visited dr", "called dr", "spoke with dr", "spoke to dr",
                               "we discussed", "i presented", "i shared",
                               "had a call with", "had a video call", "had an appointment"]):
        return "log_interaction"

    return None


async def detect_intent(state: AgentState) -> AgentState:
    """Analyze user message and detect intent to route to the appropriate tool."""
    messages = state["messages"]
    last_message = messages[-1].content if messages else ""

    # 1. Fast keyword check first
    kw_intent = _keyword_intent(last_message)
    if kw_intent:
        state["intent"] = kw_intent
        return state

    # 2. Fall back to LLM classification
    llm = _get_llm()
    intent_prompt = f"""Classify this message into exactly ONE intent. Return ONLY a JSON object.

Intents:
- "log_interaction" — user describes a meeting, call, visit, or any contact with a healthcare professional (HCP/doctor)
- "edit_interaction" — user wants to change/update fields of an already-described interaction
- "get_context" — user asks about an HCP's history or wants to prepare for a meeting
- "suggest_action" — user wants recommendations or next steps for an HCP
- "summarize" — user provides lengthy notes and wants a concise summary
- "general" — anything else

Message: {last_message}

Return: {{"intent": "<intent>"}}"""

    try:
        response = await llm.ainvoke([
            SystemMessage(content="You are an intent classifier. Return only valid JSON, nothing else."),
            HumanMessage(content=intent_prompt),
        ])
        content = response.content.strip()
        # Strip markdown fences
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        intent_data = json.loads(content)
        state["intent"] = intent_data.get("intent", "general")
    except Exception:
        state["intent"] = "general"

    return state


async def route_intent(state: AgentState) -> str:
    """Route to the appropriate node based on detected intent."""
    intent = state.get("intent", "general")
    routes = {
        "log_interaction": "execute_log",
        "edit_interaction": "execute_edit",
        "get_context": "execute_context",
        "suggest_action": "execute_suggest",
        "summarize": "execute_summarize",
        "general": "general_response",
    }
    return routes.get(intent, "general_response")


async def execute_log(state: AgentState) -> AgentState:
    """Execute log interaction tool."""
    last_message = state["messages"][-1].content
    user_id = state.get("user_id", "")

    try:
        result = await ALL_TOOLS[0].ainvoke({
            "user_id": user_id,
            "raw_text": last_message,
        })
        tool_data = json.loads(result)
        state["tool_output"] = tool_data

        extracted = tool_data.get("extracted_data", {})

        if tool_data.get("success"):
            response = f"""I've logged your interaction and filled the form! Here's what I captured:

**HCP:** {extracted.get('hcp_name', 'N/A')}
**Type:** {extracted.get('interaction_type', 'N/A')}
**Date:** {extracted.get('date', 'N/A')}
**Products Discussed:** {', '.join(extracted.get('products_discussed', [])) or 'None mentioned'}
**Topics:** {', '.join(extracted.get('key_topics', [])) or 'None'}
**Sentiment:** {extracted.get('sentiment', 'N/A')}
**Follow-up Actions:** {', '.join(extracted.get('follow_up_actions', [])) or 'None'}

📝 The form on the left has been auto-filled. Review and submit when ready, or tell me to make changes."""
        else:
            # Still fill the form with whatever was extracted, even if DB save failed
            response = f"""I extracted your interaction details and filled the form:

**HCP:** {extracted.get('hcp_name', 'N/A')}
**Type:** {extracted.get('interaction_type', 'N/A')}
**Date:** {extracted.get('date', 'N/A')}
**Products Discussed:** {', '.join(extracted.get('products_discussed', [])) or 'None mentioned'}
**Sentiment:** {extracted.get('sentiment', 'N/A')}

📝 The form on the left has been auto-filled. Note: {tool_data.get('error', 'Could not save to database yet')}. Review the form and submit when ready."""

    except Exception as e:
        response = f"I encountered an issue while logging: {str(e)}. Please try again."
        state["tool_output"] = {"error": str(e)}

    state["messages"].append(AIMessage(content=response))
    state["final_response"] = response
    return state


async def execute_edit(state: AgentState) -> AgentState:
    """Execute edit interaction tool — also works for live form edits without an interaction_id."""
    last_message = state["messages"][-1].content

    edit_prompt = f"""The user wants to edit their HCP interaction form. 
Parse their request and return a JSON object with ONLY the fields that should be changed.

Possible fields:
- hcp_name: string (doctor's name)
- interaction_type: one of "in_person", "phone", "email", "video"
- date: YYYY-MM-DD format (use {date.today().isoformat()} for "today")
- notes: string
- products_discussed: list of strings
- key_topics: list of strings 
- sentiment: "positive", "neutral", or "negative"
- follow_up_actions: list of strings
- follow_up_date: YYYY-MM-DD or null
- summary: string
- materials_shared: list of strings
- samples_distributed: list of strings
- attendees: list of strings

User request: {last_message}

Return ONLY a valid JSON object with the fields to change. No explanation, no markdown."""

    updates = None
    for model in ["gemma2-9b-it", "llama-3.3-70b-versatile"]:
        try:
            llm = _get_llm(model)
            edit_response = await llm.ainvoke([
                SystemMessage(content="You are a JSON extraction assistant. Return only valid JSON, no markdown fences, no extra text."),
                HumanMessage(content=edit_prompt),
            ])
            content = edit_response.content.strip()
            # Strip markdown fences if present
            if content.startswith("```"):
                content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            # Extract JSON object if there's surrounding text
            start = content.find("{")
            end = content.rfind("}") + 1
            if start >= 0 and end > start:
                content = content[start:end]
            updates = json.loads(content)
            break
        except Exception:
            continue

    if updates and isinstance(updates, dict) and not updates.get("error"):
        changes_text = "\n".join(f"- **{k}:** {v}" for k, v in updates.items())

        state["tool_output"] = {
            "success": True,
            "extracted_data": updates,
            "changes_applied": updates,
        }

        response = f"""I've updated the form with your changes:

{changes_text}

📝 The form on the left has been updated. Let me know if you need any other changes."""
    else:
        response = "I couldn't parse the edit request. Could you try rephrasing? For example: \"Change sentiment to negative\" or \"Update interaction type to phone\"."
        state["tool_output"] = {"error": "Failed to parse edit instructions"}

    state["messages"].append(AIMessage(content=response))
    state["final_response"] = response
    return state


async def execute_context(state: AgentState) -> AgentState:
    """Execute get HCP context tool."""
    last_message = state["messages"][-1].content

    hcp_info = await _resolve_hcp(last_message)
    if not hcp_info:
        response = "I couldn't find that HCP in the system. Could you provide the full name? For example: \"Tell me about Dr. Johnson\""
        state["messages"].append(AIMessage(content=response))
        state["final_response"] = response
        return state

    try:
        result = await ALL_TOOLS[2].ainvoke({"hcp_id": hcp_info["id"]})
        tool_data = json.loads(result)
        state["tool_output"] = tool_data

        if tool_data.get("success"):
            hcp = tool_data["hcp"]
            total = tool_data["total_interactions"]
            products = ", ".join(tool_data.get("all_products_discussed", [])) or "None"
            sentiment = tool_data.get("overall_sentiment", "Unknown")

            recent = tool_data.get("recent_interactions", [])[:3]
            recent_text = ""
            for ix in recent:
                recent_text += f"\n- **{ix['date']}** ({ix['type']}): {ix.get('summary', 'No summary')}"

            response = f"""Here's the context for **Dr. {hcp['name']}**:

**Profile:**
- Specialty: {hcp.get('specialty', 'N/A')}
- Organization: {hcp.get('organization', 'N/A')}
- Location: {hcp.get('city', 'N/A')}, {hcp.get('state', 'N/A')}

**Interaction Summary:**
- Total Interactions: {total}
- Overall Sentiment: {sentiment}
- Products Discussed: {products}

**Recent Interactions:**{recent_text or ' None'}

Would you like me to suggest next actions for this HCP?"""
        else:
            response = f"Couldn't find HCP context: {tool_data.get('error', 'Unknown error')}"

    except Exception as e:
        response = f"I had trouble retrieving HCP context: {str(e)}"

    state["messages"].append(AIMessage(content=response))
    state["final_response"] = response
    return state


async def execute_suggest(state: AgentState) -> AgentState:
    """Execute suggest next action tool."""
    last_message = state["messages"][-1].content
    user_id = state.get("user_id", "")

    hcp_info = await _resolve_hcp(last_message)
    if not hcp_info:
        response = "I couldn't find that HCP in the system. Could you provide the full name? For example: \"Suggest next steps for Dr. Johnson\""
        state["messages"].append(AIMessage(content=response))
        state["final_response"] = response
        return state

    try:
        result = await ALL_TOOLS[3].ainvoke({
            "hcp_id": hcp_info["id"],
            "user_id": user_id,
        })
        tool_data = json.loads(result)
        state["tool_output"] = tool_data

        if tool_data.get("success"):
            suggestions = tool_data.get("suggestions", [])
            sugg_text = "\n".join(f"{i+1}. {s}" for i, s in enumerate(suggestions))
            priority = tool_data.get("priority", "medium")
            reasoning = tool_data.get("reasoning", "")

            response = f"""Here are my suggested next actions for **Dr. {tool_data.get('hcp_name', hcp_info['name'])}**:

{sugg_text}

**Priority:** {priority.title()}
**Reasoning:** {reasoning}"""

            if tool_data.get("recommended_date"):
                response += f"\n**Recommended Next Contact:** {tool_data['recommended_date']}"
        else:
            response = f"Couldn't generate suggestions: {tool_data.get('error', 'Unknown error')}"

    except Exception as e:
        response = f"I had trouble generating suggestions: {str(e)}"

    state["messages"].append(AIMessage(content=response))
    state["final_response"] = response
    return state


async def execute_summarize(state: AgentState) -> AgentState:
    """Execute summarize interaction tool — fetches real interactions from DB."""
    last_message = state["messages"][-1].content
    user_id = state.get("user_id", "")

    # Check if user mentions a specific HCP
    hcp_info = await _resolve_hcp(last_message)

    # Fetch real interactions from DB
    try:
        async with async_session() as session:
            query = select(Interaction).order_by(Interaction.date.desc()).limit(10)
            if hcp_info:
                query = query.where(Interaction.hcp_id == hcp_info["id"])
            elif user_id:
                query = query.where(Interaction.user_id == user_id)
            result = await session.execute(query)
            interactions = result.scalars().all()

        if not interactions:
            response = "No interactions found to summarize. Log some interactions first!"
            state["messages"].append(AIMessage(content=response))
            state["final_response"] = response
            return state

        # Build text from real interactions for the summarize tool
        notes_parts = []
        for ix in interactions:
            parts = [f"Date: {ix.date}"]
            if ix.interaction_type:
                parts.append(f"Type: {ix.interaction_type.value}")
            if ix.notes:
                parts.append(f"Notes: {ix.notes}")
            if ix.summary:
                parts.append(f"Summary: {ix.summary}")
            if ix.products_discussed:
                parts.append(f"Products: {', '.join(ix.products_discussed)}")
            if ix.sentiment:
                parts.append(f"Sentiment: {ix.sentiment.value}")
            if ix.follow_up_actions:
                parts.append(f"Follow-ups: {', '.join(ix.follow_up_actions)}")
            notes_parts.append("\n".join(parts))

        combined_text = "\n---\n".join(notes_parts)

        result = await ALL_TOOLS[4].ainvoke({"text": combined_text})
        tool_data = json.loads(result)
        state["tool_output"] = tool_data

        if tool_data.get("success"):
            key_points = "\n".join(f"- {p}" for p in tool_data.get("key_points", []))
            actions = "\n".join(f"- {a}" for a in tool_data.get("action_items", []))
            products = ", ".join(tool_data.get("products_mentioned", [])) or "None"

            tool_data["extracted_data"] = {
                "summary": tool_data.get("summary", ""),
                "key_topics": tool_data.get("key_points", []),
                "products_discussed": tool_data.get("products_mentioned", []),
                "follow_up_actions": tool_data.get("action_items", []),
                "sentiment": tool_data.get("sentiment", ""),
            }

            hcp_label = f" for **Dr. {hcp_info['name']}**" if hcp_info else ""
            response = f"""Here's your interaction summary{hcp_label} ({len(interactions)} interactions):

**Summary:** {tool_data.get('summary', 'N/A')}

**Key Points:**
{key_points or '- None identified'}

**Action Items:**
{actions or '- None identified'}

**Products Mentioned:** {products}
**Overall Sentiment:** {tool_data.get('sentiment', 'N/A')}"""
        else:
            response = f"Couldn't generate summary: {tool_data.get('error', 'Unknown error')}"

    except Exception as e:
        response = f"I had trouble summarizing: {str(e)}"

    state["messages"].append(AIMessage(content=response))
    state["final_response"] = response
    return state


async def general_response(state: AgentState) -> AgentState:
    """Handle general conversation that doesn't match specific tools."""
    llm = _get_llm()
    messages = [SystemMessage(content=SYSTEM_PROMPT)] + state["messages"]

    try:
        response = await llm.ainvoke(messages)
        state["messages"].append(response)
        state["final_response"] = response.content
    except Exception:
        # Fallback to llama model
        try:
            llm_fallback = _get_llm("llama-3.3-70b-versatile")
            response = await llm_fallback.ainvoke(messages)
            state["messages"].append(response)
            state["final_response"] = response.content
        except Exception as e:
            fallback_msg = "I'm having trouble connecting to the AI service. Please try again in a moment."
            state["messages"].append(AIMessage(content=fallback_msg))
            state["final_response"] = fallback_msg

    return state


def create_agent_graph():
    """Create the LangGraph agent workflow."""
    graph = StateGraph(AgentState)

    # Add nodes
    graph.add_node("detect_intent", detect_intent)
    graph.add_node("execute_log", execute_log)
    graph.add_node("execute_edit", execute_edit)
    graph.add_node("execute_context", execute_context)
    graph.add_node("execute_suggest", execute_suggest)
    graph.add_node("execute_summarize", execute_summarize)
    graph.add_node("general_response", general_response)

    # Set entry point
    graph.set_entry_point("detect_intent")

    # Add conditional routing
    graph.add_conditional_edges(
        "detect_intent",
        route_intent,
        {
            "execute_log": "execute_log",
            "execute_edit": "execute_edit",
            "execute_context": "execute_context",
            "execute_suggest": "execute_suggest",
            "execute_summarize": "execute_summarize",
            "general_response": "general_response",
        },
    )

    # All execution nodes go to END
    graph.add_edge("execute_log", END)
    graph.add_edge("execute_edit", END)
    graph.add_edge("execute_context", END)
    graph.add_edge("execute_suggest", END)
    graph.add_edge("execute_summarize", END)
    graph.add_edge("general_response", END)

    return graph.compile()


async def run_agent(message: str, user_id: str, history: list = None) -> dict:
    """Run the agent with a user message and return the response."""
    graph = create_agent_graph()

    messages = []
    if history:
        for msg in history:
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            else:
                messages.append(AIMessage(content=msg["content"]))
    messages.append(HumanMessage(content=message))

    initial_state = {
        "messages": messages,
        "user_id": user_id,
        "intent": None,
        "tool_output": None,
        "final_response": None,
    }

    result = await graph.ainvoke(initial_state)

    return {
        "message": result.get("final_response", "I couldn't process your request."),
        "tool_used": result.get("intent"),
        "data": result.get("tool_output"),
    }
