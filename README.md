# AI Workspace - 智能工作助手

一个完整的 AI 智能应用开发学习项目，涵盖对话、RAG、知识库、Agent、多模态等核心能力。

## 🌟 功能特性

### Phase 1: AI 对话助手
- ✅ 多轮对话，上下文管理（保留最近 20 条消息）
- ✅ 流式输出（SSE），打字机效果
- ✅ 多模型支持，可在设置页面配置

### Phase 2: 文档智能问答（RAG）
- ✅ 文档上传与解析（PDF / Word / TXT / Markdown）
- ✅ 智能文本分块（带重叠）
- ✅ 向量化存储与相似度检索
- ✅ 检索增强生成（RAG）

### Phase 3: 知识库管理
- ✅ 多知识库创建与管理
- ✅ 文档上传、列表、删除
- ✅ 基于知识库的智能问答

### Phase 4: Agent 智能体
- ✅ Function Calling 工具调用
- ✅ ReAct 推理循环（思考 → 行动 → 观察）
- ✅ 内置工具：网络搜索、计算器、日期时间、代码执行
- ✅ 工具调用过程可视化

### Phase 5: 多模态能力
- ✅ 图片理解（Vision API）
- ✅ 语音转文字（STT）
- ✅ 文字转语音（TTS）

### Phase 6: Web 前端
- ✅ Next.js + TypeScript + Tailwind CSS
- ✅ 深色/亮色主题切换
- ✅ 响应式设计
- ✅ Markdown 渲染 + 代码高亮
- ✅ 流式消息实时显示

### Phase 7: 系统设置
- ✅ 多模型 API 配置管理
- ✅ 支持 OpenAI / OpenRouter / 自定义 API
- ✅ 模型连接测试
- ✅ API Key 安全脱敏

## 🛠️ 技术栈

### 后端
- **框架**: Python + FastAPI
- **数据库**: SQLite (SQLAlchemy ORM)
- **向量数据库**: ChromaDB
- **HTTP 客户端**: httpx（支持所有 OpenAI 兼容 API）
- **文档解析**: PyPDF2, python-docx

### 前端
- **框架**: Next.js 14 (App Router) + TypeScript
- **样式**: Tailwind CSS
- **Markdown**: react-markdown + remark-gfm
- **代码高亮**: react-syntax-highlighter

## 📁 项目结构

```
ai-workspace/
├── backend/                    # Python 后端
│   ├── app/
│   │   ├── main.py            # FastAPI 入口
│   │   ├── config.py          # 配置管理
│   │   ├── api/               # API 路由
│   │   │   ├── chat.py        # 对话 API
│   │   │   ├── documents.py   # 文档管理 API
│   │   │   ├── knowledge.py   # 知识库 API
│   │   │   ├── agent.py       # Agent API
│   │   │   ├── models_config.py  # 模型配置 API
│   │   │   └── multimodal.py  # 多模态 API
│   │   ├── core/              # 核心模块
│   │   │   ├── database.py    # 数据库
│   │   │   └── vector_store.py # 向量数据库
│   │   ├── models/            # 数据模型
│   │   │   └── schemas.py     # Pydantic 模型
│   │   ├── services/          # 业务逻辑
│   │   │   ├── llm_service.py     # LLM 服务
│   │   │   ├── chat_service.py    # 对话服务
│   │   │   ├── rag_service.py     # RAG 服务
│   │   │   ├── agent_service.py   # Agent 服务
│   │   │   ├── embedding_service.py  # Embedding
│   │   │   └── multimodal_service.py # 多模态
│   │   └── utils/             # 工具函数
│   │       ├── document_parser.py  # 文档解析
│   │       └── text_splitter.py    # 文本分块
│   ├── data/                  # 数据目录
│   └── requirements.txt
├── frontend/                   # Next.js 前端
│   ├── src/
│   │   ├── app/               # 页面路由
│   │   │   ├── chat/          # 对话页面
│   │   │   ├── knowledge/     # 知识库页面
│   │   │   ├── agent/         # Agent 页面
│   │   │   └── settings/      # 设置页面
│   │   ├── components/        # UI 组件
│   │   ├── lib/               # 工具库
│   │   └── types/             # TypeScript 类型
│   └── package.json
├── start.sh                    # 一键启动脚本
└── README.md
```

## 🚀 快速开始

### 环境要求
- Python 3.8+
- Node.js 18+
- npm

### 一键启动

```bash
# 给启动脚本添加执行权限
chmod +x start.sh

# 启动项目
./start.sh
```

### 手动启动

```bash
# 1. 启动后端
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 2. 启动前端（新终端）
cd frontend
npm install
npm run dev
```

### 访问地址
- 📱 **前端界面**: http://localhost:3000
- 🔧 **后端 API**: http://localhost:8000
- 📖 **API 文档**: http://localhost:8000/docs

## ⚙️ 配置模型

1. 打开前端页面 http://localhost:3000
2. 进入「设置」页面
3. 点击「添加模型配置」
4. 填写配置信息：

### OpenAI 配置示例
- Provider: `openai`
- Base URL: `https://api.openai.com/v1`
- API Key: `sk-...`（你的 OpenAI API Key）
- 模型名称: `gpt-3.5-turbo`

### OpenRouter 配置示例
- Provider: `openrouter`
- Base URL: `https://openrouter.ai/api/v1`
- API Key: `sk-or-...`（你的 OpenRouter API Key）
- 模型名称: `openai/gpt-3.5-turbo`

### DeepSeek 配置示例
- Provider: `custom`
- Base URL: `https://api.deepseek.com/v1`
- API Key: `sk-...`（你的 DeepSeek API Key）
- 模型名称: `deepseek-chat`

### 智谱 GLM 配置示例
- Provider: `custom`
- Base URL: `https://open.bigmodel.cn/api/paas/v4`
- API Key: `...`（你的智谱 API Key）
- 模型名称: `glm-4`

## 📚 学习指南

本项目按照 AI 应用开发的核心知识体系设计，建议按以下顺序学习：

1. **后端入门** → 阅读 `backend/app/services/llm_service.py`，理解 LLM API 调用
2. **对话系统** → 阅读 `backend/app/services/chat_service.py`，学习上下文管理
3. **RAG 系统** → 阅读 `backend/app/services/rag_service.py`，理解检索增强生成
4. **Agent 系统** → 阅读 `backend/app/services/agent_service.py`，学习智能体设计
5. **前端开发** → 阅读 `frontend/src/lib/api.ts`，理解流式数据处理

## 📄 License

MIT
