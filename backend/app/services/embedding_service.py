"""
Embedding 服务模块
调用 OpenAI 兼容的 /embeddings 接口生成文本向量
"""
import httpx
from typing import Optional


class EmbeddingService:
    """文本嵌入服务类"""

    def __init__(self):
        """初始化 Embedding 服务"""
        self.timeout = 60.0  # 请求超时时间（秒）

    async def embed_texts(
        self,
        texts: list[str],
        model_config: Optional[dict] = None,
        embedding_model: Optional[str] = None,
    ) -> list[list[float]]:
        """
        批量生成文本嵌入向量
        :param texts: 文本列表
        :param model_config: 模型配置 {"base_url": "...", "api_key": "...", "provider": "..."}
        :param embedding_model: 嵌入模型名称（可选，覆盖默认）
        :return: 嵌入向量列表
        """
        if not texts:
            return []

        # 使用配置的 embedding 模型或默认模型
        model_name = embedding_model or "text-embedding-ada-002"

        # 构建 API URL
        base_url = model_config["base_url"].rstrip("/") if model_config else "https://api.openai.com/v1"
        api_key = model_config["api_key"] if model_config else ""
        url = f"{base_url}/embeddings"

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        }

        # OpenRouter 需要额外的请求头
        if model_config and model_config.get("provider") == "openrouter":
            headers["HTTP-Referer"] = "https://ai-workspace.local"
            headers["X-Title"] = "AI Workspace"

        # 分批处理（某些 API 有批量大小限制）
        batch_size = 100
        all_embeddings = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]

            payload = {
                "model": model_name,
                "input": batch,
            }

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()

            # 提取嵌入向量（按输入顺序排列）
            embeddings = sorted(data["data"], key=lambda x: x["index"])
            batch_embeddings = [item["embedding"] for item in embeddings]
            all_embeddings.extend(batch_embeddings)

        return all_embeddings

    async def embed_query(
        self,
        text: str,
        model_config: Optional[dict] = None,
        embedding_model: Optional[str] = None,
    ) -> list[float]:
        """
        生成单条查询文本的嵌入向量
        :param text: 查询文本
        :param model_config: 模型配置
        :param embedding_model: 嵌入模型名称
        :return: 嵌入向量
        """
        embeddings = await self.embed_texts(
            texts=[text],
            model_config=model_config,
            embedding_model=embedding_model,
        )
        return embeddings[0] if embeddings else []


# 全局 Embedding 服务实例
embedding_service = EmbeddingService()
