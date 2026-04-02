export interface SourceResult {
  sourceType: 'youtube' | 'arxiv' | 'podcast' | 'blog' | 'news';
  sourceId: string;
  title: string;
  author: string | null;
  url: string;
  publishedAt: string | null;
  contentText: string | null;
  contentLength: number | null;
  metadata: Record<string, unknown>;
}

export interface SearchParams {
  query: string;
  keywords: string[];
  maxResults: number;
  fromDate?: string;
  customFeeds?: string[];
}

export interface SourceAdapter {
  readonly sourceType: SourceResult['sourceType'];
  readonly displayName: string;
  search(params: SearchParams): Promise<SourceResult[]>;
  extractContent?(result: SourceResult): Promise<string | null>;
  isAvailable(): boolean;
}
