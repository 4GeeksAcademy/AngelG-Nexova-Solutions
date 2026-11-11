"""Authenticated HTTP interface for the LangGraph support agent."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from agent.graph import run_agent
from auth import get_current_user

router = APIRouter(
    prefix="/agent",
    tags=["agent"],
    dependencies=[Depends(get_current_user)],
)


class AgentQueryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str = Field(min_length=1, max_length=2000)


class AgentSource(BaseModel):
    document: str
    section: str


class AgentQueryResponse(BaseModel):
    answer: str
    sources: list[AgentSource]
    status: str
    trace: list[str]
    thread_id: str


@router.post("/query", response_model=AgentQueryResponse)
def query_agent(
    payload: AgentQueryRequest,
    current_user: dict = Depends(get_current_user),
) -> AgentQueryResponse:
    try:
        result = run_agent(payload.question, owner_id=current_user["id"])
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="No fue posible procesar la consulta.") from exc
    return AgentQueryResponse(**result)


class AgentTraceResponse(BaseModel):
    thread_id: str
    status: str
    trace: list[str]


@router.get("/traces/{thread_id}", response_model=AgentTraceResponse)
def query_agent_trace(
    thread_id: str,
    current_user: dict = Depends(get_current_user),
) -> AgentTraceResponse:
    from agent.graph import get_checkpoint

    try:
        result = get_checkpoint(thread_id, owner_id=current_user["id"])
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="No fue posible consultar la traza.",
        ) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Traza no encontrada.")
    return AgentTraceResponse(**result)