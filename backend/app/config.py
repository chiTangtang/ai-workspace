"""
配置管理模块
使用 Pydantic Settings 管理应用配置，支持从 .env 文件和环境变量读取
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用配置类"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # 应用基础配置
    APP_NAME: str = "AI 智能工作助手"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # 数据库配置
    DATABASE_URL: str = "sqlite:///./data/ai_workspace.db"

    # ChromaDB 向量数据库路径
    CHROMA_DB_PATH: str = "./data/chroma_db"

    # 文件上传目录
    UPLOAD_DIR: str = "./data/uploads"

    # 默认 LLM 配置
    DEFAULT_LLM_BASE_URL: str = "https://api.openai.com/v1"
    DEFAULT_LLM_API_KEY: str = ""
    DEFAULT_LLM_MODEL_NAME: str = "gpt-3.5-turbo"

    # 默认 Embedding 配置
    DEFAULT_EMBEDDING_BASE_URL: str = "https://api.openai.com/v1"
    DEFAULT_EMBEDDING_API_KEY: str = ""
    DEFAULT_EMBEDDING_MODEL_NAME: str = "text-embedding-ada-002"

    # 对话上下文保留的最大消息数
    MAX_CONTEXT_MESSAGES: int = 20

    # RAG 检索返回的最大文档数
    RAG_TOP_K: int = 5

    # 文本分块配置
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50

    # Agent 最大工具调用轮数
    AGENT_MAX_TOOL_ROUNDS: int = 10

    # 代码执行超时时间（秒）
    CODE_EXECUTION_TIMEOUT: int = 30

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # 确保必要的目录存在
        self._ensure_directories()

    def _ensure_directories(self):
        """确保必要的目录存在"""
        Path(self.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
        Path(self.CHROMA_DB_PATH).mkdir(parents=True, exist_ok=True)

    @property
    def database_path(self) -> str:
        """获取 SQLite 数据库文件路径"""
        # 将 sqlite:///./data/xxx.db 转换为实际文件路径
        return self.DATABASE_URL.replace("sqlite:///", "")


# 全局配置实例
settings = Settings()
