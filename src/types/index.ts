export interface Topic {
  id: string;
  name: string;
  keywords: string[];
  sources: string[];
  is_active: boolean;
  reading_time_min: number; // Target reading time: 15, 30, 60, 90, 120
  languages: string[]; // e.g. ["en", "de", "all"]
  output_language: string; // Digest output language: "de", "en", "es", "fr", "zh", "ja"
  recency_days: number; // Max age of content: 1, 3, 7, 14, 30, 90, 365
  crawl_interval_hours: number; // How often to crawl: 12, 24, 48, 72, 168
  custom_feeds: string[]; // Manually added RSS/YouTube/URL sources
  last_crawled_at: string | null; // When was this topic last crawled
  created_at: string;
  updated_at: string;
}

export interface RawContent {
  id: string;
  topic_id: string;
  source_type: SourceType;
  source_id: string;
  title: string;
  author: string | null;
  url: string;
  published_at: string | null;
  content_text: string | null;
  content_length: number | null;
  metadata: Record<string, unknown>;
  fetched_at: string;
}

export interface ContentScore {
  id: string;
  raw_content_id: string;
  relevance_score: number;
  category: ContentCategory;
  reasoning: string;
  is_included: boolean;
  scored_at: string;
  tokens_used: number;
}

export interface Summary {
  id: string;
  raw_content_id: string;
  topic_id: string;
  summary_text: string;
  key_insights: string[];
  reading_time_min: number;
  model_used: string;
  tokens_used: number;
  created_at: string;
}

export interface Digest {
  id: string;
  topic_id: string;
  topic_name?: string;
  digest_date: string;
  title: string;
  intro_text: string;
  sections: DigestSection[];
  total_sources: number;
  total_reading_min: number;
  metadata: Record<string, unknown>;
  sent_via_telegram: boolean;
  sent_at: string | null;
  created_at: string;
}

export interface DigestSection {
  source_type: SourceType;
  title: string;
  items: DigestItem[];
}

export interface DigestItem {
  summary_id: string;
  title: string;
  author: string | null;
  url: string;
  summary_text: string;
  key_insights: string[];
  relevance_score: number;
  reading_time_min: number;
}

export interface PipelineRun {
  id: string;
  topic_id: string;
  status: 'running' | 'completed' | 'failed';
  step: string | null;
  items_found: number;
  items_scored: number;
  items_included: number;
  items_summarized: number;
  total_tokens: number;
  estimated_cost: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export type SourceType = 'youtube' | 'arxiv' | 'podcast' | 'blog' | 'news';
export type ContentCategory = 'research' | 'tutorial' | 'news' | 'opinion' | 'tool' | 'other';

export interface PipelineProgress {
  step: string;
  progress: number;
  total: number;
  message: string;
}
