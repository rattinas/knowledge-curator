import type { SourceAdapter, SourceResult, SearchParams } from './types';
import { getApiKey } from '../db/queries';

export class PerplexityAdapter implements SourceAdapter {
  readonly sourceType = 'news' as const;
  readonly displayName = 'Perplexity Web Search';

  isAvailable(): boolean {
    return !!(process.env.PERPLEXITY_API_KEY || getApiKey('perplexity'));
  }

  async search(params: SearchParams): Promise<SourceResult[]> {
    const apiKey = process.env.PERPLEXITY_API_KEY || getApiKey('perplexity');
    if (!apiKey) return [];

    try {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            {
              role: 'system',
              content: 'You are a research assistant. Find the most recent and relevant content about the given topic. Return structured results with titles, URLs, authors and short descriptions.',
            },
            {
              role: 'user',
              content: `Find the ${params.maxResults} most recent and important articles, videos, podcasts, and discussions about: "${params.query}". Focus on content from the last ${Math.ceil((Date.now() - new Date(params.fromDate || Date.now()).getTime()) / (24*60*60*1000))} days. For each result provide: title, URL, author/source, and a 2-sentence description of what it covers.`,
            },
          ],
          max_tokens: 2000,
          return_citations: true,
          search_recency_filter: getRecencyFilter(params.fromDate),
        }),
      });

      if (!response.ok) {
        console.error('[Perplexity] API error:', response.status, await response.text());
        return [];
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const citations = data.citations || [];

      // Parse citations into SourceResults
      const results: SourceResult[] = citations.map((url: string, i: number) => ({
        sourceType: 'news' as const,
        sourceId: `pplx-${Buffer.from(url).toString('base64').slice(0, 32)}`,
        title: extractTitleFromContent(content, url, i),
        author: extractDomain(url),
        url,
        publishedAt: new Date().toISOString(),
        contentText: extractSnippetForUrl(content, url, i),
        contentLength: null,
        metadata: {
          source: 'perplexity',
          fullResponse: content,
        },
      }));

      return results.slice(0, params.maxResults);
    } catch (e) {
      console.error('[Perplexity] Search failed:', e);
      return [];
    }
  }

  async extractContent(result: SourceResult): Promise<string | null> {
    // Try to extract full article content
    try {
      const { extract } = await import('@extractus/article-extractor');
      const article = await extract(result.url);
      if (article?.content) {
        return article.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }
    } catch { /* fall through */ }

    // Fallback to Perplexity's own content
    return result.contentText || (result.metadata?.fullResponse as string) || null;
  }
}

function getRecencyFilter(fromDate?: string): string {
  if (!fromDate) return 'month';
  const days = Math.ceil((Date.now() - new Date(fromDate).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 1) return 'day';
  if (days <= 7) return 'week';
  if (days <= 30) return 'month';
  return 'year';
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

function extractTitleFromContent(content: string, url: string, index: number): string {
  // Try to find a title near the citation reference
  const lines = content.split('\n').filter(l => l.trim());
  // Look for numbered items or bold text
  for (const line of lines) {
    if (line.includes(`[${index + 1}]`) || line.includes(extractDomain(url))) {
      const clean = line.replace(/\[?\d+\]?/g, '').replace(/\*\*/g, '').replace(/^[-•*]\s*/, '').trim();
      if (clean.length > 10 && clean.length < 200) return clean;
    }
  }
  return `Source ${index + 1}: ${extractDomain(url)}`;
}

function extractSnippetForUrl(content: string, url: string, index: number): string {
  // Return a relevant portion of the Perplexity response
  const parts = content.split(/\[\d+\]/);
  if (parts[index + 1]) {
    return parts[index + 1].trim().slice(0, 500);
  }
  return content.slice(0, 500);
}
