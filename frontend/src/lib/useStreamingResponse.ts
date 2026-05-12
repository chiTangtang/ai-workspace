'use client';

import { useCallback, useRef, useState } from 'react';
import { processStream } from '@/lib/api';

interface StartStreamOptions {
  stream: ReadableStream<Uint8Array>;
  onDone?: (finalContent: string) => void;
  onError?: (error: string, partialContent: string) => void;
  onToolCall?: (toolName: string, args: string) => void;
  onToolResult?: (result: string) => void;
}

export function useStreamingResponse() {
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const cancelStreamRef = useRef<(() => void) | null>(null);
  const streamingContentRef = useRef('');

  const resetStreaming = useCallback(() => {
    setStreamingContent('');
    streamingContentRef.current = '';
    setIsStreaming(false);
  }, []);

  const startStream = useCallback((options: StartStreamOptions) => {
    setIsStreaming(true);
    setStreamingContent('');
    streamingContentRef.current = '';

    cancelStreamRef.current = processStream(options.stream, {
      onContent: (text) => {
        streamingContentRef.current += text;
        setStreamingContent((prev) => prev + text);
      },
      onToolCall: options.onToolCall,
      onToolResult: options.onToolResult,
      onDone: () => {
        const finalContent = streamingContentRef.current;
        options.onDone?.(finalContent);
        resetStreaming();
        cancelStreamRef.current = null;
      },
      onError: (error) => {
        const partialContent = streamingContentRef.current;
        options.onError?.(error, partialContent);
        resetStreaming();
        cancelStreamRef.current = null;
      },
    });
  }, [resetStreaming]);

  const stopStream = useCallback(() => {
    if (cancelStreamRef.current) {
      cancelStreamRef.current();
      cancelStreamRef.current = null;
    }
    const finalContent = streamingContentRef.current || streamingContent;
    resetStreaming();
    return finalContent;
  }, [resetStreaming, streamingContent]);

  return {
    streamingContent,
    isStreaming,
    setStreamingContent,
    startStream,
    stopStream,
    resetStreaming,
  };
}
