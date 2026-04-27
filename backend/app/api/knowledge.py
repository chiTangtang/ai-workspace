"""
知识库管理 API 路由
提供知识库的创建、查询、删除和知识库问答功能
"""
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db, KnowledgeBase, Document, ModelConfig
from app.core.vector_store import vector_store
from app.models.schemas import (
    KnowledgeBaseCreate,
    KnowledgeBaseResponse,
    RAGRequest,
)
from app.services.rag_service import rag_service

router = APIRouter(prefix="/api", tags=["知识库"])


@router.post("/knowledge-bases", response_model=KnowledgeBaseResponse)
async def create_knowledge_base(
    request: KnowledgeBaseCreate,
    db: Session = Depends(get_db),
):
    """
    创建新的知识库
    """
    try:
        kb = KnowledgeBase(name=request.name, description=request.description)
        db.add(kb)
        db.commit()
        db.refresh(kb)

        # 为知识库创建向量集合
        vector_store.create_collection(kb.id)

        return KnowledgeBaseResponse(
            id=kb.id,
            name=kb.name,
            description=kb.description,
            document_count=0,
            created_at=kb.created_at,
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"创建知识库失败: {str(e)}")


@router.get("/knowledge-bases", response_model=list[KnowledgeBaseResponse])
async def get_knowledge_bases(db: Session = Depends(get_db)):
    """
    获取所有知识库列表
    """
    knowledge_bases = db.query(KnowledgeBase).order_by(KnowledgeBase.created_at).all()
    result = []
    for kb in knowledge_bases:
        doc_count = db.query(func.count(Document.id)).filter(
            Document.knowledge_base_id == kb.id
        ).scalar() or 0
        result.append(KnowledgeBaseResponse(
            id=kb.id,
            name=kb.name,
            description=kb.description,
            document_count=doc_count,
            created_at=kb.created_at,
        ))
    return result


@router.get("/knowledge-bases/{kb_id}", response_model=KnowledgeBaseResponse)
async def get_knowledge_base(kb_id: int, db: Session = Depends(get_db)):
    """
    获取知识库详情
    """
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail=f"知识库 {kb_id} 不存在")

    doc_count = db.query(func.count(Document.id)).filter(
        Document.knowledge_base_id == kb.id
    ).scalar() or 0

    return KnowledgeBaseResponse(
        id=kb.id,
        name=kb.name,
        description=kb.description,
        document_count=doc_count,
        created_at=kb.created_at,
    )


@router.delete("/knowledge-bases/{kb_id}")
async def delete_knowledge_base(kb_id: int, db: Session = Depends(get_db)):
    """
    删除知识库及其所有文档和向量数据
    """
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail=f"知识库 {kb_id} 不存在")

    try:
        # 删除向量集合
        vector_store.delete_collection(kb_id)

        # 删除知识库（级联删除文档）
        db.delete(kb)
        db.commit()

        return {"message": f"知识库 {kb_id} 及其所有文档已删除"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"删除知识库失败: {str(e)}")


@router.post("/knowledge-bases/{kb_id}/query")
async def query_knowledge_base(
    kb_id: int,
    request: RAGRequest,
    db: Session = Depends(get_db),
):
    """
    知识库问答（RAG 检索增强生成）
    """
    # 验证知识库存在
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail=f"知识库 {kb_id} 不存在")

    # 获取模型配置
    model_config = None
    if request.model_config_id:
        config = db.query(ModelConfig).filter(ModelConfig.id == request.model_config_id).first()
        if not config:
            raise HTTPException(status_code=404, detail=f"模型配置 {request.model_config_id} 不存在")
        model_config = {
            "base_url": config.base_url,
            "api_key": config.api_key,
            "model_name": config.model_name,
            "provider": config.provider,
        }
    else:
        config = db.query(ModelConfig).filter(ModelConfig.is_default == True).first()
        if not config:
            config = db.query(ModelConfig).first()
        if config:
            model_config = {
                "base_url": config.base_url,
                "api_key": config.api_key,
                "model_name": config.model_name,
                "provider": config.provider,
            }

    if not model_config:
        raise HTTPException(status_code=400, detail="没有可用的模型配置，请先添加模型配置")

    try:
        # 使用流式响应
        async def stream_generator():
            async for chunk in rag_service.query_stream(
                db=db,
                question=request.question,
                knowledge_base_id=kb_id,
                model_config=model_config,
                conversation_id=request.conversation_id,
            ):
                yield chunk

        return StreamingResponse(
            stream_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"知识库问答失败: {str(e)}")
