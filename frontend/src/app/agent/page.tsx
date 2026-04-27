'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ChatMessage from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';
import StreamingMessage from '@/components/StreamingMessage';
import ModelSelector from '@/components/ModelSelector';
import ToolCard from '@/components/ToolCard';
import { AgentTool, AgentStep, Message } from '@/types';
import { getAgentTools, sendAgentMessage, processStream } from '@/lib/api';

/** Agent 页面 */
export default function AgentPage() {
  const [tools, setTools] = useState<AgentTool[]>([]);
  const [enabledTools, setEnabledTools] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<Message[]>([]);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string>();
  const [loadingTools, setLoadingTools] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const cancelStreamRef = useRef<(() => void) | null>(null);

  // 加载工具列表
  useEffect(() => {
    async function loadTools() {
      try {
        const data = await getAgentTools();
        const toolList: AgentTool[] = Array.isArray(data) ? data : data.items || [];
        setTools(toolList);
        // 默认启用所有工具
        setEnabledTools(new Set(toolList.filter((t) => t.is_enabled).map((t) => t.id)));
      } catch {
        console.error('加载 Agent 工具失败');
      } finally {
        setLoadingTools(false);
      }
    }
    loadTools();
  }, []);

  // 自动滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, steps, streamingContent]);

  // 切换工具启用状态
  const handleToggleTool = (toolId: string) => {
    setEnabledTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  };

  // 发送消息
  const handleSend = async (content: string) => {
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: '',
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);
    setStreamingContent('');
    setSteps([]);

    try {
      const enabledToolIds = tools
        .filter((t) => enabledTools.has(t.id))
        .map((t) => t.name);

      const stream = await sendAgentMessage(
        content,
        undefined,
        selectedModelId,
        enabledToolIds
      );

      cancelStreamRef.current = processStream(stream, {
        onContent: (text) => {
          setStreamingContent((prev) => prev + text);
        },
        onToolCall: (toolName, args) => {
          setSteps((prev) => [
            ...prev,
            {
              type: 'tool_call',
              content: `调用工具: ${toolName}`,
              tool_name: toolName,
              timestamp: new Date().toISOString(),
            },
          ]);
        },
        onToolResult: (result) => {
          setSteps((prev) => [
            ...prev,
            {
              type: 'observation',
              content: result,
              timestamp: new Date().toISOString(),
            },
          ]);
        },
        onDone: () => {
          if (streamingContent) {
            setMessages((prev) => [
              ...prev,
              {
                id: `ai-${Date.now()}`,
                conversation_id: '',
                role: 'assistant',
                content: streamingContent,
                created_at: new Date().toISOString(),
              },
            ]);
          }
          setStreamingContent('');
          setIsStreaming(false);
          cancelStreamRef.current = null;
        },
        onError: (error) => {
          setStreamingContent('');
          setIsStreaming(false);
          cancelStreamRef.current = null;
          alert(`错误: ${error}`);
        },
      });
    } catch (err) {
      setStreamingContent('');
      setIsStreaming(false);
      alert(`发送失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  // 停止生成
  const handleStop = () => {
    if (cancelStreamRef.current) {
      cancelStreamRef.current();
      cancelStreamRef.current = null;
    }
    if (streamingContent) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          conversation_id: '',
          role: 'assistant',
          content: streamingContent,
          created_at: new Date().toISOString(),
        },
      ]);
    }
    setStreamingContent('');
    setIsStreaming(false);
  };

  return (
    <div className="flex h-full">
      {/* 左侧：工具列表 */}
      <div className="w-72 border-r border-border bg-sidebar flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">可用工具</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            选择要启用的工具（{enabledTools.size}/{tools.length}）
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loadingTools ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tools.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">暂无可用工具</p>
          ) : (
            tools.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={{ ...tool, is_enabled: enabledTools.has(tool.id) }}
                onToggle={handleToggleTool}
              />
            ))
          )}
        </div>
      </div>

      {/* 右侧：对话主区域 */}
      <div className="flex-1 flex flex-col h-full">
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
          <h1 className="text-sm font-medium text-foreground">Agent 对话</h1>
          <ModelSelector
            selectedModelId={selectedModelId}
            onSelectModel={setSelectedModelId}
          />
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {messages.length === 0 && steps.length === 0 && !streamingContent ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                AI Agent
              </h2>
              <p className="text-sm text-muted-foreground max-w-md">
                启用左侧的工具，AI Agent 将使用这些工具来帮助您完成任务。
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}

              {/* Agent 步骤可视化 */}
              {steps.map((step, index) => (
                <div key={index} className="mb-3 animate-fade-in">
                  <div
                    className={`flex items-start gap-2 px-4 py-2.5 rounded-lg text-sm ${
                      step.type === 'tool_call'
                        ? 'bg-amber-500/10 border border-amber-500/20'
                        : step.type === 'observation'
                        ? 'bg-green-500/10 border border-green-500/20'
                        : 'bg-muted border border-border'
                    }`}
                  >
                    {/* 步骤图标 */}
                    <div className="shrink-0 mt-0.5">
                      {step.type === 'tool_call' ? (
                        <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      ) : step.type === 'observation' ? (
                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground">{step.content}</div>
                      {step.type === 'observation' && (
                        <pre className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap overflow-x-auto">
                          {step.content}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {streamingContent && <StreamingMessage content={streamingContent} />}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <ChatInput
          onSend={handleSend}
          onStop={handleStop}
          isStreaming={isStreaming}
          placeholder="输入消息，Agent 将使用工具来帮助您..."
        />
      </div>
    </div>
  );
}
