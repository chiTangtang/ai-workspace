"""
多模态 API 路由
提供图片理解、语音转文字、文字转语音等功能
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db, ModelConfig
from app.models.schemas import (
    MultimodalRequest,
    SpeechToTextRequest,
    TextToSpeechRequest,
)
from app.services.multimodal_service import multimodal_service

router = APIRouter(prefix="/api/multimodal", tags=["多模态"])


def _get_model_config(db: Session, model_config_id: int = None) -> dict:
    """
    获取模型配置
    """
    if model_config_id:
        config = db.query(ModelConfig).filter(ModelConfig.id == model_config_id).first()
        if not config:
            raise HTTPException(status_code=404, detail=f"模型配置 {model_config_id} 不存在")
    else:
        config = db.query(ModelConfig).filter(ModelConfig.is_default == True).first()
        if not config:
            config = db.query(ModelConfig).first()
        if not config:
            raise HTTPException(status_code=400, detail="没有可用的模型配置，请先添加模型配置")

    return {
        "base_url": config.base_url,
        "api_key": config.api_key,
        "model_name": config.model_name,
        "provider": config.provider,
    }


@router.post("/image")
async def analyze_image(request: MultimodalRequest, db: Session = Depends(get_db)):
    """
    图片理解
    发送图片和问题，获取 AI 对图片的分析结果
    - message: 关于图片的问题或描述
    - image: 图片的 base64 编码
    - model_config_id: 模型配置 ID（可选）
    """
    if not request.image:
        raise HTTPException(status_code=400, detail="请提供图片数据（base64 编码）")

    try:
        model_config = _get_model_config(db, request.model_config_id)

        # 使用流式响应
        async def stream_generator():
            async for chunk in multimodal_service.analyze_image_stream(
                message=request.message,
                image_base64=request.image,
                model_config=model_config,
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"图片分析失败: {str(e)}")


@router.post("/speech-to-text")
async def speech_to_text(request: SpeechToTextRequest):
    """
    语音转文字
    发送音频数据，获取文字转写结果
    - audio: 音频的 base64 编码
    - language: 语言代码（默认 zh）
    """
    if not request.audio:
        raise HTTPException(status_code=400, detail="请提供音频数据（base64 编码）")

    try:
        result = await multimodal_service.speech_to_text(
            audio_base64=request.audio,
            language=request.language,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"语音转文字失败: {str(e)}")


@router.post("/text-to-speech")
async def text_to_speech(
    request: TextToSpeechRequest,
    db: Session = Depends(get_db),
):
    """
    文字转语音
    发送文本，获取语音合成结果
    - text: 要转换的文本
    - voice: 语音类型（默认 alloy）
    - model_config_id: 模型配置 ID（可选）
    """
    if not request.text:
        raise HTTPException(status_code=400, detail="请提供要转换的文本")

    try:
        model_config = _get_model_config(db, request.model_config_id)
        result = await multimodal_service.text_to_speech(
            text=request.text,
            model_config=model_config,
            voice=request.voice,
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文字转语音失败: {str(e)}")
