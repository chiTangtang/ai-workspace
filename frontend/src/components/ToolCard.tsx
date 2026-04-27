'use client';

import React from 'react';
import { AgentTool } from '@/types';

interface ToolCardProps {
  tool: AgentTool;
  onToggle: (toolId: string) => void;
}

/** Agent 工具卡片组件 - 显示工具信息及启用开关 */
export default function ToolCard({ tool, onToggle }: ToolCardProps) {
  return (
    <div
      className={`p-3 rounded-lg border transition-colors ${
        tool.is_enabled
          ? 'border-accent/30 bg-accent/5'
          : 'border-border bg-card'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                tool.is_enabled ? 'bg-green-500' : 'bg-muted-foreground'
              }`}
            />
            <h4 className="text-sm font-medium text-foreground truncate">{tool.name}</h4>
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tool.description}</p>
        </div>
        {/* 启用/禁用开关 */}
        <button
          onClick={() => onToggle(tool.id)}
          className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
            tool.is_enabled ? 'bg-accent' : 'bg-muted'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              tool.is_enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
