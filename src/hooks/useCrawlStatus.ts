'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import type { PipelineRun } from '@/types';

// Global state so crawl survives page navigation
let globalRunningTopicId: string | null = null;

export function useCrawlStatus() {
  const [status, setStatus] = useState<PipelineRun | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // On mount, check if there's a running crawl
  useEffect(() => {
    if (globalRunningTopicId) {
      setIsRunning(true);
      startPolling(globalRunningTopicId);
    }
    return () => stopPolling();
  }, []);

  const startPolling = useCallback((topicId: string) => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    const poll = async () => {
      try {
        const res = await fetch(`/api/crawl/status?topicId=${topicId}`);
        const data = await res.json();
        setStatus(data);
        if (data.status === 'completed' || data.status === 'failed') {
          stopPolling();
          globalRunningTopicId = null;
          setIsRunning(false);
        }
      } catch { /* ignore network errors during polling */ }
    };

    poll(); // immediate first check
    intervalRef.current = setInterval(poll, 1500); // poll every 1.5s for smooth animation
  }, []);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }, []);

  const startCrawl = useCallback(async (topicId: string) => {
    setIsRunning(true);
    globalRunningTopicId = topicId;

    await fetch('/api/crawl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicId }),
    });

    startPolling(topicId);
  }, [startPolling]);

  return { status, isRunning, startCrawl, stopPolling };
}
