"""
RAG（检索增强生成）服务模块
实现文档处理、向量检索和增强生成的完整流程
"""
import json
import os
from typing import Optional
from sqlalchemy.orm import Session

from app.core.database import KnowledgeBase, Document, ModelConfig
from app.core.vector_store import vector_store
from app.services.llm_service import llm_service
from app.services.embedding_service import embedding_service
from app.utils.document_parser import DocumentParser
from app.utils.text_splitter import TextSplitter
from app.config import settings


class RAGService:
    """RAG 检索增强生成服务类"""

    def __init__(self):
        """初始化 RAG 服务"""
        self.text_splitter = TextSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
        )
        self.top_k = settings.RAG_TOP_K

    async def process_document(
        self,
        db: Session,
        knowledge_base_id: int,
        file_path: str,
        model_config: Optional[dict] = None,
    ) -> dict:
        """
        处理文档：解析 -> 分块 -> 嵌入 -> 存入向量库
        :param db: 数据库会话
        :param knowledge_base_id: 知识库 ID
        :param file_path: 文件路径
        :param model_config: 模型配置（用于生成嵌入向量）
        :return: 处理结果 {"chunk_count": int}
        """
        # 验证知识库存在
        kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == knowledge_base_id).first()
        if not kb:
            raise ValueError(f"知识库 {knowledge_base_id} 不存在")

        # 1. 解析文档
        text = DocumentParser.parse(file_path)
        if not text.strip():
            raise ValueError("文档内容为空，无法处理")

        # 2. 文本分块
        chunks = self.text_splitter.split_text(text)
        if not chunks:
            raise ValueError("文本分块结果为空")

        # 3. 生成嵌入向量
        embeddings = await embedding_service.embed_texts(chunks, model_config=model_config)

        # 4. 构建元数据
        filename = os.path.basename(file_path)
        metadatas = [
            {"filename": filename, "chunk_index": i, "knowledge_base_id": knowledge_base_id}
            for i in range(len(chunks))
        ]

        # 5. 确保向量集合存在并添加文档
        vector_store.create_collection(knowledge_base_id)
        vector_store.add_documents(
            knowledge_base_id=knowledge_base_id,
            chunks=chunks,
            embeddings=embeddings,
            metadatas=metadatas,
        )

        # 6. 更新数据库中的文档记录
        doc = Document(
            knowledge_base_id=knowledge_base_id,
            filename=filename,
            file_path=file_path,
            chunk_count=len(chunks),
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        return {"chunk_count": len(chunks), "document_id": doc.id}

    async def query(
        self,
        db: Session,
        question: str,
        knowledge_base_id: int,
        model_config: dict,
        conversation_id: Optional[int] = None,
    ) -> str:
        """
        RAG 查询：检索相关文档 -> 拼装 Prompt -> LLM 生成回答
        :param db: 数据库会话
        :param question: 用户问题
        :param knowledge_base_id: 知识库 ID
        :param model_config: 模型配置
        :param conversation_id: 对话 ID（可选）
        :return: LLM 生成的回答
        """
        # 1. 生成查询向量
        query_embedding = await embedding_service.embed_query(question, model_config=model_config)

        # 2. 在向量库中检索相关文档
        search_results = vector_store.search(
            knowledge_base_id=knowledge_base_id,
            query_embedding=query_embedding,
            top_k=self.top_k,
        )

        # 3. 构建上下文
        context_parts = []
        for i, doc in enumerate(search_results["documents"]):
            metadata = search_results["metadatas"][i] if i < len(search_results["metadatas"]) else {}
            source = metadata.get("filename", "未知来源")
            context_parts.append(f"[文档片段 {i+1}（来源：{source}）]\n{doc}")

        context = "\n\n".join(context_parts)

        # 4. 构建系统提示词
        system_prompt = self._build_rag_prompt(context)

        # 5. 构建消息列表
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question},
        ]

        # 6. 调用 LLM 生成回答
        response = await llm_service.chat(
            messages=messages,
            model_config=model_config,
        )

        return response

    async def query_stream(
        self,
        db: Session,
        question: str,
        knowledge_base_id: int,
        model_config: dict,
        conversation_id: Optional[int] = None,
    ):
        """
        RAG 流式查询
        :param db: 数据库会话
        :param question: 用户问题
        :param knowledge_base_id: 知识库 ID
        :param model_config: 模型配置
        :param conversation_id: 对话 ID（可选）
        :yield: SSE 格式的数据块
        """
        # 1. 生成查询向量
        query_embedding = await embedding_service.embed_query(question, model_config=model_config)

        # 2. 检索相关文档
        search_results = vector_store.search(
            knowledge_base_id=knowledge_base_id,
            query_embedding=query_embedding,
            top_k=self.top_k,
        )

        # 3. 构建上下文
        context_parts = []
        for i, doc in enumerate(search_results["documents"]):
            metadata = search_results["metadatas"][i] if i < len(search_results["metadatas"]) else {}
            source = metadata.get("filename", "未知来源")
            context_parts.append(f"[文档片段 {i+1}（来源：{source}）]\n{doc}")

        context = "\n\n".join(context_parts)

        # 4. 构建系统提示词
        system_prompt = self._build_rag_prompt(context)

        # 5. 构建消息列表
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question},
        ]

        # 6. 流式调用 LLM
        assistant_content = ""
        try:
            async for chunk in llm_service.chat_stream(
                messages=messages,
                model_config=model_config,
            ):
                assistant_content += self._extract_content_from_sse(chunk)
                yield chunk
        except Exception as ex:
            if not assistant_content.strip():
                try:
                    fallback_response = await llm_service.chat(
                        messages=messages,
                        model_config=model_config,
                    )
                    if fallback_response:
                        chunk_data = json.dumps({"content": fallback_response}, ensure_ascii=False)
                        yield f"data: {chunk_data}\n\n"
                    yield "data: [DONE]\n\n"
                    return
                except Exception as fallback_ex:
                    error_data = json.dumps(
                        {
                            "type": "error",
                            "data": (
                                "知识库流式响应失败，且回退到非流式也失败: "
                                f"{llm_service.describe_exception(fallback_ex)}"
                            ),
                        },
                        ensure_ascii=False,
                    )
                    yield f"data: {error_data}\n\n"
                    yield "data: [DONE]\n\n"
                    return

            error_data = json.dumps(
                {
                    "type": "error",
                    "data": f"知识库流式响应失败: {llm_service.describe_exception(ex)}",
                },
                ensure_ascii=False,
            )
            yield f"data: {error_data}\n\n"
            yield "data: [DONE]\n\n"

    @staticmethod
    def _build_rag_prompt(context: str) -> str:
        """
        构建 RAG 系统提示词
        :param context: 检索到的上下文内容
        :return: 系统提示词
        """
        return f"""你是一个专业的 AI 助手，请根据以下提供的参考文档内容来回答用户的问题。

参考文档内容：
---
{context}
---

请遵循以下规则：
1. 优先使用参考文档中的信息来回答问题
2. 如果参考文档中没有相关信息，请明确告知用户
3. 回答时请注明信息来源
4. 如果问题与参考文档无关，你可以根据你的知识来回答，但要说明这不是来自文档的信息
5. 请用清晰、准确的语言回答"""

    @staticmethod
    def _extract_content_from_sse(sse_text: str) -> str:
        """
        从单个或多个 SSE 数据块中提取纯文本内容。
        :param sse_text: SSE 格式文本
        :return: 纯文本内容
        """
        content_parts = []
        for line in sse_text.split("\n"):
            line = line.strip()
            if line.startswith("data: ") and line != "data: [DONE]":
                try:
                    data = json.loads(line[6:])
                    if "content" in data:
                        content_parts.append(data["content"])
                except (json.JSONDecodeError, TypeError):
                    continue
        return "".join(content_parts)


# 全局 RAG 服务实例
rag_service = RAGService()
