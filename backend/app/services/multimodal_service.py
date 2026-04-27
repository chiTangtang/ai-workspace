"""
多模态服务模块
支持图片理解、语音转文字、文字转语音等功能
"""
import json
import base64
from typing import Optional
from sqlalchemy.orm import Session

from app.core.database import ModelConfig
from app.services.llm_service import llm_service


class MultimodalService:
    """多模态服务类"""

    async def analyze_image(
        self,
        message: str,
        image_base64: str,
        model_config: dict,
    ) -> str:
        """
        图片理解（视觉问答）
        :param message: 用户的问题或描述
        :param image_base64: 图片的 base64 编码
        :param model_config: 模型配置
        :return: 模型的回复
        """
        # 构建 OpenAI Vision API 格式的消息
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": message,
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_base64}",
                        },
                    },
                ],
            }
        ]

        response = await llm_service.chat(
            messages=messages,
            model_config=model_config,
            max_tokens=2000,
        )

        return response

    async def analyze_image_stream(
        self,
        message: str,
        image_base64: str,
        model_config: dict,
    ):
        """
        图片理解（流式）
        :param message: 用户的问题或描述
        :param image_base64: 图片的 base64 编码
        :param model_config: 模型配置
        :yield: SSE 格式的数据块
        """
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": message,
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_base64}",
                        },
                    },
                ],
            }
        ]

        async for chunk in llm_service.chat_stream(
            messages=messages,
            model_config=model_config,
            max_tokens=2000,
        ):
            yield chunk

    async def speech_to_text(self, audio_base64: str, language: str = "zh") -> dict:
        """
        语音转文字（模拟实现）
        实际使用时需要集成 Whisper API 或其他语音识别服务
        :param audio_base64: 音频的 base64 编码
        :param language: 语言代码
        :return: 转写结果
        """
        return {
            "success": False,
            "message": (
                "语音转文字功能需要集成 Whisper API 或其他语音识别服务。\n"
                "支持的集成方案：\n"
                "1. OpenAI Whisper API: POST https://api.openai.com/v1/audio/transcriptions\n"
                "2. 本地部署 Whisper 模型\n"
                "3. 使用 Azure Speech Services\n"
                f"\n接收到的音频数据大小: {len(audio_base64)} 字符 (base64)\n"
                f"指定语言: {language}"
            ),
            "text": "",
        }

    async def text_to_speech(
        self,
        text: str,
        model_config: dict,
        voice: str = "alloy",
    ) -> dict:
        """
        文字转语音（模拟实现）
        实际使用时需要集成 TTS API
        :param text: 要转换的文本
        :param model_config: 模型配置
        :param voice: 语音类型
        :return: TTS 结果
        """
        return {
            "success": False,
            "message": (
                "文字转语音功能需要集成 TTS API。\n"
                "支持的集成方案：\n"
                "1. OpenAI TTS API: POST https://api.openai.com/v1/audio/speech\n"
                "2. Azure Cognitive Services Speech\n"
                "3. Google Cloud Text-to-Speech\n"
                f"\n文本内容: {text[:100]}{'...' if len(text) > 100 else ''}\n"
                f"指定语音: {voice}"
            ),
            "audio_base64": "",
        }


# 全局多模态服务实例
multimodal_service = MultimodalService()
