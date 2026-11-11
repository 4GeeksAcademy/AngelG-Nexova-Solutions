"""Authenticated HTTP endpoint for the sales knowledge assistant."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from auth import get_current_user
from data.pipelines.rag import query_with_sources

router = APIRouter(
    prefix="/knowledge",
    tags=["knowledge"],
    dependencies=[Depends(get_current_user)],
)


class KnowledgeQueryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str = Field(min_length=1, max_length=2000)


class KnowledgeSource(BaseModel):
    document: str
    section: str


class KnowledgeQueryResponse(BaseModel):
    answer: str
    sources: list[KnowledgeSource]


@router.post("/query", response_model=KnowledgeQueryResponse)
def query_knowledge(payload: KnowledgeQueryRequest) -> KnowledgeQueryResponse:
    result = query_with_sources(payload.question.strip())
    return KnowledgeQueryResponse(**result)