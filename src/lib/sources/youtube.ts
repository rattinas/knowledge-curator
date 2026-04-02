import type { SourceAdapter, SourceResult, SearchParams } from './types';
import { getApiKey } from '../db/queries';

export class YouTubeAdapter implements SourceAdapter {
  readonly sourceType = 'youtube' as const;
  readonly displayName = 'YouTube';

  isAvailable(): boolean {
    return !!(process.env.YOUTUBE_API_KEY || getApiKey('youtube'));
  }

  async search(params: SearchParams): Promise<SourceResult[]> {
    const apiKey = process.env.YOUTUBE_API_KEY || getApiKey('youtube');
    if (!apiKey) return [];

    const query = encodeURIComponent(params.query);
    const publishedAfter = params.fromDate
      ? `&publishedAfter=${new Date(params.fromDate).toISOString()}`
      : `&publishedAfter=${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()}`;

    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${params.maxResults}&q=${query}&order=date&relevanceLanguage=en${publishedAfter}&key=${apiKey}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error('YouTube API error:', res.status, await res.text());
        return [];
      }
      const data = await res.json();

      return (data.items || []).map((item: any) => ({
        sourceType: 'youtube' as const,
        sourceId: item.id.videoId,
        title: item.snippet.title,
        author: item.snippet.channelTitle,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        publishedAt: item.snippet.publishedAt,
        contentText: null,
        contentLength: null,
        metadata: {
          channelId: item.snippet.channelId,
          description: item.snippet.description,
          thumbnails: item.snippet.thumbnails,
        },
      }));
    } catch (e) {
      console.error('YouTube search failed:', e);
      return [];
    }
  }

  async extractContent(result: SourceResult): Promise<string | null> {
    try {
      const { YoutubeTranscript } = await import('youtube-transcript');
      const transcript = await YoutubeTranscript.fetchTranscript(result.sourceId);
      if (transcript && transcript.length > 0) {
        return transcript.map((t: any) => t.text).join(' ');
      }
    } catch (e) {
      console.error(`Transcript failed for ${result.sourceId}:`, e);
    }
    return (result.metadata?.description as string) || null;
  }
}
