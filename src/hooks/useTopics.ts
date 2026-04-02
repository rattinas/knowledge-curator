'use client';
import useSWR from 'swr';
import type { Topic } from '@/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useTopics() {
  const { data, error, mutate } = useSWR<Topic[]>('/api/topics', fetcher);

  const createTopic = async (name: string, keywords: string[], readingTimeMin = 60, languages: string[] = ['all'], outputLanguage = 'de', recencyDays = 30, customFeeds: string[] = [], crawlIntervalHours = 24) => {
    const res = await fetch('/api/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, keywords, reading_time_min: readingTimeMin, languages, output_language: outputLanguage, recency_days: recencyDays, custom_feeds: customFeeds, crawl_interval_hours: crawlIntervalHours }),
    });
    const topic = await res.json();
    mutate();
    return topic;
  };

  const updateTopic = async (id: string, data: Partial<Topic>) => {
    await fetch(`/api/topics/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    mutate();
  };

  const deleteTopic = async (id: string) => {
    await fetch(`/api/topics/${id}`, { method: 'DELETE' });
    mutate();
  };

  return {
    topics: data || [],
    isLoading: !error && !data,
    error,
    createTopic,
    updateTopic,
    deleteTopic,
    mutate,
  };
}
