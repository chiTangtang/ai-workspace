'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/lib/theme-context';
import { getModelConfigs } from '@/lib/api';
import { Conversation, ModelConfig } from '@/types';

interface SidebarProps {
  conversations?: Conversation[];
  activeConversationId?: string;
  onSelectConversation?: (id: string) => void;
  onNewConversation?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

/** 左侧导航栏组件 */
export default function Sidebar({
  conversations = [],
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const isChatPage = pathname === '/chat';
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadModelConfigs() {
      setModelsLoading(true);
      try {
        const configs = await getModelConfigs();
        if (active) {
          setModelConfigs(Array.isArray(configs) ? configs : []);
        }
      } catch {
        if (active) {
          setModelConfigs([]);
        }
      } finally {
        if (active) {
          setModelsLoading(false);
        }
      }
    }

    loadModelConfigs();
    return () => {
      active = false;
    };
  }, []);

  const defaultChatModel = modelConfigs.find((config) => config.is_default);
  const defaultEmbeddingModel = modelConfigs.find((config) => config.is_embedding_default);

  // 导航菜单项
  const navItems = [
    {
      name: '对话',
      href: '/chat',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      name: '知识库',
      href: '/knowledge',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      name: 'Agent',
      href: '/agent',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      name: '设置',
      href: '/settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <aside
      className={`flex flex-col h-full bg-sidebar border-r border-border transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Logo 和应用名称 */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-border shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-bold text-lg text-foreground">AI Workspace</span>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 mx-auto rounded-lg bg-accent flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        )}
        <button
          onClick={() => {
            setSettingsOpen(false);
            onToggleCollapse?.();
          }}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title={collapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          <svg
            className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* 导航菜单 */}
      <nav className="px-2 py-3 space-y-1 shrink-0">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSettingsOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
              title={collapsed ? item.name : undefined}
            >
              {item.icon}
              {!collapsed && <span className="text-sm font-medium">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* 对话列表（仅在对话页面显示） */}
      {isChatPage && !collapsed && (
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {/* 新建对话按钮 */}
          <button
            onClick={onNewConversation}
            className="w-full flex items-center gap-2 px-3 py-2.5 mb-2 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-accent hover:bg-accent/5 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm">新建对话</span>
          </button>

          {/* 对话列表 */}
          <div className="space-y-0.5">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelectConversation?.(conv.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors ${
                  conv.id === activeConversationId
                    ? 'bg-accent/10 text-accent'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                title={conv.title}
              >
                <div className="truncate">{conv.title || '新对话'}</div>
                <div className="text-xs text-muted-foreground/60 mt-0.5">
                  {conv.message_count} 条消息
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 底部快捷设置 */}
      <div className="relative px-2 py-3 border-t border-border shrink-0">
        {settingsOpen && (
          <div
            className={`absolute z-30 rounded-xl border border-border bg-background/95 shadow-xl backdrop-blur-sm left-full bottom-3 ml-2 w-72 ${
              collapsed ? '' : ''
            }`}
          >
            <div className="border-b border-border px-4 py-3">
              <div className="text-sm font-semibold text-foreground">快捷设置</div>
              <div className="mt-1 text-xs text-muted-foreground">
                常用选项放这里，少绕点路。
              </div>
            </div>

            <div className="space-y-3 px-3 py-3">
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <div className="text-xs font-medium text-muted-foreground">默认聊天模型</div>
                <div className="mt-1 break-all text-sm text-foreground">
                  {modelsLoading
                    ? '加载中...'
                    : defaultChatModel?.model_name || '未设置'}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <div className="text-xs font-medium text-muted-foreground">默认向量模型</div>
                <div className="mt-1 break-all text-sm text-foreground">
                  {modelsLoading
                    ? '加载中...'
                    : defaultEmbeddingModel?.model_name || '未设置'}
                </div>
              </div>

              <button
                onClick={toggleTheme}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {theme === 'dark' ? (
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">主题切换</div>
                  <div className="text-xs text-muted-foreground">
                    当前为{theme === 'dark' ? '深色主题' : '亮色主题'}
                  </div>
                </div>
              </button>

              <Link
                href="/settings"
                onClick={() => setSettingsOpen(false)}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">进入完整设置</div>
                  <div className="text-xs text-muted-foreground">
                    管理模型配置和连接测试
                  </div>
                </div>
              </Link>
            </div>
          </div>
        )}

        <button
          onClick={() => setSettingsOpen((open) => !open)}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title={collapsed ? '快捷设置' : undefined}
        >
          <svg className={`w-5 h-5 shrink-0 transition-transform ${settingsOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {!collapsed && (
            <div className="min-w-0 text-left">
              <div className="text-sm font-medium text-foreground">快捷设置</div>
              <div className="truncate text-xs text-muted-foreground">
                主题、模型和系统入口
              </div>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
