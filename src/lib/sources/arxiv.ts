import { XMLParser } from 'fast-xml-parser';
import type { SourceAdapter, SourceResult, SearchParams } from './types';

export class ArxivAdapter implements SourceAdapter {
  readonly sourceType = 'arxiv' as const;
  readonly displayName = 'Research Papers';

  isAvailable(): boolean {
    return true;
  }

  async search(params: SearchParams): Promise<SourceResult[]> {
    const query = encodeURIComponent(params.query);
    const url = `https://export.arxiv.org/api/query?search_query=all:${query}&start=0&max_results=${params.maxResults}&sortBy=submittedDate&sortOrder=descending`;

    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const xml = await res.text();
      const parser = new XMLParser({ ignoreAttributes: false });
      const data = parser.parse(xml);

      const entries = data.feed?.entry;
      if (!entries) return [];

      const items = Array.isArray(entries) ? entries : [entries];
      return items.map((entry: any) => {
        const authors = Array.isArray(entry.author)
          ? entry.author.map((a: any) => a.name).join(', ')
          : entry.author?.name || null;

        const links = Array.isArray(entry.link) ? entry.link : [entry.link];
        const pdfLink = links.find((l: any) => l?.['@_title'] === 'pdf');
        const absLink = links.find((l: any) => l?.['@_type'] === 'text/html');

        const arxivId = entry.id?.split('/abs/')?.pop() || entry.id;

        return {
          sourceType: 'arxiv' as const,
          sourceId: arxivId,
          title: (entry.title || '').replace(/\n/g, ' ').trim(),
          author: authors,
          url: absLink?.['@_href'] || entry.id,
          publishedAt: entry.published,
          contentText: (entry.summary || '').replace(/\n/g, ' ').trim(),
          contentLength: entry.summary?.length || 0,
          metadata: {
            categories: entry.category,
            pdfUrl: pdfLink?.['@_href'],
            doi: entry['arxiv:doi'],
          },
        };
      });
    } catch (e) {
      console.error('arXiv search failed:', e);
      return [];
    }
  }
}
