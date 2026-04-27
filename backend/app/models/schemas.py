"""
Pydantic 数据模型
定义所有 API 请求和响应的数据结构
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


# ==================== 对话相关模型 ====================

class ChatRequest(BaseModel):
    """对话请求"""
    model_config = ConfigDict(protected_namespaces=())

    message: str = Field(..., description="用户消息内容", min_length=1)
    conversation_id: Optional[int] = Field(None, description="对话 ID，不传则创建新对话")
    model_config_id: Optional[int] = Field(None, description="模型配置 ID")
    stream: bool = Field(True, description="是否使用流式响应")


class ChatResponse(BaseModel):
    """对话响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: int
    role: str
    content: str
    created_at: datetime


class ConversationResponse(BaseModel):
    """对话列表响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    created_at: datetime
    message_count: int = 0


# ==================== 知识库相关模型 ====================

class KnowledgeBaseCreate(BaseModel):
    """创建知识库请求"""
    name: str = Field(..., description="知识库名称", min_length=1, max_length=255)
    description: str = Field("", description="知识库描述")


class KnowledgeBaseResponse(BaseModel):
    """知识库响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    document_count: int = 0
    created_at: datetime


class DocumentResponse(BaseModel):
    """文档响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    knowledge_base_id: int
    filename: str
    chunk_count: int
    created_at: datetime


# ==================== RAG 相关模型 ====================

class RAGRequest(BaseModel):
    """RAG 查询请求"""
    model_config = ConfigDict(protected_namespaces=())

    question: str = Field(..., description="用户问题", min_length=1)
    knowledge_base_id: int = Field(..., description="知识库 ID")
    conversation_id: Optional[int] = Field(None, description="对话 ID")
    model_config_id: Optional[int] = Field(None, description="模型配置 ID")


# ==================== 模型配置相关 ====================

class ModelConfigCreate(BaseModel):
    """创建/更新模型配置请求"""
    model_config = ConfigDict(protected_namespaces=())

    name: str = Field(..., description="配置名称", min_length=1, max_length=255)
    provider: str = Field(..., description="服务提供商：openai / openrouter / custom")
    base_url: str = Field(..., description="API 基础 URL")
    api_key: str = Field("", description="API 密钥")
    model_name: str = Field(..., description="模型名称")
    is_default: bool = Field(False, description="是否设为默认配置")


class ModelConfigResponse(BaseModel):
    """模型配置响应（API Key 脱敏）"""
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: int
    name: str
    provider: str
    base_url: str
    api_key_masked: str = Field("", description="脱敏后的 API Key")
    model_name: str
    is_default: bool
    created_at: datetime


class ModelConfigTestRequest(BaseModel):
    """测试模型连接请求（可选覆盖配置）"""
    message: str = Field("Hello, this is a test message.", description="测试消息")


# ==================== Agent 相关模型 ====================

class AgentRequest(BaseModel):
    """Agent 对话请求"""
    model_config = ConfigDict(protected_namespaces=())

    message: str = Field(..., description="用户消息", min_length=1)
    conversation_id: Optional[int] = Field(None, description="对话 ID")
    model_config_id: Optional[int] = Field(None, description="模型配置 ID")
    tools: list[str] = Field(default_factory=list, description="启用的工具名称列表")
    stream: bool = Field(True, description="是否使用流式响应")


class AgentResponse(BaseModel):
    """Agent 对话响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: int
    role: str
    content: str
    tool_calls: Optional[list[dict]] = None
    created_at: datetime


class AgentToolResponse(BaseModel):
    """Agent 工具响应"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str
    parameters: dict = Field(default_factory=dict)


# ==================== 多模态相关模型 ====================

class MultimodalRequest(BaseModel):
    """多模态请求"""
    model_config = ConfigDict(protected_namespaces=())

    message: str = Field(..., description="用户消息", min_length=1)
    image: Optional[str] = Field(None, description="图片 base64 编码数据")
    conversation_id: Optional[int] = Field(None, description="对话 ID")
    model_config_id: Optional[int] = Field(None, description="模型配置 ID")


class SpeechToTextRequest(BaseModel):
    """语音转文字请求"""
    audio: str = Field(..., description="音频 base64 编码数据")
    language: str = Field("zh", description="语言代码")


class TextToSpeechRequest(BaseModel):
    """文字转语音请求"""
    model_config = ConfigDict(protected_namespaces=())

    text: str = Field(..., description="要转换的文本", min_length=1)
    voice: str = Field("alloy", description="语音类型")
    model_config_id: Optional[int] = Field(None, description="模型配置 ID")


# ==================== 通用响应模型 ====================

class SuccessResponse(BaseModel):
    """通用成功响应"""
    message: str
    data: Optional[dict] = None


class ErrorResponse(BaseModel):
    """通用错误响应"""
    detail: str
