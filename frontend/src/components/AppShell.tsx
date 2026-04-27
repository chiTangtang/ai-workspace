'use client';

import React, { useState, ReactNode } from 'react';
import Sidebar from './Sidebar';
import { Conversation } from '@/types';

interface AppShellProps {
  children: ReactNode;
}

/** 应用外壳组件 - 包含侧边栏和主内容区 */
export default function AppShell({ children }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* 左侧边栏 */}
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={setActiveConversationId}
        onNewConversation={() => {
          setActiveConversationId(undefined);
        }}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      {/* 右侧主内容区 */}
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
