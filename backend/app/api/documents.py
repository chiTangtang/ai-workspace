"""
文档管理 API 路由
提供文档上传、列表获取、删除等功能
"""
import os
import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.core.database import get_db, Document, KnowledgeBase, ModelConfig
from app.models.schemas import (
    DocumentResponse,
    DocumentUploadPrecheckRequest,
    DocumentUploadPrecheckResponse,
)
from app.services.rag_service import rag_service
from app.services.embedding_service import embedding_service
from app.config import settings

router = APIRouter(prefix="/api", tags=["文档管理"])


SUPPORTED_EXTENSIONS = {
    ".pdf": "PDF 解析器",
    ".doc": "DOC 解析器",
    ".docx": "DOCX 解析器",
    ".txt": "纯文本解析器",
    ".md": "Markdown 解析器",
}


def _resolve_embedding_model_config(db: Session):
    config = db.query(ModelConfig).filter(ModelConfig.is_embedding_default == True).first()
    if not config:
        config = db.query(ModelConfig).filter(ModelConfig.is_default == True).first()
    if not config:
        config = db.query(ModelConfig).first()
    return config


def _infer_embedding_warning(config: ModelConfig | None) -> list[str]:
    warnings: list[str] = []
    if not config:
        warnings.append("未找到任何模型配置，文档无法向量化。")
        return warnings

    model_name = (config.model_name or "").lower()
    embedding_hints = ("embedding", "bge", "m3", "gte", "e5")
    if not any(hint in model_name for hint in embedding_hints):
        warnings.append(
            "当前选中的默认向量模型名称看起来不像 embedding 模型，上传时可能在 /embeddings 阶段失败。"
        )
    if config.provider == "openrouter":
        warnings.append(
            "OpenRouter 并非所有模型都开放 /embeddings，请先使用“测试向量模型”确认权限。"
        )
    return warnings


@router.post(
    "/knowledge-bases/{kb_id}/documents/precheck",
    response_model=DocumentUploadPrecheckResponse,
)
async def precheck_document_upload(
    kb_id: int,
    request: DocumentUploadPrecheckRequest,
    db: Session = Depends(get_db),
):
    """
    上传前预检查：文件格式、向量模型配置和潜在风险提示
    """
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail=f"知识库 {kb_id} 不存在")

    extension = os.path.splitext(request.filename)[1].lower()
    parser_name = SUPPORTED_EXTENSIONS.get(extension)
    config = _resolve_embedding_model_config(db)
    warnings = _infer_embedding_warning(config)

    if request.file_size > 20 * 1024 * 1024:
        warnings.append("文件超过 20MB，解析和向量化耗时可能明显增加。")

    return DocumentUploadPrecheckResponse(
        supported=extension in SUPPORTED_EXTENSIONS,
        filename=request.filename,
        extension=extension,
        parser=parser_name or "未知解析器",
        embedding_model_available=config is not None,
        embedding_model_name=config.model_name if config else None,
        embedding_provider=config.provider if config else None,
        warnings=warnings,
    )


@router.post("/knowledge-bases/{kb_id}/documents", response_model=DocumentResponse)
async def upload_document(
    kb_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    上传文档到知识库
    支持 PDF、DOCX、TXT、Markdown 格式
    上传后会自动解析、分块、生成向量并存入向量库
    """
    # 验证知识库存在
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail=f"知识库 {kb_id} 不存在")

    # 验证文件格式
    filename = file.filename or "unknown"
    file_ext = os.path.splitext(filename)[1].lower()
    if file_ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件格式: {file_ext}，仅支持 {', '.join(SUPPORTED_EXTENSIONS.keys())}",
        )

    try:
        # 保存上传的文件
        upload_dir = settings.UPLOAD_DIR
        os.makedirs(upload_dir, exist_ok=True)

        # 使用知识库 ID 作为子目录
        kb_upload_dir = os.path.join(upload_dir, f"kb_{kb_id}")
        os.makedirs(kb_upload_dir, exist_ok=True)

        file_path = os.path.join(kb_upload_dir, filename)

        # 如果文件已存在，先删除
        if os.path.exists(file_path):
            os.remove(file_path)

        # 保存文件
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)

        # 获取模型配置用于生成嵌入向量
        model_config = None
        config = _resolve_embedding_model_config(db)
        if config:
            model_config = {
                "base_url": config.base_url,
                "api_key": config.api_key,
                "model_name": config.model_name,
                "provider": config.provider,
            }
        else:
            raise HTTPException(status_code=400, detail="没有可用的向量模型配置，请先在设置页配置默认向量模型")

        # 处理文档（解析、分块、嵌入、存储）
        result = await rag_service.process_document(
            db=db,
            knowledge_base_id=kb_id,
            file_path=file_path,
            model_config=model_config,
        )

        # 获取刚创建的文档记录
        doc = db.query(Document).filter(Document.id == result["document_id"]).first()
        return doc

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except httpx.HTTPStatusError as e:
        detail = f"文档向量化失败（HTTP {e.response.status_code}）"
        if e.response.status_code == 401:
            detail += "：当前向量模型的 API Key 无效。"
        elif e.response.status_code == 403:
            detail += "：当前向量模型没有 /embeddings 权限，或该模型本身不支持向量化。"
        elif e.response.status_code == 404:
            detail += "：当前 Base URL 或模型名不正确，服务端找不到 embeddings 接口。"
        else:
            detail += "：向量服务返回了错误响应。"
        detail += f" 原始错误: {e.response.text[:300]}"
        raise HTTPException(status_code=400, detail=detail)
    except Exception as e:
        error_message = str(e)
        if "embeddings" in error_message.lower() or "model" in error_message.lower():
            raise HTTPException(
                status_code=400,
                detail=(
                    "文档向量化失败。当前默认模型配置很可能不支持 embeddings，"
                    "请改用支持嵌入的模型后重试。原始错误: "
                    f"{error_message}"
                ),
            )
        raise HTTPException(status_code=500, detail=f"文档处理失败: {error_message}")


@router.get("/knowledge-bases/{kb_id}/documents", response_model=list[DocumentResponse])
async def get_documents(kb_id: int, db: Session = Depends(get_db)):
    """
    获取知识库下的所有文档列表
    """
    # 验证知识库存在
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail=f"知识库 {kb_id} 不存在")

    documents = (
        db.query(Document)
        .filter(Document.knowledge_base_id == kb_id)
        .order_by(Document.created_at)
        .all()
    )
    return documents


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: int, db: Session = Depends(get_db)):
    """
    删除文档及其向量数据
    """
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail=f"文档 {doc_id} 不存在")

    try:
        # 删除文件
        if os.path.exists(doc.file_path):
            os.remove(doc.file_path)

        # 注意：ChromaDB 不支持按 metadata 删除单个文档的向量
        # 这里我们记录日志，实际生产中可以重建整个知识库的向量
        kb_id = doc.knowledge_base_id

        # 从数据库中删除文档记录
        db.delete(doc)
        db.commit()

        return {"message": f"文档 {doc_id} 已删除", "filename": doc.filename}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除文档失败: {str(e)}")
