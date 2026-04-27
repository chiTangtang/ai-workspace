'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ModelConfig } from '@/types';
import { getModelConfigs } from '@/lib/api';

interface ModelSelectorProps {
  selectedModelId?: string;
  onSelectModel: (modelId: string) => void;
}

/** 模型选择下拉框组件 */
export default function ModelSelector({ selectedModelId, onSelectModel }: ModelSelectorProps) {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 加载模型列表
  useEffect(() => {
    async function loadModels() {
      try {
        const data = await getModelConfigs();
        setModels(Array.isArray(data) ? data : data.items || []);
      } catch {
        console.error('加载模型列表失败');
      } finally {
        setLoading(false);
      }
    }
    loadModels();
  }, []);

  // 点击外部关闭下拉框
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 找到当前选中的模型
  const selectedModel = models.find((m) => m.id === selectedModelId);
  const defaultModel = models.find((m) => m.is_default);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm text-foreground hover:bg-muted transition-colors min-w-[160px]"
      >
        <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span className="truncate flex-1 text-left">
          {loading
            ? '加载中...'
            : selectedModel
            ? selectedModel.name
            : defaultModel
            ? defaultModel.name
            : '选择模型'}
        </span>
        <svg
          className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 下拉列表 */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-1 w-64 rounded-lg border border-border bg-card shadow-xl z-50 max-h-60 overflow-y-auto">
          {models.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              暂无可用模型，请先在设置中配置
            </div>
          ) : (
            models.map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  onSelectModel(model.id);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                  model.id === selectedModelId || (!selectedModelId && model.is_default)
                    ? 'bg-accent/10 text-accent'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                <div className="font-medium">{model.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {model.provider} / {model.model_name}
                  {model.is_default && (
                    <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-accent/20 text-accent">
                      默认
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
