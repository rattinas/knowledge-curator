import type { SourceAdapter, SourceResult, SearchParams } from './types';

export class CustomFeedAdapter implements SourceAdapter {
  readonly sourceType = 'blog' as const; // custom feeds show as blog type
  readonly displayName = 'Custom Feeds';

  isAvailable(): boolean {
    return true;
  }

  async search(params: SearchParams): Promise<SourceResult[]> {
    const feeds = params.customFeeds || [];
    if (feeds.length === 0) return [];

    const results: SourceResult[] = [];

    for (const url of feeds) {
      try {
        if (isRssFeed(url)) {
          const items = await this.fetchRss(url, params);
          results.push(...items);
        } else if (isYouTubeChannel(url)) {
          const items = await this.fetchYouTubeChannel(url, params);
          results.push(...items);
        } else {
          // Treat as single article URL
          const item = await this.fetchArticle(url);
          if (item) results.push(item);
        }
      } catch (e) {
        console.error(`[CustomFeed] Failed to fetch ${url}:`, (e as Error).message);
      }
    }

    return results.slice(0, params.maxResults);
  }

  private async fetchRss(feedUrl: string, params: SearchParams): Promise<SourceResult[]> {
    const RssParser = (await import('rss-parser')).default;
    const parser = new RssParser({ timeout: 15000 });
    const feed = await parser.parseURL(feedUrl);

    return (feed.items || []).slice(0, 10).map(item => ({
      sourceType: 'blog' as const,
      sourceId: Buffer.from(item.link || item.guid || item.title || '').toString('base64').slice(0, 64),
      title: item.title || 'Untitled',
      author: item.creator || item.author || feed.title || null,
      url: item.link || feedUrl,
      publishedAt: item.isoDate || item.pubDate || null,
      contentText: item.contentSnippet || item.content?.replace(/<[^>]+>/g, ' ').slice(0, 5000) || null,
      contentLength: item.content?.length || 0,
      metadata: {
        feedTitle: feed.title,
        feedUrl,
        isCustomFeed: true,
        categories: item.categories,
      },
    }));
  }

  private async fetchYouTubeChannel(channelUrl: string, params: SearchParams): Promise<SourceResult[]> {
    // Extract channel ID or handle from URL
    const match = channelUrl.match(/(?:channel\/|@)([\w-]+)/);
    if (!match) return [];

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return [];

    const handle = match[1];
    // Search videos from this channel
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=&channelId=${handle}&order=date&key=${apiKey}`;

    try {
      const res = await fetch(searchUrl);
      if (!res.ok) {
        // Try as channel name search
        const altUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(handle)}&order=date&key=${apiKey}`;
        const altRes = await fetch(altUrl);
        if (!altRes.ok) return [];
        const data = await altRes.json();
        return this.parseYouTubeResults(data, channelUrl);
      }
      const data = await res.json();
      return this.parseYouTubeResults(data, channelUrl);
    } catch {
      return [];
    }
  }

  private parseYouTubeResults(data: any, sourceUrl: string): SourceResult[] {
    return (data.items || []).map((item: any) => ({
      sourceType: 'youtube' as const,
      sourceId: item.id?.videoId || item.id,
      title: item.snippet?.title || 'Untitled',
      author: item.snippet?.channelTitle || null,
      url: `https://www.youtube.com/watch?v=${item.id?.videoId || item.id}`,
      publishedAt: item.snippet?.publishedAt || null,
      contentText: null,
      contentLength: null,
      metadata: {
        channelId: item.snippet?.channelId,
        description: item.snippet?.description,
        isCustomFeed: true,
        sourceUrl,
      },
    }));
  }

  private async fetchArticle(url: string): Promise<SourceResult | null> {
    try {
      const { extract } = await import('@extractus/article-extractor');
      const article = await extract(url);
      if (!article) return null;

      return {
        sourceType: 'blog' as const,
        sourceId: Buffer.from(url).toString('base64').slice(0, 64),
        title: article.title || url,
        author: article.author || null,
        url,
        publishedAt: article.published || null,
        contentText: article.content?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null,
        contentLength: article.content?.length || 0,
        metadata: {
          isCustomFeed: true,
          description: article.description,
        },
      };
    } catch {
      return null;
    }
  }

  async extractContent(result: SourceResult): Promise<string | null> {
    if (result.sourceType === 'youtube') {
      try {
        const { YoutubeTranscript } = await import('youtube-transcript');
        const videoId = result.url.match(/v=([\w-]+)/)?.[1] || result.sourceId;
        const transcript = await YoutubeTranscript.fetchTranscript(videoId);
        if (transcript?.length > 0) {
          return transcript.map((t: any) => t.text).join(' ');
        }
      } catch { /* fall through */ }
    }
    // For articles, try article extractor
    if (!result.contentText && result.url) {
      try {
        const { extract } = await import('@extractus/article-extractor');
        const article = await extract(result.url);
        return article?.content?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null;
      } catch { /* fall through */ }
    }
    return result.contentText;
  }
}

function isRssFeed(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes('/feed') || lower.includes('/rss') || lower.includes('.xml') || lower.includes('atom');
}

function isYouTubeChannel(url: string): boolean {
  return url.includes('youtube.com/') || url.includes('youtu.be/');
}
