"""
对话 API 路由
提供对话创建、消息发送、消息获取等功能
"""
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.schemas import ChatRequest, ConversationResponse
from app.services.chat_service import chat_service

router = APIRouter(prefix="/api", tags=["对话"])


@router.post("/chat")
async def chat(request: ChatRequest, db: Session = Depends(get_db)):
    """
    发送消息（支持流式 SSE）
    - message: 用户消息内容
    - conversation_id: 对话 ID（可选，不传则创建新对话）
    - model_config_id: 模型配置 ID（可选）
    - stream: 是否使用流式响应（默认 true）
    """
    try:
        conversation_id, response = await chat_service.send_message(
            db=db,
            message=request.message,
            conversation_id=request.conversation_id,
            model_config_id=request.model_config_id,
            stream=request.stream,
        )

        if request.stream:
            # 流式响应
            return StreamingResponse(
                response,
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Conversation-Id": str(conversation_id),
                },
            )
        else:
            # 非流式响应
            return {
                "conversation_id": conversation_id,
                "role": "assistant",
                "content": response,
            }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"对话服务错误: {str(e)}")


@router.get("/conversations", response_model=list[ConversationResponse])
async def get_conversations(db: Session = Depends(get_db)):
    """
    获取所有对话列表（按更新时间倒序）
    """
    try:
        conversations = chat_service.get_conversations(db)
        return conversations
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取对话列表失败: {str(e)}")


@router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(conversation_id: int, db: Session = Depends(get_db)):
    """
    获取指定对话的所有消息
    """
    try:
        messages = chat_service.get_conversation_messages(db, conversation_id)
        return {
            "conversation_id": conversation_id,
            "messages": messages,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取消息失败: {str(e)}")


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: int, db: Session = Depends(get_db)):
    """
    删除对话及其所有消息
    """
    try:
        chat_service.delete_conversation(db, conversation_id)
        return {"message": f"对话 {conversation_id} 已删除"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除对话失败: {str(e)}")
