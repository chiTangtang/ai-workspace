"""
多模型 LLM 服务（核心模块）
支持 OpenAI、OpenRouter 及所有兼容 OpenAI API 格式的服务
使用 httpx 进行 HTTP 调用，不依赖 openai SDK
"""
import json
import httpx
from typing import AsyncGenerator, Optional


class LLMService:
    """大语言模型服务类"""

    def __init__(self):
        """初始化 LLM 服务"""
        self.timeout = 120.0  # 请求超时时间（秒）

    def _build_headers(self, api_key: str, provider: str = "openai") -> dict:
        """
        构建请求头
        :param api_key: API 密钥
        :param provider: 服务提供商类型
        :return: 请求头字典
        """
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        }

        # OpenRouter 需要额外的请求头
        if provider == "openrouter":
            headers["HTTP-Referer"] = "https://ai-workspace.local"
            headers["X-Title"] = "AI Workspace"

        return headers

    def _build_url(self, base_url: str) -> str:
        """
        构建完整的 API URL
        :param base_url: 基础 URL
        :return: 完整的 chat completions URL
        """
        # 去除末尾的斜杠
        base_url = base_url.rstrip("/")
        return f"{base_url}/chat/completions"

    async def chat(
        self,
        messages: list[dict],
        model_config: dict,
        stream: bool = False,
        tools: Optional[list[dict]] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> str:
        """
        发送对话请求（非流式）
        :param messages: 消息列表 [{"role": "user", "content": "..."}]
        :param model_config: 模型配置 {"base_url": "...", "api_key": "...", "model_name": "...", "provider": "..."}
        :param stream: 是否流式（此方法内部不使用，由 chat_stream 处理）
        :param tools: 可用的工具列表（Function Calling）
        :param temperature: 温度参数
        :param max_tokens: 最大生成 token 数
        :return: 模型回复的文本内容
        """
        url = self._build_url(model_config["base_url"])
        headers = self._build_headers(model_config["api_key"], model_config.get("provider", "openai"))

        payload = {
            "model": model_config["model_name"],
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }

        # 如果有工具定义，添加到请求中
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()

        # 提取回复内容
        choice = data["choices"][0]
        message = choice["message"]

        # 检查是否有工具调用
        if "tool_calls" in message:
            return json.dumps({
                "content": message.get("content", ""),
                "tool_calls": message["tool_calls"],
            }, ensure_ascii=False)

        return message.get("content", "")

    async def chat_stream(
        self,
        messages: list[dict],
        model_config: dict,
        tools: Optional[list[dict]] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> AsyncGenerator[str, None]:
        """
        发送对话请求（流式 SSE）
        :param messages: 消息列表
        :param model_config: 模型配置
        :param tools: 可用的工具列表
        :param temperature: 温度参数
        :param max_tokens: 最大生成 token 数
        :yield: SSE 格式的数据块
        """
        url = self._build_url(model_config["base_url"])
        headers = self._build_headers(model_config["api_key"], model_config.get("provider", "openai"))

        payload = {
            "model": model_config["model_name"],
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }

        # 如果有工具定义，添加到请求中
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as response:
                response.raise_for_status()

                async for line in response.aiter_lines():
                    line = line.strip()
                    if not line:
                        continue

                    # 处理 SSE 格式数据
                    if line.startswith("data: "):
                        data_str = line[6:]  # 去掉 "data: " 前缀

                        # 检查是否结束标记
                        if data_str == "[DONE]":
                            yield "data: [DONE]\n\n"
                            return

                        try:
                            data = json.loads(data_str)
                            choice = data["choices"][0]
                            delta = choice.get("delta", {})

                            content = delta.get("content", "")
                            if content:
                                # 返回 SSE 格式
                                chunk_data = json.dumps({"content": content}, ensure_ascii=False)
                                yield f"data: {chunk_data}\n\n"

                            # 处理流式工具调用
                            if "tool_calls" in delta:
                                tool_calls_data = json.dumps(
                                    {"tool_calls": delta["tool_calls"]},
                                    ensure_ascii=False,
                                )
                                yield f"data: {tool_calls_data}\n\n"

                        except json.JSONDecodeError:
                            # 忽略无法解析的行
                            continue

    async def chat_with_tools(
        self,
        messages: list[dict],
        tools: list[dict],
        model_config: dict,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> dict:
        """
        带 Function Calling 的对话
        :param messages: 消息列表
        :param tools: 工具定义列表
        :param model_config: 模型配置
        :param temperature: 温度参数
        :param max_tokens: 最大生成 token 数
        :return: 包含 content 和 tool_calls 的字典
        """
        result = await self.chat(
            messages=messages,
            model_config=model_config,
            tools=tools,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        try:
            parsed = json.loads(result)
            if "tool_calls" in parsed:
                return parsed
        except (json.JSONDecodeError, TypeError):
            pass

        return {"content": result, "tool_calls": None}

    async def chat_with_tools_stream(
        self,
        messages: list[dict],
        tools: list[dict],
        model_config: dict,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> AsyncGenerator[str, None]:
        """
        流式带工具调用的对话
        :param messages: 消息列表
        :param tools: 工具定义列表
        :param model_config: 模型配置
        :param temperature: 温度参数
        :param max_tokens: 最大生成 token 数
        :yield: SSE 格式的数据块
        """
        async for chunk in self.chat_stream(
            messages=messages,
            model_config=model_config,
            tools=tools,
            temperature=temperature,
            max_tokens=max_tokens,
        ):
            yield chunk

    async def test_connection(self, model_config: dict) -> dict:
        """
        测试模型连接是否正常
        :param model_config: 模型配置
        :return: 测试结果 {"success": True/False, "message": "..."}
        """
        try:
            messages = [{"role": "user", "content": "Hi, this is a test message. Reply with 'OK'."}]
            response = await self.chat(
                messages=messages,
                model_config=model_config,
                max_tokens=10,
            )
            return {
                "success": True,
                "message": f"连接成功，模型回复: {response[:100]}",
            }
        except httpx.TimeoutException:
            return {
                "success": False,
                "message": "连接超时，请检查网络和 API 地址是否正确",
            }
        except httpx.HTTPStatusError as e:
            return {
                "success": False,
                "message": f"HTTP 错误 {e.response.status_code}: {e.response.text[:200]}",
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"连接失败: {str(e)}",
            }


# 全局 LLM 服务实例
llm_service = LLMService()
