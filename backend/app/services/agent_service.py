"""
Agent 智能体服务模块
实现 ReAct（Reasoning + Acting）循环，支持工具调用
"""
import json
import asyncio
import subprocess
import re
from datetime import datetime
from typing import Optional, AsyncGenerator
from sqlalchemy.orm import Session

from app.core.database import Conversation, Message, ModelConfig
from app.services.llm_service import llm_service
from app.config import settings


class AgentService:
    """Agent 智能体服务类"""

    def __init__(self):
        """初始化 Agent 服务"""
        self.max_rounds = settings.AGENT_MAX_TOOL_ROUNDS
        self.code_timeout = settings.CODE_EXECUTION_TIMEOUT

        # 内置工具定义
        self.tools = self._define_tools()

    def _define_tools(self) -> list[dict]:
        """
        定义 Agent 可用的工具
        :return: 工具定义列表（OpenAI Function Calling 格式）
        """
        return [
            {
                "type": "function",
                "function": {
                    "name": "web_search",
                    "description": "搜索互联网上的信息。当你需要查找最新信息、事实数据或用户提供的上下文中没有的知识时使用此工具。",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "搜索查询关键词",
                            },
                        },
                        "required": ["query"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "calculator",
                    "description": "执行数学计算。当你需要计算数学表达式、进行数值运算时使用此工具。",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "expression": {
                                "type": "string",
                                "description": "要计算的数学表达式，例如 '2 + 3 * 4' 或 'sqrt(16)'",
                            },
                        },
                        "required": ["expression"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "get_datetime",
                    "description": "获取当前的日期和时间信息。当你需要知道当前时间、日期或进行时间相关的计算时使用此工具。",
                    "parameters": {
                        "type": "object",
                        "properties": {},
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "code_executor",
                    "description": "执行 Python 代码。当你需要运行代码来获取结果、处理数据或验证计算时使用此工具。代码将在安全的沙箱环境中执行。",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "code": {
                                "type": "string",
                                "description": "要执行的 Python 代码",
                            },
                        },
                        "required": ["code"],
                    },
                },
            },
        ]

    def get_available_tools(self) -> list[dict]:
        """
        获取可用工具列表
        :return: 工具信息列表
        """
        return [
            {
                "name": tool["function"]["name"],
                "description": tool["function"]["description"],
                "parameters": tool["function"]["parameters"],
            }
            for tool in self.tools
        ]

    async def _execute_tool(self, tool_name: str, arguments: dict) -> str:
        """
        执行指定的工具
        :param tool_name: 工具名称
        :param arguments: 工具参数
        :return: 工具执行结果
        """
        if tool_name == "web_search":
            return await self._tool_web_search(arguments.get("query", ""))
        elif tool_name == "calculator":
            return self._tool_calculator(arguments.get("expression", ""))
        elif tool_name == "get_datetime":
            return self._tool_get_datetime()
        elif tool_name == "code_executor":
            return await self._tool_code_executor(arguments.get("code", ""))
        else:
            return f"未知工具: {tool_name}"

    @staticmethod
    async def _tool_web_search(query: str) -> str:
        """
        网络搜索工具（模拟实现）
        :param query: 搜索查询
        :return: 搜索结果
        """
        # 模拟搜索结果
        return (
            f"[网络搜索] 查询: {query}\n"
            f"注意：当前为模拟搜索结果。如需真实搜索功能，请集成搜索 API（如 SerpAPI、Bing Search API 等）。\n"
            f"建议的搜索结果：\n"
            f"1. 关于 '{query}' 的信息，建议访问相关官方网站获取最新数据。\n"
            f"2. 可以通过搜索引擎（如 Google、Bing）获取更详细的结果。"
        )

    @staticmethod
    def _tool_calculator(expression: str) -> str:
        """
        数学计算工具
        :param expression: 数学表达式
        :return: 计算结果
        """
        # 安全检查：只允许数字、运算符和常用数学函数
        allowed_pattern = r'^[\d\s+\-*/().%sqrt,pow,abs,min,max,round,ceil,floor,sin,cos,tan,log,pi,e,]+$'
        # 简化安全检查
        dangerous_patterns = [
            "import", "exec", "eval", "open", "file", "__", "class",
            "os.", "sys.", "subprocess", "shutil", "pathlib",
        ]

        for pattern in dangerous_patterns:
            if pattern in expression.lower():
                return f"错误：表达式中包含不允许的操作: {pattern}"

        try:
            # 安全的数学计算环境
            safe_dict = {
                "sqrt": __import__("math").sqrt,
                "pow": pow,
                "abs": abs,
                "min": min,
                "max": max,
                "round": round,
                "ceil": __import__("math").ceil,
                "floor": __import__("math").floor,
                "sin": __import__("math").sin,
                "cos": __import__("math").cos,
                "tan": __import__("math").tan,
                "log": __import__("math").log,
                "pi": __import__("math").pi,
                "e": __import__("math").e,
            }
            result = eval(expression, {"__builtins__": {}}, safe_dict)  # noqa: S307
            return f"计算结果: {expression} = {result}"
        except ZeroDivisionError:
            return "错误：除以零"
        except Exception as ex:
            return f"计算错误: {str(ex)}"

    @staticmethod
    def _tool_get_datetime() -> str:
        """
        获取当前日期时间
        :return: 当前日期时间字符串
        """
        now = datetime.now()
        return (
            f"当前日期时间信息：\n"
            f"- 日期: {now.strftime('%Y年%m月%d日')}\n"
            f"- 时间: {now.strftime('%H:%M:%S')}\n"
            f"- 星期: {['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'][now.weekday()]}\n"
            f"- 时间戳: {now.timestamp()}"
        )

    async def _tool_code_executor(self, code: str) -> str:
        """
        执行 Python 代码
        :param code: Python 代码
        :return: 执行结果
        """
        # 安全检查
        dangerous_patterns = [
            "import os", "import sys", "import subprocess", "import shutil",
            "__import__", "exec", "eval", "compile", "open(",
            "socket", "requests", "urllib", "http",
        ]
        for pattern in dangerous_patterns:
            if pattern in code:
                return f"错误：代码中包含不允许的操作: {pattern}。出于安全考虑，不允许执行系统级操作。"

        try:
            # 使用 subprocess 在子进程中执行代码
            process = await asyncio.create_subprocess_exec(
                "python3", "-c", code,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=self.code_timeout,
            )

            output = ""
            if stdout:
                output += stdout.decode("utf-8", errors="replace")
            if stderr:
                output += f"\n错误输出:\n{stderr.decode('utf-8', errors='replace')}"

            if not output.strip():
                output = "代码执行成功，无输出。"

            return output.strip()
        except asyncio.TimeoutError:
            return f"错误：代码执行超时（超过 {self.code_timeout} 秒）"
        except Exception as ex:
            return f"执行错误: {str(ex)}"

    def _get_model_config(self, db: Session, model_config_id: Optional[int]) -> dict:
        """
        获取模型配置
        :param db: 数据库会话
        :param model_config_id: 模型配置 ID
        :return: 模型配置字典
        """
        if model_config_id:
            config = db.query(ModelConfig).filter(ModelConfig.id == model_config_id).first()
            if not config:
                raise ValueError(f"模型配置 {model_config_id} 不存在")
        else:
            config = db.query(ModelConfig).filter(ModelConfig.is_default == True).first()
            if not config:
                config = db.query(ModelConfig).first()
            if not config:
                raise ValueError("没有可用的模型配置，请先添加模型配置")

        return {
            "base_url": config.base_url,
            "api_key": config.api_key,
            "model_name": config.model_name,
            "provider": config.provider,
        }

    async def run(
        self,
        db: Session,
        message: str,
        conversation_id: Optional[int],
        model_config_id: Optional[int],
        enabled_tools: Optional[list[str]] = None,
        stream: bool = True,
    ) -> tuple[int, AsyncGenerator | str]:
        """
        运行 Agent（ReAct 循环）
        :param db: 数据库会话
        :param message: 用户消息
        :param conversation_id: 对话 ID
        :param model_config_id: 模型配置 ID
        :param enabled_tools: 启用的工具名称列表
        :param stream: 是否流式响应
        :return: (对话 ID, 回复内容或流式生成器)
        """
        # 获取模型配置
        model_config = self._get_model_config(db, model_config_id)

        # 筛选启用的工具
        if enabled_tools:
            active_tools = [t for t in self.tools if t["function"]["name"] in enabled_tools]
        else:
            active_tools = self.tools

        # 如果没有对话 ID，创建新对话
        if conversation_id is None:
            conversation = Conversation(title=f"Agent: {message[:20]}")
            db.add(conversation)
            db.commit()
            db.refresh(conversation)
            conversation_id = conversation.id
        else:
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

        if stream:
            # 流式 ReAct 循环
            async def stream_generator():
                messages = [{"role": "user", "content": message}]

                # 添加系统提示词
                system_prompt = {
                    "role": "system",
                    "content": (
                        "你是一个智能 AI 助手，可以使用工具来帮助用户解决问题。"
                        "你可以使用提供的工具来搜索信息、进行计算、获取时间或执行代码。"
                        "请根据用户的需求，合理选择和使用工具。"
                        "在回答时，请清晰地说明你的思考过程和使用的工具。"
                    ),
                }
                messages.insert(0, system_prompt)

                full_content = ""
                tool_call_count = 0

                for _ in range(self.max_rounds):
                    # 调用 LLM（带工具）
                    result = await llm_service.chat_with_tools(
                        messages=messages,
                        tools=active_tools if active_tools else None,
                        model_config=model_config,
                    )

                    content = result.get("content", "")
                    tool_calls = result.get("tool_calls")

                    if content:
                        full_content += content
                        chunk_data = json.dumps({"content": content}, ensure_ascii=False)
                        yield f"data: {chunk_data}\n\n"

                    # 如果没有工具调用，结束循环
                    if not tool_calls:
                        break

                    # 执行工具调用
                    for tool_call in tool_calls:
                        tool_call_count += 1
                        func = tool_call.get("function", {})
                        tool_name = func.get("name", "")
                        try:
                            arguments = json.loads(func.get("arguments", "{}"))
                        except json.JSONDecodeError:
                            arguments = {}

                        # 发送工具调用信息
                        tool_info = json.dumps(
                            {"tool_call": {"name": tool_name, "arguments": arguments}},
                            ensure_ascii=False,
                        )
                        yield f"data: {tool_info}\n\n"

                        # 执行工具
                        tool_result = await self._execute_tool(tool_name, arguments)

                        # 发送工具结果
                        result_info = json.dumps(
                            {"tool_result": {"name": tool_name, "result": tool_result}},
                            ensure_ascii=False,
                        )
                        yield f"data: {result_info}\n\n"

                        # 将工具调用和结果添加到消息历史
                        messages.append(tool_call)
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call.get("id", ""),
                            "content": tool_result,
                        })

                yield "data: [DONE]\n\n"

                # 保存助手回复
                assistant_msg = Message(
                    conversation_id=conversation_id,
                    role="assistant",
                    content=full_content if full_content else "（Agent 未生成回复）",
                )
                db.add(assistant_msg)
                db.commit()

            return conversation_id, stream_generator()
        else:
            # 非流式 ReAct 循环
            messages = [
                {
                    "role": "system",
                    "content": (
                        "你是一个智能 AI 助手，可以使用工具来帮助用户解决问题。"
                        "请根据用户的需求，合理选择和使用工具。"
                    ),
                },
                {"role": "user", "content": message},
            ]

            full_content = ""

            for _ in range(self.max_rounds):
                result = await llm_service.chat_with_tools(
                    messages=messages,
                    tools=active_tools if active_tools else None,
                    model_config=model_config,
                )

                content = result.get("content", "")
                tool_calls = result.get("tool_calls")

                if content:
                    full_content += content

                if not tool_calls:
                    break

                for tool_call in tool_calls:
                    func = tool_call.get("function", {})
                    tool_name = func.get("name", "")
                    try:
                        arguments = json.loads(func.get("arguments", "{}"))
                    except json.JSONDecodeError:
                        arguments = {}

                    tool_result = await self._execute_tool(tool_name, arguments)

                    messages.append(tool_call)
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.get("id", ""),
                        "content": tool_result,
                    })

            # 保存助手回复
            assistant_msg = Message(
                conversation_id=conversation_id,
                role="assistant",
                content=full_content if full_content else "（Agent 未生成回复）",
            )
            db.add(assistant_msg)
            db.commit()

            return conversation_id, full_content


# 全局 Agent 服务实例
agent_service = AgentService()
