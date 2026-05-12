import { DocumentUploadPrecheck, ModelConfigForm } from '@/types';

const API_BASE = 'http://localhost:8000';

interface StreamResponse {
  stream: ReadableStream<Uint8Array>;
  conversationId?: string;
}

async function getApiErrorMessage(res: Response, fallback: string) {
  try {
    const data = await res.json();
    if (typeof data?.detail === 'string') return data.detail;
    if (typeof data?.message === 'string') return data.message;
  } catch {
    // ignore parse errors
  }
  return fallback;
}

export async function getConversations() {
  const res = await fetch(`${API_BASE}/api/conversations`);
  if (!res.ok) throw new Error('获取对话列表失败');
  return res.json();
}

export async function getMessages(conversationId: string) {
  const res = await fetch(`${API_BASE}/api/conversations/${conversationId}/messages`);
  if (!res.ok) throw new Error('获取消息失败');
  return res.json();
}

export async function sendMessage(
  message: string,
  conversationId?: string,
  modelConfigId?: string
): Promise<StreamResponse> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
      model_config_id: modelConfigId,
    }),
  });
  if (!res.ok) throw new Error('发送消息失败');
  if (!res.body) throw new Error('响应体为空');
  return {
    stream: res.body,
    conversationId: res.headers.get('X-Conversation-Id') || undefined,
  };
}

export async function deleteConversation(id: string) {
  const res = await fetch(`${API_BASE}/api/conversations/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('删除对话失败');
  return res.json();
}

export async function getKnowledgeBases() {
  const res = await fetch(`${API_BASE}/api/knowledge-bases`);
  if (!res.ok) throw new Error('获取知识库列表失败');
  return res.json();
}

export async function createKnowledgeBase(name: string, description: string) {
  const res = await fetch(`${API_BASE}/api/knowledge-bases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) throw new Error('创建知识库失败');
  return res.json();
}

export async function deleteKnowledgeBase(id: string) {
  const res = await fetch(`${API_BASE}/api/knowledge-bases/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('删除知识库失败');
  return res.json();
}

export async function uploadDocument(kbId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/api/knowledge-bases/${kbId}/documents`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(await getApiErrorMessage(res, '上传文档失败'));
  return res.json();
}

export async function precheckDocumentUpload(kbId: string, file: File): Promise<DocumentUploadPrecheck> {
  const res = await fetch(`${API_BASE}/api/knowledge-bases/${kbId}/documents/precheck`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      file_size: file.size,
    }),
  });
  if (!res.ok) throw new Error(await getApiErrorMessage(res, '上传预检查失败'));
  return res.json();
}

export async function getDocuments(kbId: string) {
  const res = await fetch(`${API_BASE}/api/knowledge-bases/${kbId}/documents`);
  if (!res.ok) throw new Error('获取文档列表失败');
  return res.json();
}

export async function queryKnowledgeBase(
  kbId: string,
  question: string,
  conversationId?: string,
  modelConfigId?: string
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${API_BASE}/api/knowledge-bases/${kbId}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      conversation_id: conversationId,
      model_config_id: modelConfigId,
    }),
  });
  if (!res.ok) throw new Error('知识库问答失败');
  if (!res.body) throw new Error('响应体为空');
  return res.body;
}

export async function getModelConfigs() {
  const res = await fetch(`${API_BASE}/api/model-configs`);
  if (!res.ok) throw new Error('获取模型配置失败');
  return res.json();
}

export async function createModelConfig(config: ModelConfigForm) {
  const res = await fetch(`${API_BASE}/api/model-configs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('创建模型配置失败');
  return res.json();
}

export async function updateModelConfig(id: string, config: ModelConfigForm) {
  const res = await fetch(`${API_BASE}/api/model-configs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('更新模型配置失败');
  return res.json();
}

export async function deleteModelConfig(id: string) {
  const res = await fetch(`${API_BASE}/api/model-configs/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('删除模型配置失败');
  return res.json();
}

export async function testModelConfig(id: string) {
  const res = await fetch(`${API_BASE}/api/model-configs/${id}/test`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await getApiErrorMessage(res, '测试连接失败'));
  return res.json();
}

export async function testEmbeddingModelConfig(id: string) {
  const res = await fetch(`${API_BASE}/api/model-configs/${id}/test-embedding`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await getApiErrorMessage(res, '测试向量模型失败'));
  return res.json();
}

export async function getAgentTools() {
  const res = await fetch(`${API_BASE}/api/agent/tools`);
  if (!res.ok) throw new Error('获取 Agent 工具失败');
  return res.json();
}

export async function sendAgentMessage(
  message: string,
  conversationId?: string,
  modelConfigId?: string,
  tools?: string[]
): Promise<StreamResponse> {
  const res = await fetch(`${API_BASE}/api/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
      model_config_id: modelConfigId,
      tools,
    }),
  });
  if (!res.ok) throw new Error('发送 Agent 消息失败');
  if (!res.body) throw new Error('响应体为空');
  return {
    stream: res.body,
    conversationId: res.headers.get('X-Conversation-Id') || undefined,
  };
}

export async function analyzeImage(
  message: string,
  imageBase64: string,
  modelConfigId?: string
) {
  const res = await fetch(`${API_BASE}/api/chat/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      image_base64: imageBase64,
      model_config_id: modelConfigId,
    }),
  });
  if (!res.ok) throw new Error('图片分析失败');
  return res.json();
}

export function processStream(
  stream: ReadableStream<Uint8Array>,
  callbacks: {
    onContent?: (content: string) => void;
    onToolCall?: (toolName: string, args: string) => void;
    onToolResult?: (result: string) => void;
    onDone?: () => void;
    onError?: (error: string) => void;
  }
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  function read() {
    reader
      .read()
      .then(({ done, value }) => {
        if (done) {
          callbacks.onDone?.();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith('data: ')) continue;

          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            callbacks.onDone?.();
            return;
          }

          try {
            const parsed = JSON.parse(data);

            if (typeof parsed.content === 'string') {
              callbacks.onContent?.(parsed.content);
              continue;
            }

            if (parsed.tool_call) {
              callbacks.onToolCall?.(
                parsed.tool_call.name || 'tool_call',
                JSON.stringify(parsed.tool_call.arguments ?? {})
              );
              continue;
            }

            if (parsed.tool_result) {
              callbacks.onToolResult?.(parsed.tool_result.result || '');
              continue;
            }

            if (parsed.tool_calls) {
              callbacks.onToolCall?.('tool_calls', JSON.stringify(parsed.tool_calls));
              continue;
            }

            switch (parsed.type) {
              case 'content':
                callbacks.onContent?.(parsed.data);
                break;
              case 'tool_call':
                callbacks.onToolCall?.(parsed.tool_name, parsed.data);
                break;
              case 'tool_result':
                callbacks.onToolResult?.(parsed.data);
                break;
              case 'error':
                callbacks.onError?.(parsed.data);
                break;
            }
          } catch {
            callbacks.onContent?.(data);
          }
        }

        read();
      })
      .catch((err) => {
        callbacks.onError?.(err.message);
      });
  }

  read();

  return () => {
    reader.cancel();
  };
}
