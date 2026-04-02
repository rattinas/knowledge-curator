import type { SourceAdapter, SourceResult, SearchParams } from './types';

const DEFAULT_FEEDS = [
  'https://blog.google/technology/ai/rss/',
  'https://openai.com/index/rss/',
  'https://about.fb.com/news/feed/',
  'https://deepmind.google/blog/rss.xml',
  'https://huggingface.co/blog/feed.xml',
  'https://lilianweng.github.io/index.xml',
  'https://simonwillison.net/atom/everything/',
  'https://www.anthropic.com/feed.xml',
  'https://techcrunch.com/category/artificial-intelligence/feed/',
];

export class BlogAdapter implements SourceAdapter {
  readonly sourceType = 'blog' as const;
  readonly displayName = 'Blogs';

  isAvailable(): boolean {
    return true;
  }

  async search(params: SearchParams): Promise<SourceResult[]> {
    const results: SourceResult[] = [];
    const RssParser = (await import('rss-parser')).default;
    const parser = new RssParser({ timeout: 10000 });

    const keywords = params.keywords.map(k => k.toLowerCase());
    const queryTerms = params.query.toLowerCase().split(/\s+/);

    const feedPromises = DEFAULT_FEEDS.map(async (feedUrl) => {
      try {
        const feed = await parser.parseURL(feedUrl);
        const items = (feed.items || []).filter(item => {
          const text = `${item.title || ''} ${item.contentSnippet || ''} ${item.content || ''}`.toLowerCase();
          return [...keywords, ...queryTerms].some(term => text.includes(term));
        });

        return items.slice(0, 5).map(item => ({
          sourceType: 'blog' as const,
          sourceId: Buffer.from(item.link || item.guid || item.title || '').toString('base64').slice(0, 64),
          title: item.title || 'Untitled',
          author: item.creator || item.author || feed.title || null,
          url: item.link || '',
          publishedAt: item.isoDate || item.pubDate || null,
          contentText: item.contentSnippet || item.content?.replace(/<[^>]+>/g, ' ').slice(0, 5000) || null,
          contentLength: item.content?.length || 0,
          metadata: {
            feedTitle: feed.title,
            feedUrl,
            categories: item.categories,
          },
        }));
      } catch (e) {
        console.error(`Feed failed: ${feedUrl}`, e);
        return [];
      }
    });

    const feedResults = await Promise.allSettled(feedPromises);
    for (const result of feedResults) {
      if (result.status === 'fulfilled') {
        results.push(...result.value);
      }
    }

    return results.slice(0, params.maxResults);
  }

  async extractContent(result: SourceResult): Promise<string | null> {
    try {
      const { extract } = await import('@extractus/article-extractor');
      const article = await extract(result.url);
      return article?.content?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null;
    } catch (e) {
      return result.contentText;
    }
  }
}
