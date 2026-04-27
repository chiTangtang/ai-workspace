'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface StreamingMessageProps {
  content: string;
}

/** 流式消息组件 - 实时更新内容并支持 Markdown 渲染 */
export default function StreamingMessage({ content }: StreamingMessageProps) {
  if (!content) return null;

  return (
    <div className="flex justify-start mb-4">
      <div className="flex gap-3 max-w-[80%]">
        {/* AI 头像 */}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-muted">
          <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>

        {/* 消息内容 */}
        <div className="rounded-xl px-4 py-3 bg-card border border-border rounded-tl-sm">
          <div className="prose prose-sm max-w-none prose-invert">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const codeString = String(children).replace(/\n$/, '');

                  if (match || codeString.includes('\n')) {
                    return (
                      <div className="relative my-3 rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] text-xs text-gray-400">
                          <span>{match ? match[1] : 'code'}</span>
                          <button
                            onClick={() => navigator.clipboard.writeText(codeString)}
                            className="hover:text-white transition-colors"
                          >
                            复制
                          </button>
                        </div>
                        <SyntaxHighlighter
                          style={oneDark}
                          language={match ? match[1] : 'text'}
                          PreTag="div"
                          customStyle={{
                            margin: 0,
                            borderRadius: 0,
                            fontSize: '13px',
                          }}
                        >
                          {codeString}
                        </SyntaxHighlighter>
                      </div>
                    );
                  }

                  return (
                    <code
                      className="px-1.5 py-0.5 rounded bg-[#1e1e1e] text-accent text-xs font-mono"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                table({ children }) {
                  return (
                    <div className="overflow-x-auto my-3">
                      <table className="min-w-full border border-border text-sm">
                        {children}
                      </table>
                    </div>
                  );
                },
                th({ children }) {
                  return (
                    <th className="px-3 py-2 bg-muted border border-border text-left font-medium">
                      {children}
                    </th>
                  );
                },
                td({ children }) {
                  return <td className="px-3 py-2 border border-border">{children}</td>;
                },
                a({ children, href }) {
                  return (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      {children}
                    </a>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
          {/* 打字机光标 */}
          <span className="inline-block w-2 h-4 ml-0.5 bg-accent animate-pulse align-text-bottom" />
        </div>
      </div>
    </div>
  );
}
