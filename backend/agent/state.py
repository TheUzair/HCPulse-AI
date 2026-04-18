from typing import TypedDict, Annotated, Optional, List
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    user_id: str
    intent: Optional[str]
    tool_output: Optional[dict]
    final_response: Optional[str]
