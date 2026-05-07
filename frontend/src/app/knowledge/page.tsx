'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Modal from '@/components/Modal';
import DocumentUpload from '@/components/DocumentUpload';
import ChatMessage from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';
import StreamingMessage from '@/components/StreamingMessage';
import ModelSelector from '@/components/ModelSelector';
import { KnowledgeBase, Document, Message } from '@/types';
import {
  getKnowledgeBases,
  createKnowledgeBase,
  deleteKnowledgeBase,
  precheckDocumentUpload,
  uploadDocument,
  getDocuments,
  queryKnowledgeBase,
} from '@/lib/api';
import { useStreamingResponse } from '@/lib/useStreamingResponse';

export default function KnowledgePage() {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKbName, setNewKbName] = useState('');
  const [newKbDesc, setNewKbDesc] = useState('');
  const [loadingKbs, setLoadingKbs] = useState(false);

  const [activeKb, setActiveKb] = useState<KnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const [kbMessages, setKbMessages] = useState<Message[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { streamingContent, isStreaming, startStream, stopStream, resetStreaming } =
    useStreamingResponse();

  const loadKnowledgeBases = useCallback(async () => {
    setLoadingKbs(true);
    try {
      const data = await getKnowledgeBases();
      setKnowledgeBases(Array.isArray(data) ? data : data.items || []);
    } catch {
      console.error('加载知识库列表失败');
    } finally {
      setLoadingKbs(false);
    }
  }, []);

  useEffect(() => {
    const run = async () => {
      await loadKnowledgeBases();
    };
    void run();
  }, [loadKnowledgeBases]);

  const loadDocuments = useCallback(async (kbId: string) => {
    setLoadingDocs(true);
    try {
      const data = await getDocuments(kbId);
      setDocuments(Array.isArray(data) ? data : data.items || []);
    } catch {
      console.error('加载文档列表失败');
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  const handleEnterKb = (kb: KnowledgeBase) => {
    setActiveKb(kb);
    void loadDocuments(kb.id);
    setKbMessages([]);
    resetStreaming();
    setUploadStatus(null);
  };

  const handleBackToList = () => {
    setActiveKb(null);
    setDocuments([]);
    setKbMessages([]);
    resetStreaming();
    setUploadStatus(null);
  };

  const handleCreateKb = async () => {
    if (!newKbName.trim()) return;
    try {
      await createKnowledgeBase(newKbName.trim(), newKbDesc.trim());
      setShowCreateModal(false);
      setNewKbName('');
      setNewKbDesc('');
      void loadKnowledgeBases();
    } catch {
      alert('创建知识库失败');
    }
  };

  const handleDeleteKb = async (id: string) => {
    if (!confirm('确定要删除此知识库吗？')) return;
    try {
      await deleteKnowledgeBase(id);
      if (activeKb?.id === id) {
        handleBackToList();
      }
      void loadKnowledgeBases();
    } catch {
      alert('删除知识库失败');
    }
  };

  const handleUploadDocument = async (file: File) => {
    if (!activeKb) return;
    setIsUploading(true);
    setUploadStatus('正在检查文件和向量模型配置...');
    try {
      const precheck = await precheckDocumentUpload(activeKb.id, file);

      if (!precheck.supported) {
        throw new Error(`不支持的文件格式 ${precheck.extension}`);
      }

      if (!precheck.embedding_model_available) {
        throw new Error('当前没有可用的向量模型配置，请先在设置页配置默认向量模型');
      }

      if (precheck.warnings.length > 0) {
        setUploadStatus(`预检查提示: ${precheck.warnings.join('；')}`);
      } else {
        setUploadStatus(
          `预检查通过，使用 ${precheck.embedding_provider} / ${precheck.embedding_model_name}`
        );
      }

      await uploadDocument(activeKb.id, file);
      setUploadStatus('上传成功，文档已完成解析、分块和向量化');
      void loadDocuments(activeKb.id);
      void loadKnowledgeBases();
    } catch (err) {
      const message = err instanceof Error ? err.message : '上传文档失败';
      setUploadStatus(message);
      alert(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleQuery = async (question: string) => {
    if (!activeKb) return;

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: '',
      role: 'user',
      content: question,
      created_at: new Date().toISOString(),
    };
    setKbMessages((prev) => [...prev, userMessage]);

    try {
      const stream = await queryKnowledgeBase(activeKb.id, question, undefined, selectedModelId);

      startStream({
        stream,
        onDone: (finalContent) => {
          if (finalContent) {
            setKbMessages((prev) => [
              ...prev,
              {
                id: `ai-${Date.now()}`,
                conversation_id: '',
                role: 'assistant',
                content: finalContent,
                created_at: new Date().toISOString(),
              },
            ]);
          }
        },
        onError: (error) => {
          alert(`错误: ${error}`);
        },
      });
    } catch (err) {
      resetStreaming();
      alert(`查询失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const handleStop = () => {
    const finalContent = stopStream();
    if (finalContent) {
      setKbMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          conversation_id: '',
          role: 'assistant',
          content: finalContent,
          created_at: new Date().toISOString(),
        },
      ]);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [kbMessages, streamingContent]);

  if (!activeKb) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-foreground">知识库</h1>
              <p className="text-sm text-muted-foreground mt-1">
                管理您的知识库，上传文档并进行智能问答
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              创建知识库
            </button>
          </div>

          {loadingKbs ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : knowledgeBases.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">暂无知识库</h2>
              <p className="text-sm text-muted-foreground">点击上方按钮创建您的第一个知识库</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {knowledgeBases.map((kb) => (
                <div
                  key={kb.id}
                  className="group p-5 rounded-xl border border-border bg-card hover:border-accent/30 transition-colors cursor-pointer"
                  onClick={() => handleEnterKb(kb)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDeleteKb(kb.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-all"
                      title="删除知识库"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-1">{kb.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {kb.description || '暂无描述'}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{kb.document_count} 个文档</span>
                    <span>{new Date(kb.created_at).toLocaleDateString('zh-CN')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="创建知识库">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newKbName}
                onChange={(e) => setNewKbName(e.target.value)}
                placeholder="输入知识库名称"
                className="w-full px-3 py-2 rounded-lg border border-border bg-input-bg text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">描述</label>
              <textarea
                value={newKbDesc}
                onChange={(e) => setNewKbDesc(e.target.value)}
                placeholder="输入知识库描述（可选）"
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input-bg text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-accent transition-colors resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateKb}
                disabled={!newKbName.trim()}
                className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                创建
              </button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="w-72 border-r border-border bg-sidebar flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <button
            onClick={handleBackToList}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回列表
          </button>
          <h2 className="text-base font-semibold text-foreground truncate">{activeKb.name}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{activeKb.description}</p>
        </div>

        <div className="p-3">
          <DocumentUpload onUpload={handleUploadDocument} isUploading={isUploading} acceptedTypes=".pdf,.doc,.docx,.txt,.md" />
          {uploadStatus && (
            <div className="mt-3 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap break-words">
              {uploadStatus}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            文档列表 ({documents.length})
          </h3>
          {loadingDocs ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : documents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">暂无文档</p>
          ) : (
            <div className="space-y-1">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <svg className="w-4 h-4 text-muted-foreground shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{doc.filename}</div>
                    <div className="text-xs text-muted-foreground">{doc.chunk_count} 个分块</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full">
        <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
          <h1 className="text-sm font-medium text-foreground">知识库问答</h1>
          <ModelSelector
            selectedModelId={selectedModelId}
            onSelectModel={setSelectedModelId}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          {kbMessages.length === 0 && !streamingContent ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">基于知识库提问</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                提出关于 {activeKb.name} 的问题，AI 将基于知识库内容为您解答。
              </p>
            </div>
          ) : (
            <>
              {kbMessages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              {streamingContent && <StreamingMessage content={streamingContent} />}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        <ChatInput
          onSend={handleQuery}
          onStop={handleStop}
          isStreaming={isStreaming}
          placeholder={`向知识库 "${activeKb.name}" 提问...`}
        />
      </div>
    </div>
  );
}
