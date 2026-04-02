import crypto from 'crypto';
import type { SourceAdapter, SourceResult, SearchParams } from './types';
import { getApiKeyWithSecret } from '../db/queries';

export class PodcastAdapter implements SourceAdapter {
  readonly sourceType = 'podcast' as const;
  readonly displayName = 'Podcasts';

  isAvailable(): boolean {
    if (process.env.PODCAST_INDEX_KEY && process.env.PODCAST_INDEX_SECRET) return true;
    const keys = getApiKeyWithSecret('podcast_index');
    return !!(keys?.key && keys?.secret);
  }

  async search(params: SearchParams): Promise<SourceResult[]> {
    let apiKey = process.env.PODCAST_INDEX_KEY;
    let apiSecret = process.env.PODCAST_INDEX_SECRET;
    if (!apiKey || !apiSecret) {
      const keys = getApiKeyWithSecret('podcast_index');
      if (keys) { apiKey = keys.key; apiSecret = keys.secret || ''; }
    }
    if (!apiKey || !apiSecret) return [];

    const now = Math.floor(Date.now() / 1000);
    const authHash = crypto
      .createHash('sha1')
      .update(apiKey + apiSecret + now)
      .digest('hex');

    const query = encodeURIComponent(params.query);
    const url = `https://api.podcastindex.org/api/1.0/search/byterm?q=${query}&max=${params.maxResults}`;

    try {
      const res = await fetch(url, {
        headers: {
          'X-Auth-Key': apiKey,
          'X-Auth-Date': String(now),
          'Authorization': authHash,
          'User-Agent': 'KnowledgeCurator/1.0',
        },
      });

      if (!res.ok) return [];
      const data = await res.json();

      return (data.feeds || []).slice(0, params.maxResults).map((feed: any) => ({
        sourceType: 'podcast' as const,
        sourceId: String(feed.id),
        title: feed.title,
        author: feed.author || feed.ownerName,
        url: feed.link || feed.url,
        publishedAt: feed.newestItemPublishTime
          ? new Date(feed.newestItemPublishTime * 1000).toISOString()
          : null,
        contentText: feed.description || null,
        contentLength: feed.description?.length || 0,
        metadata: {
          feedUrl: feed.url,
          image: feed.image,
          language: feed.language,
          episodeCount: feed.episodeCount,
          categories: feed.categories,
        },
      }));
    } catch (e) {
      console.error('Podcast search failed:', e);
      return [];
    }
  }

  async extractContent(result: SourceResult): Promise<string | null> {
    // Strategy: Find the podcast episode on YouTube and grab the transcript
    const transcript = await findYouTubeTranscript(result.title, result.author);
    if (transcript) {
      console.log(`[Podcast] Found YouTube transcript for "${result.title}"`);
      return transcript;
    }

    // Fallback: If podcast has an RSS feed, get episode descriptions
    const feedUrl = result.metadata?.feedUrl as string;
    if (feedUrl) {
      try {
        const RssParser = (await import('rss-parser')).default;
        const parser = new RssParser({ timeout: 10000 });
        const feed = await parser.parseURL(feedUrl);
        // Find matching episode or get latest
        const episode = feed.items?.find(item =>
          item.title?.toLowerCase().includes(result.title.toLowerCase().split(' ').slice(0, 3).join(' '))
        ) || feed.items?.[0];

        if (episode) {
          const desc = episode.contentSnippet || episode.content?.replace(/<[^>]+>/g, ' ') || '';
          if (desc.length > 100) return desc;
        }
      } catch { /* ignore RSS errors */ }
    }

    return result.contentText;
  }
}

/**
 * Search YouTube for a podcast episode and extract the transcript.
 * Most podcasts are also uploaded to YouTube — free transcripts!
 */
async function findYouTubeTranscript(title: string, author: string | null): Promise<string | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;

  // Build search query: podcast name + episode title
  const searchQuery = author
    ? `${author} ${title} podcast`
    : `${title} podcast`;

  try {
    const q = encodeURIComponent(searchQuery);
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=3&q=${q}&order=relevance&key=${apiKey}`;

    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    const videos = data.items || [];
    if (videos.length === 0) return null;

    // Try each video until we find one with a transcript
    const { YoutubeTranscript } = await import('youtube-transcript');

    for (const video of videos) {
      const videoId = video.id?.videoId;
      if (!videoId) continue;

      try {
        const transcript = await YoutubeTranscript.fetchTranscript(videoId);
        if (transcript && transcript.length > 10) {
          const text = transcript.map((t: any) => t.text).join(' ');
          if (text.length > 200) {
            console.log(`[Podcast→YouTube] Found transcript: "${video.snippet?.title}" (${videoId})`);
            return text;
          }
        }
      } catch {
        // No transcript for this video, try next
        continue;
      }
    }

    return null;
  } catch (e) {
    console.error('[Podcast→YouTube] Search failed:', e);
    return null;
  }
}

/**
 * Parse a Spotify URL and extract episode/show info
 */
export function parseSpotifyUrl(url: string): { type: 'episode' | 'show'; id: string } | null {
  // https://open.spotify.com/episode/ABC123
  // https://open.spotify.com/show/XYZ456
  const match = url.match(/open\.spotify\.com\/(episode|show)\/([a-zA-Z0-9]+)/);
  if (!match) return null;
  return { type: match[1] as 'episode' | 'show', id: match[2] };
}
