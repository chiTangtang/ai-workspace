'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ChatMessage from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';
import StreamingMessage from '@/components/StreamingMessage';
import ModelSelector from '@/components/ModelSelector';
import { Conversation, Message } from '@/types';
import {
  getConversations,
  getMessages,
  sendMessage,
  deleteConversation,
  processStream,
} from '@/lib/api';

/** 对话页面 */
export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const cancelStreamRef = useRef<(() => void) | null>(null);

  // 加载对话列表
  const loadConversations = useCallback(async () => {
    try {
      const data = await getConversations();
      setConversations(Array.isArray(data) ? data : data.items || []);
    } catch {
      console.error('加载对话列表失败');
    }
  }, []);

  // 加载消息列表
  const loadMessages = useCallback(async (conversationId: string) => {
    setLoading(true);
    try {
      const data = await getMessages(conversationId);
      setMessages(Array.isArray(data) ? data : data.items || []);
    } catch {
      console.error('加载消息失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始化加载对话列表
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // 切换对话时加载消息
  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
    } else {
      setMessages([]);
    }
    setStreamingContent('');
  }, [activeConversationId, loadMessages]);

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // 发送消息
  const handleSend = async (content: string) => {
    // 添加用户消息到列表
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: activeConversationId || '',
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);
    setStreamingContent('');

    try {
      const stream = await sendMessage(content, activeConversationId, selectedModelId);

      // 处理流式响应
      cancelStreamRef.current = processStream(stream, {
        onContent: (text) => {
          setStreamingContent((prev) => prev + text);
        },
        onDone: () => {
          // 将流式内容转为正式消息
          setMessages((prev) => [
            ...prev,
            {
              id: `ai-${Date.now()}`,
              conversation_id: activeConversationId || '',
              role: 'assistant',
              content: streamingContent,
              created_at: new Date().toISOString(),
            },
          ]);
          setStreamingContent('');
          setIsStreaming(false);
          cancelStreamRef.current = null;
          // 刷新对话列表
          loadConversations();
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
    // 保留已接收的内容
    if (streamingContent) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          conversation_id: activeConversationId || '',
          role: 'assistant',
          content: streamingContent,
          created_at: new Date().toISOString(),
        },
      ]);
    }
    setStreamingContent('');
    setIsStreaming(false);
  };

  // 删除对话
  const handleDeleteConversation = async (id: string) => {
    try {
      await deleteConversation(id);
      if (activeConversationId === id) {
        setActiveConversationId(undefined);
        setMessages([]);
      }
      loadConversations();
    } catch {
      alert('删除对话失败');
    }
  };

  // 新建对话
  const handleNewConversation = () => {
    setActiveConversationId(undefined);
    setMessages([]);
    setStreamingContent('');
  };

  return (
    <div className="flex h-full">
      {/* 对话列表侧边栏 */}
      <div className="w-64 border-r border-border bg-sidebar flex flex-col shrink-0">
        {/* 新建对话按钮 */}
        <div className="p-3 border-b border-border">
          <button
            onClick={handleNewConversation}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新建对话
          </button>
        </div>

        {/* 对话列表 */}
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              暂无对话
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors mb-0.5 ${
                  conv.id === activeConversationId
                    ? 'bg-accent/10 text-accent'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                onClick={() => setActiveConversationId(conv.id)}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{conv.title || '新对话'}</div>
                  <div className="text-xs text-muted-foreground/60 mt-0.5">
                    {conv.message_count} 条消息
                  </div>
                </div>
                {/* 删除按钮 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteConversation(conv.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-red-400 transition-all"
                  title="删除对话"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 对话主区域 */}
      <div className="flex-1 flex flex-col h-full">
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
          <h1 className="text-sm font-medium text-foreground">
            {activeConversationId
              ? conversations.find((c) => c.id === activeConversationId)?.title || '对话'
              : '新对话'}
          </h1>
          <ModelSelector
            selectedModelId={selectedModelId}
            onSelectModel={setSelectedModelId}
          />
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 && !streamingContent ? (
            /* 空状态 */
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                开始新对话
              </h2>
              <p className="text-sm text-muted-foreground max-w-md">
                选择一个模型，输入您的问题，AI 助手将为您提供帮助。
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
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
          placeholder="输入消息..."
        />
      </div>
    </div>
  );
}
