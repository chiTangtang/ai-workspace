"""
Agent API 路由
提供 Agent 智能体对话和工具列表查询功能
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.schemas import AgentRequest, AgentToolResponse
from app.services.agent_service import agent_service

router = APIRouter(prefix="/api/agent", tags=["Agent 智能体"])


@router.post("/chat")
async def agent_chat(request: AgentRequest, db: Session = Depends(get_db)):
    """
    Agent 对话（支持流式）
    Agent 可以使用工具来帮助回答问题，支持 ReAct 循环
    - message: 用户消息
    - conversation_id: 对话 ID（可选）
    - model_config_id: 模型配置 ID（可选）
    - tools: 启用的工具名称列表（可选，不传则启用所有工具）
    - stream: 是否使用流式响应（默认 true）
    """
    try:
        conversation_id, response = await agent_service.run(
            db=db,
            message=request.message,
            conversation_id=request.conversation_id,
            model_config_id=request.model_config_id,
            enabled_tools=request.tools if request.tools else None,
            stream=request.stream,
        )

        if request.stream:
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
            return {
                "conversation_id": conversation_id,
                "role": "assistant",
                "content": response,
            }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent 服务错误: {str(e)}")


@router.get("/tools", response_model=list[AgentToolResponse])
async def get_agent_tools():
    """
    获取 Agent 可用的工具列表
    """
    tools = agent_service.get_available_tools()
    return [
        AgentToolResponse(
            id=tool["name"],
            name=tool["name"],
            description=tool["description"],
            parameters=tool["parameters"],
        )
        for tool in tools
    ]
