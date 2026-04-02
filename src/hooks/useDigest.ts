'use client';
import useSWR from 'swr';
import type { Digest } from '@/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useDigest(topicId?: string) {
  const url = topicId ? `/api/digest?topicId=${topicId}` : '/api/digest';
  const { data, error, mutate } = useSWR<Digest | null>(url, fetcher);
  return { digest: data, isLoading: !error && data === undefined, error, mutate };
}

export function useDigestById(id: string) {
  const { data, error } = useSWR<Digest>(`/api/digest/${id}`, fetcher);
  return { digest: data, isLoading: !error && !data, error };
}

export function useDigestHistory(topicId?: string) {
  const url = topicId ? `/api/history?topicId=${topicId}` : '/api/history';
  const { data, error, mutate } = useSWR<Digest[]>(url, fetcher);
  return { digests: data || [], isLoading: !error && !data, error, mutate };
}
