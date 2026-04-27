"""
向量数据库模块
使用 ChromaDB 实现向量存储和相似度检索
"""
import chromadb
from app.config import settings


class VectorStore:
    """向量数据库封装类"""

    def __init__(self):
        """初始化 ChromaDB 客户端"""
        self.client = chromadb.PersistentClient(path=settings.CHROMA_DB_PATH)

    def create_collection(self, knowledge_base_id: int) -> None:
        """
        为知识库创建向量集合
        :param knowledge_base_id: 知识库 ID
        """
        collection_name = self._get_collection_name(knowledge_base_id)
        # 如果集合已存在则获取，否则创建
        self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},  # 使用余弦相似度
        )

    def add_documents(
        self,
        knowledge_base_id: int,
        chunks: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict],
    ) -> None:
        """
        向知识库添加文档向量
        :param knowledge_base_id: 知识库 ID
        :param chunks: 文本块列表
        :param embeddings: 对应的嵌入向量列表
        :param metadatas: 元数据列表
        """
        collection_name = self._get_collection_name(knowledge_base_id)
        collection = self.client.get_or_create_collection(name=collection_name)

        # 生成唯一 ID 列表
        ids = [f"doc_{knowledge_base_id}_{i}" for i in range(len(chunks))]

        # 分批添加（ChromaDB 有批量大小限制）
        batch_size = 100
        for i in range(0, len(chunks), batch_size):
            end_idx = min(i + batch_size, len(chunks))
            collection.add(
                ids=ids[i:end_idx],
                documents=chunks[i:end_idx],
                embeddings=embeddings[i:end_idx],
                metadatas=metadatas[i:end_idx],
            )

    def search(
        self,
        knowledge_base_id: int,
        query_embedding: list[float],
        top_k: int = 5,
    ) -> dict:
        """
        在知识库中搜索相似文档
        :param knowledge_base_id: 知识库 ID
        :param query_embedding: 查询向量
        :param top_k: 返回的最大结果数
        :return: 检索结果，包含 documents, metadatas, distances
        """
        collection_name = self._get_collection_name(knowledge_base_id)
        try:
            collection = self.client.get_collection(name=collection_name)
        except Exception:
            # 集合不存在时返回空结果
            return {
                "documents": [],
                "metadatas": [],
                "distances": [],
            }

        if collection.count() == 0:
            return {
                "documents": [],
                "metadatas": [],
                "distances": [],
            }

        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k, collection.count()),
        )

        return {
            "documents": results["documents"][0] if results["documents"] else [],
            "metadatas": results["metadatas"][0] if results["metadatas"] else [],
            "distances": results["distances"][0] if results["distances"] else [],
        }

    def delete_collection(self, knowledge_base_id: int) -> None:
        """
        删除知识库的向量集合
        :param knowledge_base_id: 知识库 ID
        """
        collection_name = self._get_collection_name(knowledge_base_id)
        try:
            self.client.delete_collection(name=collection_name)
        except Exception:
            # 集合不存在时忽略错误
            pass

    def get_collection_count(self, knowledge_base_id: int) -> int:
        """
        获取知识库向量集合中的文档数量
        :param knowledge_base_id: 知识库 ID
        :return: 文档数量
        """
        collection_name = self._get_collection_name(knowledge_base_id)
        try:
            collection = self.client.get_collection(name=collection_name)
            return collection.count()
        except Exception:
            return 0

    @staticmethod
    def _get_collection_name(knowledge_base_id: int) -> str:
        """
        生成集合名称
        ChromaDB 集合名称只允许字母、数字、下划线和短横线
        :param knowledge_base_id: 知识库 ID
        :return: 集合名称
        """
        return f"kb_{knowledge_base_id}"


# 全局向量数据库实例
vector_store = VectorStore()
