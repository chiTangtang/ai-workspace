'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Modal from '@/components/Modal';
import { ModelConfig, ModelConfigForm } from '@/types';
import {
  getModelConfigs,
  createModelConfig,
  updateModelConfig,
  deleteModelConfig,
  testModelConfig,
  testEmbeddingModelConfig,
} from '@/lib/api';

/** Provider 默认 Base URL 映射 */
const PROVIDER_DEFAULTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  custom: '',
};

/** 预设模型模板 - 方便用户快速填写 */
const MODEL_TEMPLATES = [
  {
    label: 'OpenAI GPT-4o',
    provider: 'openai',
    base_url: 'https://api.openai.com/v1',
    model_name: 'gpt-4o',
  },
  {
    label: 'OpenAI GPT-3.5',
    provider: 'openai',
    base_url: 'https://api.openai.com/v1',
    model_name: 'gpt-3.5-turbo',
  },
  {
    label: 'OpenRouter (通用)',
    provider: 'openrouter',
    base_url: 'https://openrouter.ai/api/v1',
    model_name: 'openai/gpt-3.5-turbo',
  },
  {
    label: 'OpenAI Embedding 3 Small',
    provider: 'openai',
    base_url: 'https://api.openai.com/v1',
    model_name: 'text-embedding-3-small',
  },
  {
    label: 'DeepSeek',
    provider: 'custom',
    base_url: 'https://api.deepseek.com/v1',
    model_name: 'deepseek-chat',
  },
  {
    label: '智谱 GLM-4',
    provider: 'custom',
    base_url: 'https://open.bigmodel.cn/api/paas/v4',
    model_name: 'glm-4',
  },
  {
    label: '通义千问',
    provider: 'custom',
    base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model_name: 'qwen-turbo',
  },
  {
    label: 'Moonshot (月之暗面)',
    provider: 'custom',
    base_url: 'https://api.moonshot.cn/v1',
    model_name: 'moonshot-v1-8k',
  },
  {
    label: '硅基流动 SiliconFlow',
    provider: 'custom',
    base_url: 'https://api.siliconflow.cn/v1',
    model_name: 'Qwen/Qwen2.5-7B-Instruct',
  },
];

/** 设置页面 */
export default function SettingsPage() {
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ModelConfig | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [embeddingTestingId, setEmbeddingTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    kind: 'chat' | 'embedding';
    success: boolean;
    message: string;
  } | null>(null);

  // 表单状态
  const [formData, setFormData] = useState<ModelConfigForm>({
    name: '',
    provider: 'openai',
    base_url: PROVIDER_DEFAULTS.openai,
    api_key: '',
    model_name: '',
    is_default: false,
    is_embedding_default: false,
  });

  const defaultChatModel = modelConfigs.find((config) => config.is_default);
  const defaultEmbeddingModel = modelConfigs.find((config) => config.is_embedding_default);
  const normalizedModelName = formData.model_name.trim().toLowerCase();
  const formLooksLikeEmbedding = ['embedding', 'bge', 'm3', 'gte', 'e5'].some((keyword) =>
    normalizedModelName.includes(keyword)
  );
  const formLooksLikeChat = ['gpt', 'chat', 'glm', 'qwen', 'deepseek', 'mimo', 'claude', 'kimi'].some((keyword) =>
    normalizedModelName.includes(keyword)
  );

  // 加载模型配置列表
  const loadConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getModelConfigs();
      setModelConfigs(Array.isArray(data) ? data : data.items || []);
    } catch {
      console.error('加载模型配置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const run = async () => {
      await loadConfigs();
    };
    void run();
  }, [loadConfigs]);

  // 打开新建表单
  const handleOpenCreate = () => {
    setEditingConfig(null);
    setFormData({
      name: '',
      provider: 'openai',
      base_url: PROVIDER_DEFAULTS.openai,
      api_key: '',
      model_name: '',
      is_default: false,
      is_embedding_default: false,
    });
    setShowFormModal(true);
  };

  // 打开编辑表单
  const handleOpenEdit = (config: ModelConfig) => {
    setEditingConfig(config);
    setFormData({
      name: config.name,
      provider: config.provider,
      base_url: config.base_url,
      api_key: '', // API Key 不回显
      model_name: config.model_name,
      is_default: config.is_default,
      is_embedding_default: config.is_embedding_default,
    });
    setShowFormModal(true);
  };

  // Provider 变更时自动填充 Base URL
  const handleProviderChange = (provider: string) => {
    setFormData((prev) => ({
      ...prev,
      provider,
      base_url: PROVIDER_DEFAULTS[provider] || '',
    }));
  };

  // 提交表单
  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.model_name.trim()) {
      alert('请填写名称和模型名称');
      return;
    }

    if (formData.is_embedding_default && !formLooksLikeEmbedding) {
      alert('当前模型名称看起来不像向量模型。请确认它支持 /embeddings 后再设为默认向量模型。');
      return;
    }

    if (formData.is_default && formLooksLikeEmbedding && !formLooksLikeChat) {
      alert('当前模型名称更像向量模型，不建议将它设为默认聊天模型。');
      return;
    }

    try {
      if (editingConfig) {
        await updateModelConfig(editingConfig.id, formData);
      } else {
        await createModelConfig(formData);
      }
      setShowFormModal(false);
      loadConfigs();
    } catch (err) {
      alert(`操作失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  // 删除模型配置
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此模型配置吗？')) return;
    try {
      await deleteModelConfig(id);
      loadConfigs();
    } catch {
      alert('删除失败');
    }
  };

  // 测试连接
  const handleTest = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const result = await testModelConfig(id);
      setTestResult({ id, kind: 'chat', success: true, message: result.message || '连接成功' });
    } catch (err) {
      setTestResult({
        id,
        kind: 'chat',
        success: false,
        message: err instanceof Error ? err.message : '连接失败',
      });
    } finally {
      setTestingId(null);
      // 5秒后清除测试结果
      setTimeout(() => {
        setTestResult((prev) => (prev?.id === id ? null : prev));
      }, 5000);
    }
  };

  const handleEmbeddingTest = async (id: string) => {
    setEmbeddingTestingId(id);
    setTestResult(null);
    try {
      const result = await testEmbeddingModelConfig(id);
      setTestResult({
        id,
        kind: 'embedding',
        success: !!result.success,
        message: result.message || '向量模型连接成功',
      });
    } catch (err) {
      setTestResult({
        id,
        kind: 'embedding',
        success: false,
        message: err instanceof Error ? err.message : '向量模型连接失败',
      });
    } finally {
      setEmbeddingTestingId(null);
      setTimeout(() => {
        setTestResult((prev) => (prev?.id === id ? null : prev));
      }, 5000);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">设置</h1>
            <p className="text-sm text-muted-foreground mt-1">
              管理模型配置和系统设置
            </p>
          </div>
        </div>

        {/* 模型配置管理 */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">模型配置</h2>
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              添加模型
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <div className="text-xs font-medium text-muted-foreground mb-1">默认聊天模型</div>
              {defaultChatModel ? (
                <>
                  <div className="text-sm font-semibold text-foreground">{defaultChatModel.name}</div>
                  <div className="text-xs text-muted-foreground mt-1 break-all">
                    {defaultChatModel.provider} / {defaultChatModel.model_name}
                  </div>
                </>
              ) : (
                <div className="text-sm text-amber-600">尚未设置，聊天将回退到第一条可用配置</div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <div className="text-xs font-medium text-muted-foreground mb-1">默认向量模型</div>
              {defaultEmbeddingModel ? (
                <>
                  <div className="text-sm font-semibold text-foreground">{defaultEmbeddingModel.name}</div>
                  <div className="text-xs text-muted-foreground mt-1 break-all">
                    {defaultEmbeddingModel.provider} / {defaultEmbeddingModel.model_name}
                  </div>
                </>
              ) : (
                <div className="text-sm text-amber-600">尚未设置，知识库上传会回退到聊天模型，可能导致 embeddings 失败</div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/60 px-4 py-3 mb-4">
            <div className="text-sm font-medium text-foreground mb-1">推荐配置方式</div>
            <p className="text-xs text-muted-foreground leading-5">
              聊天模型用于普通对话、Agent 和问答生成；向量模型只用于知识库文档切块后的 embeddings。
              最稳妥的做法是分别配置，避免把聊天模型误用于向量化。
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : modelConfigs.length === 0 ? (
            <div className="text-center py-12 rounded-xl border border-dashed border-border">
              <svg className="w-12 h-12 text-muted-foreground mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-muted-foreground">暂无模型配置，点击上方按钮添加</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {modelConfigs.map((config) => (
                <div
                  key={config.id}
                  className="p-5 rounded-xl border border-border bg-card"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground">{config.name}</h3>
                        {config.is_default && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-accent/20 text-accent font-medium">
                            聊天默认
                          </span>
                        )}
                        {config.is_embedding_default && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/15 text-emerald-600 font-medium">
                            向量默认
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{config.model_name}</p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-2 text-sm">
                      <span className="text-muted-foreground">推断:</span>
                      <div className="flex flex-wrap gap-1.5 min-w-0">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
                          {config.inferred_type === 'embedding'
                            ? '偏向向量模型'
                            : config.inferred_type === 'chat'
                              ? '偏向聊天模型'
                              : '用途待确认'}
                        </span>
                        {config.capability_hints?.map((hint) => (
                          <span
                            key={hint}
                            className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground"
                          >
                            {hint}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-2 text-sm">
                      <span className="text-muted-foreground">用途:</span>
                      <div className="flex flex-wrap gap-2 min-w-0">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            config.is_default
                              ? 'bg-accent/15 text-accent'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          聊天
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            config.is_embedding_default
                              ? 'bg-emerald-500/15 text-emerald-600'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          向量化
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-2 text-sm">
                      <span className="text-muted-foreground">Provider:</span>
                      <span className="text-foreground font-medium min-w-0">{config.provider}</span>
                    </div>
                    <div className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-2 text-sm">
                      <span className="text-muted-foreground">Base URL:</span>
                      <span className="text-foreground text-xs font-mono min-w-0 break-all">
                        {config.base_url}
                      </span>
                    </div>
                    <div className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-2 text-sm">
                      <span className="text-muted-foreground">API Key:</span>
                      <span className="text-foreground font-mono text-xs min-w-0 break-all">
                        {config.api_key_masked}
                      </span>
                    </div>
                  </div>

                  {/* 测试结果显示 */}
                  {testResult?.id === config.id && (
                    <div
                      className={`mb-3 px-3 py-2 rounded-lg text-sm ${
                        testResult.success
                          ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                          : 'bg-red-500/10 text-red-500 border border-red-500/20'
                      }`}
                    >
                      {testResult.message}
                    </div>
                  )}

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => handleTest(config.id)}
                      disabled={testingId === config.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      {testingId === config.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      )}
                      测试连接
                    </button>
                    <button
                      onClick={() => handleEmbeddingTest(config.id)}
                      disabled={embeddingTestingId === config.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      {embeddingTestingId === config.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14-4H5m14 8H9m-4 0H5" />
                        </svg>
                      )}
                      测试向量模型
                    </button>
                    <button
                      onClick={() => handleOpenEdit(config)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(config.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-red-400 hover:border-red-400/30 hover:bg-red-400/5 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 系统信息 */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">系统信息</h2>
          <div className="p-5 rounded-xl border border-border bg-card">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">应用名称</span>
                <p className="text-foreground font-medium mt-0.5">AI Workspace</p>
              </div>
              <div>
                <span className="text-muted-foreground">版本</span>
                <p className="text-foreground font-medium mt-0.5">1.0.0</p>
              </div>
              <div>
                <span className="text-muted-foreground">前端框架</span>
                <p className="text-foreground font-medium mt-0.5">Next.js 14 (App Router)</p>
              </div>
              <div>
                <span className="text-muted-foreground">后端 API</span>
                <p className="text-foreground font-medium mt-0.5">http://localhost:8000</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 添加/编辑模型配置模态框 */}
      <Modal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        title={editingConfig ? '编辑模型配置' : '添加模型配置'}
      >
        <div className="space-y-4">
          {/* 快速模板选择 */}
          {!editingConfig && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                快速配置模板
              </label>
              <div className="flex flex-wrap gap-2">
                {MODEL_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.label}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        name: prev.name || tpl.label,
                        provider: tpl.provider,
                        base_url: tpl.base_url,
                        model_name: tpl.model_name,
                      }))
                    }
                    className="px-2.5 py-1 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:border-accent/50 hover:bg-muted/30 transition-colors whitespace-nowrap"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                点击模板自动填充 Provider、Base URL 和模型名称。向量模型建议选择 embedding 模板。
              </p>
            </div>
          )}

          {/* 名称 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="例如：GPT-4 配置"
              className="w-full px-3 py-2 rounded-lg border border-border bg-input-bg text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* Provider */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Provider <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-input-bg text-foreground text-sm outline-none focus:border-accent transition-colors"
            >
              <option value="openai">OpenAI</option>
              <option value="openrouter">OpenRouter</option>
              <option value="custom">自定义</option>
            </select>
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Base URL
            </label>
            <input
              type="text"
              value={formData.base_url}
              onChange={(e) => setFormData((prev) => ({ ...prev, base_url: e.target.value }))}
              placeholder="API 基础地址"
              className="w-full px-3 py-2 rounded-lg border border-border bg-input-bg text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-accent transition-colors font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">
              根据 Provider 自动填充，也可手动修改
            </p>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              API Key
            </label>
            <input
              type="password"
              value={formData.api_key}
              onChange={(e) => setFormData((prev) => ({ ...prev, api_key: e.target.value }))}
              placeholder={editingConfig ? '留空则不修改' : '输入 API Key'}
              className="w-full px-3 py-2 rounded-lg border border-border bg-input-bg text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-accent transition-colors font-mono"
            />
          </div>

          {/* 模型名称 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              模型名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.model_name}
              onChange={(e) => setFormData((prev) => ({ ...prev, model_name: e.target.value }))}
              placeholder="例如：gpt-4, claude-3-opus"
              className="w-full px-3 py-2 rounded-lg border border-border bg-input-bg text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-accent transition-colors font-mono"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className={`px-2 py-0.5 rounded-full text-xs ${
                  formLooksLikeEmbedding
                    ? 'bg-emerald-500/15 text-emerald-600'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {formLooksLikeEmbedding ? '识别为向量模型候选' : '未识别为向量模型'}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs ${
                  formLooksLikeChat ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground'
                }`}
              >
                {formLooksLikeChat ? '识别为聊天模型候选' : '未识别为聊天模型'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              这是基于模型名称的快速判断，不等同于真实能力；最终请用“测试连接”和“测试向量模型”确认。
            </p>
          </div>

          {/* 设为默认 */}
          <div className="flex items-center justify-between py-2">
            <label className="text-sm font-medium text-foreground">设为默认聊天模型</label>
            <button
              onClick={() => setFormData((prev) => ({ ...prev, is_default: !prev.is_default }))}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                formData.is_default ? 'bg-accent' : 'bg-muted'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  formData.is_default ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <label className="text-sm font-medium text-foreground">设为默认向量模型</label>
              <p className="text-xs text-muted-foreground mt-0.5">
                知识库上传和检索生成向量时优先使用
              </p>
            </div>
            <button
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  is_embedding_default: !prev.is_embedding_default,
                }))
              }
              className={`relative w-10 h-5 rounded-full transition-colors ${
                formData.is_embedding_default ? 'bg-emerald-500' : 'bg-muted'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  formData.is_embedding_default ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowFormModal(false)}
              className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
            >
              {editingConfig ? '保存' : '创建'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
