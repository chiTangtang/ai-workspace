// 对话相关类型
export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  message_count: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

// 知识库相关类型
export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  document_count: number;
  created_at: string;
}

export interface Document {
  id: string;
  knowledge_base_id: string;
  filename: string;
  chunk_count: number;
  created_at: string;
}

// 模型配置相关类型
export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  base_url: string;
  api_key_masked: string;
  model_name: string;
  is_default: boolean;
  created_at: string;
}

export interface ModelConfigForm {
  name: string;
  provider: string;
  base_url: string;
  api_key: string;
  model_name: string;
  is_default: boolean;
}

// Agent 相关类型
export interface AgentTool {
  id: string;
  name: string;
  description: string;
  is_enabled: boolean;
}

// Agent 步骤类型（用于可视化工具调用过程）
export interface AgentStep {
  type: 'thinking' | 'tool_call' | 'observation' | 'response';
  content: string;
  tool_name?: string;
  timestamp: string;
}

// 流式响应事件类型
export interface StreamEvent {
  type: 'content' | 'tool_call' | 'tool_result' | 'done' | 'error';
  data: string;
}
