'use client';

import React, { useState, useRef, useCallback } from 'react';

interface DocumentUploadProps {
  onUpload: (file: File) => void;
  isUploading?: boolean;
  acceptedTypes?: string;
}

/** 文档拖拽上传组件 */
export default function DocumentUpload({
  onUpload,
  isUploading = false,
  acceptedTypes = '.pdf,.doc,.docx,.txt,.md,.csv,.json',
}: DocumentUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        onUpload(files[0]);
      }
    },
    [onUpload]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onUpload(files[0]);
    }
    // 重置 input 以允许重复上传同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
        isDragOver
          ? 'border-accent bg-accent/5'
          : 'border-border hover:border-accent/50 hover:bg-muted/30'
      } ${isUploading ? 'opacity-60 pointer-events-none' : ''}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        accept={acceptedTypes}
        className="hidden"
      />

      {isUploading ? (
        <div className="flex flex-col items-center gap-3">
          {/* 上传中动画 */}
          <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">正在上传...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <svg
            className={`w-10 h-10 transition-colors ${isDragOver ? 'text-accent' : 'text-muted-foreground'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <div>
            <p className="text-sm text-foreground font-medium">
              拖拽文件到此处，或点击选择文件
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              支持 PDF、TXT、Markdown、Word、CSV、JSON 格式
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
