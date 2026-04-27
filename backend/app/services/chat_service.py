"""
对话服务模块
管理对话的创建、消息发送、上下文维护等功能
"""
from datetime import datetime, timezone
from typing import AsyncGenerator, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import Conversation, Message, ModelConfig
from app.services.llm_service import llm_service
from app.config import settings


class ChatService:
    """对话服务类"""

    def __init__(self):
        """初始化对话服务"""
        self.max_context_messages = settings.MAX_CONTEXT_MESSAGES

    def create_conversation(self, db: Session) -> Conversation:
        """
        创建新对话
        :param db: 数据库会话
        :return: 新创建的对话对象
        """
        conversation = Conversation(title="新对话")
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        return conversation

    def get_conversations(self, db: Session) -> list[dict]:
        """
        获取所有对话列表（按更新时间倒序）
        :param db: 数据库会话
        :return: 对话列表
        """
        conversations = db.query(Conversation).order_by(desc(Conversation.updated_at)).all()
        result = []
        for conv in conversations:
            message_count = db.query(Message).filter(Message.conversation_id == conv.id).count()
            result.append({
                "id": conv.id,
                "title": conv.title,
                "created_at": conv.created_at,
                "updated_at": conv.updated_at,
                "message_count": message_count,
            })
        return result

    def get_conversation_messages(self, db: Session, conversation_id: int) -> list[dict]:
        """
        获取对话的所有消息
        :param db: 数据库会话
        :param conversation_id: 对话 ID
        :return: 消息列表
        """
        conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if not conversation:
            raise ValueError(f"对话 {conversation_id} 不存在")

        messages = (
            db.query(Message)
            .filter(Message.conversation_id == conversation_id)
            .order_by(Message.created_at)
            .all()
        )
        return [
            {
                "id": msg.id,
                "conversation_id": msg.conversation_id,
                "role": msg.role,
                "content": msg.content,
                "created_at": msg.created_at,
            }
            for msg in messages
        ]

    def delete_conversation(self, db: Session, conversation_id: int) -> bool:
        """
        删除对话及其所有消息
        :param db: 数据库会话
        :param conversation_id: 对话 ID
        :return: 是否删除成功
        """
        conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if not conversation:
            raise ValueError(f"对话 {conversation_id} 不存在")

        db.delete(conversation)
        db.commit()
        return True

    def _get_model_config(self, db: Session, model_config_id: Optional[int]) -> dict:
        """
        获取模型配置
        :param db: 数据库会话
        :param model_config_id: 模型配置 ID（可选）
        :return: 模型配置字典
        """
        if model_config_id:
            config = db.query(ModelConfig).filter(ModelConfig.id == model_config_id).first()
            if not config:
                raise ValueError(f"模型配置 {model_config_id} 不存在")
        else:
            # 使用默认配置
            config = db.query(ModelConfig).filter(ModelConfig.is_default == True).first()
            if not config:
                # 如果没有默认配置，使用第一个可用配置
                config = db.query(ModelConfig).first()
            if not config:
                raise ValueError("没有可用的模型配置，请先添加模型配置")

        return {
            "base_url": config.base_url,
            "api_key": config.api_key,
            "model_name": config.model_name,
            "provider": config.provider,
        }

    def _build_context_messages(
        self, db: Session, conversation_id: int, new_message: str
    ) -> list[dict]:
        """
        构建上下文消息列表（包含历史消息）
        :param db: 数据库会话
        :param conversation_id: 对话 ID
        :param new_message: 新消息内容
        :return: 消息列表
        """
        # 获取最近的消息作为上下文
        messages = (
            db.query(Message)
            .filter(Message.conversation_id == conversation_id)
            .order_by(desc(Message.created_at))
            .limit(self.max_context_messages)
            .all()
        )

        # 按时间正序排列
        messages.reverse()

        # 构建消息列表
        context = [{"role": msg.role, "content": msg.content} for msg in messages]
        # 添加新的用户消息
        context.append({"role": "user", "content": new_message})

        return context

    def _update_conversation_title(self, db: Session, conversation_id: int, title: str) -> None:
        """
        更新对话标题
        :param db: 数据库会话
        :param conversation_id: 对话 ID
        :param title: 新标题
        """
        conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if conversation and conversation.title == "新对话":
            # 使用第一条用户消息的前 20 个字符作为标题
            conversation.title = title[:20] + ("..." if len(title) > 20 else "")
            db.commit()

    async def send_message(
        self,
        db: Session,
        message: str,
        conversation_id: Optional[int],
        model_config_id: Optional[int],
        stream: bool = True,
    ) -> tuple[int, AsyncGenerator[str, None] | str]:
        """
        发送消息并获取回复
        :param db: 数据库会话
        :param message: 用户消息
        :param conversation_id: 对话 ID（可选，不传则创建新对话）
        :param model_config_id: 模型配置 ID（可选）
        :param stream: 是否流式响应
        :return: (对话 ID, 回复内容或流式生成器)
        """
        # 获取模型配置
        model_config = self._get_model_config(db, model_config_id)

        # 如果没有对话 ID，创建新对话
        if conversation_id is None:
            conversation = self.create_conversation(db)
            conversation_id = conversation.id
        else:
            # 验证对话是否存在
            conversation = db.query(Conversation).filter(
                Conversation.id == conversation_id
            ).first()
            if not conversation:
                raise ValueError(f"对话 {conversation_id} 不存在")

        # 保存用户消息
        user_msg = Message(
            conversation_id=conversation_id,
            role="user",
            content=message,
        )
        db.add(user_msg)
        db.commit()

        # 更新对话标题（如果是新对话的第一条消息）
        self._update_conversation_title(db, conversation_id, message)

        # 构建上下文
        context_messages = self._build_context_messages(db, conversation_id, message)

        if stream:
            # 流式响应
            async def stream_generator():
                full_content = ""
                async for chunk in llm_service.chat_stream(
                    messages=context_messages,
                    model_config=model_config,
                ):
                    full_content += chunk
                    yield chunk

                # 保存助手回复到数据库
                # 从 SSE 格式中提取纯文本内容
                assistant_content = self._extract_content_from_sse(full_content)
                assistant_msg = Message(
                    conversation_id=conversation_id,
                    role="assistant",
                    content=assistant_content,
                )
                db.add(assistant_msg)
                db.commit()

            return conversation_id, stream_generator()
        else:
            # 非流式响应
            response = await llm_service.chat(
                messages=context_messages,
                model_config=model_config,
            )

            # 保存助手回复
            assistant_msg = Message(
                conversation_id=conversation_id,
                role="assistant",
                content=response,
            )
            db.add(assistant_msg)
            db.commit()

            return conversation_id, response

    @staticmethod
    def _extract_content_from_sse(sse_text: str) -> str:
        """
        从 SSE 格式的文本中提取纯内容
        :param sse_text: SSE 格式文本
        :return: 纯文本内容
        """
        import json
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


# 全局对话服务实例
chat_service = ChatService()
