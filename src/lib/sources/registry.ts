import type { SourceAdapter } from './types';
import { YouTubeAdapter } from './youtube';
import { ArxivAdapter } from './arxiv';
import { PodcastAdapter } from './podcasts';
import { BlogAdapter } from './blogs';
import { NewsAdapter } from './news';
import { PerplexityAdapter } from './perplexity';

const adapters: SourceAdapter[] = [
  new PerplexityAdapter(),
  new YouTubeAdapter(),
  new ArxivAdapter(),
  new PodcastAdapter(),
  new BlogAdapter(),
  new NewsAdapter(),
];

export function getAvailableAdapters(sourceFilter?: string[]): SourceAdapter[] {
  if (!sourceFilter || sourceFilter.includes('all')) {
    return adapters.filter(a => a.isAvailable());
  }
  return adapters.filter(a => sourceFilter.includes(a.sourceType) && a.isAvailable());
}

export function getAllAdapters(): SourceAdapter[] {
  return adapters;
}
