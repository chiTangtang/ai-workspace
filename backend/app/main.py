"""
FastAPI 应用入口
AI 智能工作助手后端服务
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.core.database import init_db, SessionLocal, ModelConfig
from app.api import chat, documents, knowledge, agent, models_config, multimodal


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    应用生命周期管理
    启动时初始化数据库和默认配置
    """
    # 初始化数据库（创建所有表）
    init_db()
    print("[启动] 数据库初始化完成")

    # 检查是否已有模型配置，如果没有则添加示例配置
    db = SessionLocal()
    try:
        config_count = db.query(ModelConfig).count()
        if config_count == 0:
            default_config = ModelConfig(
                name="GPT-3.5-Turbo（示例配置）",
                provider="openai",
                base_url=settings.DEFAULT_LLM_BASE_URL,
                api_key=settings.DEFAULT_LLM_API_KEY,
                model_name=settings.DEFAULT_LLM_MODEL_NAME,
                is_default=True,
                is_embedding_default=False,
            )
            db.add(default_config)
            db.commit()
            print("[启动] 已添加默认模型配置（示例），请通过 API 更新 API Key 后使用")
        else:
            print(f"[启动] 已加载 {config_count} 个模型配置")
    finally:
        db.close()

    print(f"[启动] {settings.APP_NAME} v{settings.APP_VERSION} 启动成功！")
    yield
    # 清理资源
    print("[关闭] 应用正在关闭...")


# 创建 FastAPI 应用
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI 智能工作助手后端服务，支持多模型对话、RAG 知识库、Agent 智能体和多模态功能",
    lifespan=lifespan,
)

# 添加 CORS 中间件（允许所有来源，方便开发）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(chat.router)
app.include_router(documents.router)
app.include_router(knowledge.router)
app.include_router(agent.router)
app.include_router(models_config.router)
app.include_router(multimodal.router)


@app.get("/")
async def root():
    """根路径，返回应用基本信息"""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
    }


@app.get("/api/health")
async def health_check():
    """健康检查接口"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
    )
