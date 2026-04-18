import json
from typing import Optional
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_groq import ChatGroq
from agent.state import AgentState
from agent.tools import ALL_TOOLS
from config import settings


SYSTEM_PROMPT = """You are an AI assistant for a pharmaceutical CRM system, helping field representatives manage their interactions with Healthcare Professionals (HCPs).

You have access to the following tools:

1. **log_interaction_tool** - Log a new interaction with an HCP. Use when the user describes a meeting, call, or any contact with a doctor.
2. **edit_interaction_tool** - Edit an existing interaction. Use when the user wants to modify or update a previously logged interaction.
3. **get_hcp_context_tool** - Get full context and history for an HCP. Use when the user wants to know about past interactions or prepare for a meeting.
4. **suggest_next_action_tool** - Get AI-powered suggestions for next steps with an HCP. Use when the user asks what to do next or needs recommendations.
5. **summarize_interaction_tool** - Summarize long interaction notes into a concise format. Use when the user provides lengthy notes and wants a summary.

When a user describes an interaction, always extract:
- Who they met (HCP name)
- What was discussed (products, topics)
- How the interaction went (sentiment)
- What follow-up is needed

Be helpful, professional, and proactive. If information is missing, ask for it.
Always respond in a friendly, conversational manner while being precise with data."""


def _get_llm(model: str = "gemma2-9b-it") -> ChatGroq:
    return ChatGroq(
        api_key=settings.GROQ_API_KEY,
        model_name=model,
        temperature=0.3,
        max_tokens=2048,
    )


async def detect_intent(state: AgentState) -> AgentState:
    """Analyze user message and detect intent to route to the appropriate tool."""
    llm = _get_llm()
    messages = state["messages"]
    last_message = messages[-1].content if messages else ""

    intent_prompt = f"""Analyze the following user message and determine the intent. 
Return ONLY one of these intents as a JSON object:

- "log_interaction" - User wants to log/record a new interaction with an HCP
- "edit_interaction" - User wants to modify an existing interaction
- "get_context" - User wants to know about an HCP's history or prepare for a meeting
- "suggest_action" - User wants recommendations for next steps
- "summarize" - User wants to summarize interaction notes
- "general" - General conversation or question that doesn't fit the above

User message: {last_message}

Return JSON: {{"intent": "<intent>", "confidence": <0.0-1.0>, "entities": {{}}}}
Extract any entities like HCP names, interaction IDs, dates mentioned."""

    try:
        response = await llm.ainvoke([
            SystemMessage(content="You are an intent classifier. Return only valid JSON."),
            HumanMessage(content=intent_prompt),
        ])
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0]
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

        if tool_data.get("success"):
            extracted = tool_data.get("extracted_data", {})
            response = f"""I've logged your interaction successfully! Here's what I captured:

**Summary:** {extracted.get('summary', 'N/A')}
**HCP:** {extracted.get('hcp_name', 'N/A')}
**Type:** {extracted.get('interaction_type', 'N/A')}
**Products Discussed:** {', '.join(extracted.get('products_discussed', [])) or 'None mentioned'}
**Sentiment:** {extracted.get('sentiment', 'N/A')}
**Follow-up Actions:** {', '.join(extracted.get('follow_up_actions', [])) or 'None'}

Interaction ID: `{tool_data.get('interaction_id', 'N/A')}`

Is there anything you'd like to modify or add?"""
        else:
            response = f"I couldn't log the interaction: {tool_data.get('error', 'Unknown error')}. Could you provide more details?"

    except Exception as e:
        response = f"I encountered an issue while logging: {str(e)}. Please try again."
        state["tool_output"] = {"error": str(e)}

    state["messages"].append(AIMessage(content=response))
    state["final_response"] = response
    return state


async def execute_edit(state: AgentState) -> AgentState:
    """Execute edit interaction tool."""
    last_message = state["messages"][-1].content
    user_id = state.get("user_id", "")

    # Extract interaction ID from message using LLM
    llm = _get_llm()
    try:
        id_response = await llm.ainvoke([
            HumanMessage(content=f"""Extract the interaction ID and edit instructions from this message.
Return JSON: {{"interaction_id": "<uuid or null>", "instructions": "<what to change>"}}
Message: {last_message}"""),
        ])
        content = id_response.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0]
        parsed = json.loads(content)

        if not parsed.get("interaction_id"):
            response = "I need the interaction ID to edit it. Could you provide the interaction ID? You can find it in your interaction history."
            state["messages"].append(AIMessage(content=response))
            state["final_response"] = response
            return state

        result = await ALL_TOOLS[1].ainvoke({
            "interaction_id": parsed["interaction_id"],
            "user_id": user_id,
            "edit_instructions": parsed.get("instructions", last_message),
        })
        tool_data = json.loads(result)
        state["tool_output"] = tool_data

        if tool_data.get("success"):
            changes = tool_data.get("changes_applied", {})
            changes_text = "\n".join(f"- **{k}:** {v}" for k, v in changes.items())
            response = f"""I've updated the interaction successfully!

**Changes Applied:**
{changes_text}

{tool_data.get('message', '')}"""
        else:
            response = f"Couldn't edit the interaction: {tool_data.get('error', 'Unknown error')}"

    except Exception as e:
        response = f"I need more information to edit the interaction. Please provide the interaction ID and what you'd like to change."

    state["messages"].append(AIMessage(content=response))
    state["final_response"] = response
    return state


async def execute_context(state: AgentState) -> AgentState:
    """Execute get HCP context tool."""
    last_message = state["messages"][-1].content

    # Extract HCP ID from message
    llm = _get_llm()
    try:
        id_response = await llm.ainvoke([
            HumanMessage(content=f"""Extract the HCP ID or name from this message.
Return JSON: {{"hcp_id": "<uuid or null>", "hcp_name": "<name or null>"}}
Message: {last_message}"""),
        ])
        content = id_response.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0]
        parsed = json.loads(content)

        hcp_id = parsed.get("hcp_id")
        if not hcp_id:
            response = "I need the HCP ID to look up their context. Could you provide it?"
            state["messages"].append(AIMessage(content=response))
            state["final_response"] = response
            return state

        result = await ALL_TOOLS[2].ainvoke({"hcp_id": hcp_id})
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

            response = f"""Here's the context for **{hcp['name']}**:

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
        response = "I need the HCP ID to look up their context. Could you provide it?"

    state["messages"].append(AIMessage(content=response))
    state["final_response"] = response
    return state


async def execute_suggest(state: AgentState) -> AgentState:
    """Execute suggest next action tool."""
    last_message = state["messages"][-1].content
    user_id = state.get("user_id", "")

    llm = _get_llm()
    try:
        id_response = await llm.ainvoke([
            HumanMessage(content=f"""Extract the HCP ID from this message.
Return JSON: {{"hcp_id": "<uuid or null>"}}
Message: {last_message}"""),
        ])
        content = id_response.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0]
        parsed = json.loads(content)

        hcp_id = parsed.get("hcp_id")
        if not hcp_id:
            response = "I need the HCP ID to provide suggestions. Which HCP would you like suggestions for?"
            state["messages"].append(AIMessage(content=response))
            state["final_response"] = response
            return state

        result = await ALL_TOOLS[3].ainvoke({
            "hcp_id": hcp_id,
            "user_id": user_id,
        })
        tool_data = json.loads(result)
        state["tool_output"] = tool_data

        if tool_data.get("success"):
            suggestions = tool_data.get("suggestions", [])
            sugg_text = "\n".join(f"{i+1}. {s}" for i, s in enumerate(suggestions))
            priority = tool_data.get("priority", "medium")
            reasoning = tool_data.get("reasoning", "")

            response = f"""Here are my suggested next actions for **{tool_data.get('hcp_name', 'this HCP')}**:

{sugg_text}

**Priority:** {priority.title()}
**Reasoning:** {reasoning}"""

            if tool_data.get("recommended_date"):
                response += f"\n**Recommended Next Contact:** {tool_data['recommended_date']}"
        else:
            response = f"Couldn't generate suggestions: {tool_data.get('error', 'Unknown error')}"

    except Exception as e:
        response = "I need the HCP ID to provide suggestions. Which HCP would you like suggestions for?"

    state["messages"].append(AIMessage(content=response))
    state["final_response"] = response
    return state


async def execute_summarize(state: AgentState) -> AgentState:
    """Execute summarize interaction tool."""
    last_message = state["messages"][-1].content

    try:
        result = await ALL_TOOLS[4].ainvoke({"text": last_message})
        tool_data = json.loads(result)
        state["tool_output"] = tool_data

        if tool_data.get("success"):
            key_points = "\n".join(f"- {p}" for p in tool_data.get("key_points", []))
            actions = "\n".join(f"- {a}" for a in tool_data.get("action_items", []))
            products = ", ".join(tool_data.get("products_mentioned", [])) or "None"

            response = f"""Here's your interaction summary:

**Summary:** {tool_data.get('summary', 'N/A')}

**Key Points:**
{key_points or '- None identified'}

**Action Items:**
{actions or '- None identified'}

**Products Mentioned:** {products}
**Sentiment:** {tool_data.get('sentiment', 'N/A')}

Would you like me to log this as an interaction?"""
        else:
            response = f"Couldn't generate summary: {tool_data.get('error', 'Unknown error')}"

    except Exception as e:
        response = f"I had trouble summarizing. Please try again: {str(e)}"

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
