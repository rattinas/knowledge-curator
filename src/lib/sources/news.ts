import type { SourceAdapter, SourceResult, SearchParams } from './types';
import { getApiKey } from '../db/queries';

export class NewsAdapter implements SourceAdapter {
  readonly sourceType = 'news' as const;
  readonly displayName = 'News';

  isAvailable(): boolean {
    return !!(process.env.GNEWS_API_KEY || getApiKey('gnews'));
  }

  async search(params: SearchParams): Promise<SourceResult[]> {
    const apiKey = process.env.GNEWS_API_KEY || getApiKey('gnews');
    if (!apiKey) return [];

    const query = encodeURIComponent(params.query);
    const url = `https://gnews.io/api/v4/search?q=${query}&max=${Math.min(params.maxResults, 10)}&lang=en&sortby=publishedAt&token=${apiKey}`;

    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();

      return (data.articles || []).map((article: any) => ({
        sourceType: 'news' as const,
        sourceId: Buffer.from(article.url).toString('base64').slice(0, 64),
        title: article.title,
        author: article.source?.name || null,
        url: article.url,
        publishedAt: article.publishedAt,
        contentText: article.content || article.description || null,
        contentLength: article.content?.length || 0,
        metadata: {
          source: article.source,
          image: article.image,
          description: article.description,
        },
      }));
    } catch (e) {
      console.error('News search failed:', e);
      return [];
    }
  }

  async extractContent(result: SourceResult): Promise<string | null> {
    try {
      const { extract } = await import('@extractus/article-extractor');
      const article = await extract(result.url);
      return article?.content?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null;
    } catch (e) {
      console.error('Article extraction failed:', e);
      return result.contentText;
    }
  }
}
