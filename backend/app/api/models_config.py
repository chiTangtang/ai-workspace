"""
模型配置 API 路由
提供模型配置的增删改查和连接测试功能
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db, ModelConfig
from app.models.schemas import ModelConfigCreate, ModelConfigResponse, ModelConfigTestRequest
from app.services.llm_service import llm_service

router = APIRouter(prefix="/api", tags=["模型配置"])


def _mask_api_key(api_key: str) -> str:
    """
    对 API Key 进行脱敏处理
    只显示前 4 位和后 4 位，中间用星号替代
    :param api_key: 原始 API Key
    :return: 脱敏后的 API Key
    """
    if not api_key:
        return ""
    if len(api_key) <= 8:
        return "****"
    return f"{api_key[:4]}{'*' * (len(api_key) - 8)}{api_key[-4:]}"


def _model_config_to_response(config: ModelConfig) -> dict:
    """
    将数据库模型转换为响应格式（API Key 脱敏）
    :param config: 数据库模型配置对象
    :return: 响应字典
    """
    return {
        "id": config.id,
        "name": config.name,
        "provider": config.provider,
        "base_url": config.base_url,
        "api_key_masked": _mask_api_key(config.api_key),
        "model_name": config.model_name,
        "is_default": config.is_default,
        "created_at": config.created_at,
    }


@router.post("/model-configs", response_model=ModelConfigResponse)
async def create_model_config(
    request: ModelConfigCreate,
    db: Session = Depends(get_db),
):
    """
    添加新的模型配置
    如果设置为默认配置，会自动取消其他配置的默认状态
    """
    try:
        # 如果设为默认，先取消其他默认配置
        if request.is_default:
            db.query(ModelConfig).filter(ModelConfig.is_default == True).update(
                {"is_default": False}
            )

        config = ModelConfig(
            name=request.name,
            provider=request.provider,
            base_url=request.base_url,
            api_key=request.api_key,
            model_name=request.model_name,
            is_default=request.is_default,
        )
        db.add(config)
        db.commit()
        db.refresh(config)

        return _model_config_to_response(config)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"创建模型配置失败: {str(e)}")


@router.get("/model-configs", response_model=list[ModelConfigResponse])
async def get_model_configs(db: Session = Depends(get_db)):
    """
    获取所有模型配置列表（API Key 已脱敏）
    """
    configs = db.query(ModelConfig).order_by(ModelConfig.created_at).all()
    return [_model_config_to_response(c) for c in configs]


@router.put("/model-configs/{config_id}", response_model=ModelConfigResponse)
async def update_model_config(
    config_id: int,
    request: ModelConfigCreate,
    db: Session = Depends(get_db),
):
    """
    更新模型配置
    """
    config = db.query(ModelConfig).filter(ModelConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail=f"模型配置 {config_id} 不存在")

    try:
        # 如果设为默认，先取消其他默认配置
        if request.is_default:
            db.query(ModelConfig).filter(
                ModelConfig.is_default == True,
                ModelConfig.id != config_id,
            ).update({"is_default": False})

        config.name = request.name
        config.provider = request.provider
        config.base_url = request.base_url
        config.api_key = request.api_key
        config.model_name = request.model_name
        config.is_default = request.is_default

        db.commit()
        db.refresh(config)

        return _model_config_to_response(config)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"更新模型配置失败: {str(e)}")


@router.delete("/model-configs/{config_id}")
async def delete_model_config(config_id: int, db: Session = Depends(get_db)):
    """
    删除模型配置
    """
    config = db.query(ModelConfig).filter(ModelConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail=f"模型配置 {config_id} 不存在")

    try:
        db.delete(config)
        db.commit()
        return {"message": f"模型配置 {config_id} 已删除"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"删除模型配置失败: {str(e)}")


@router.post("/model-configs/{config_id}/test")
async def test_model_config(
    config_id: int,
    db: Session = Depends(get_db),
):
    """
    测试模型连接是否正常
    发送一条测试消息验证 API 连接和模型可用性
    """
    config = db.query(ModelConfig).filter(ModelConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail=f"模型配置 {config_id} 不存在")

    model_config = {
        "base_url": config.base_url,
        "api_key": config.api_key,
        "model_name": config.model_name,
        "provider": config.provider,
    }

    result = await llm_service.test_connection(model_config)
    return result
