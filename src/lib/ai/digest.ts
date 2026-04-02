import { getAI } from './client';
import { z } from 'zod';
import type { DigestSection } from '@/types';

const DigestSchema = z.object({
  title: z.string(),
  intro: z.string(),
  themes: z.array(z.string()),
});

const sourceLabelsByLang: Record<string, Record<string, string>> = {
  de: { youtube: 'Video-Einblicke', arxiv: 'Forschung & Papers', podcast: 'Podcast-Highlights', blog: 'Blog-Beitraege', news: 'Aktuelle Nachrichten', custom: 'Eigene Quellen' },
  en: { youtube: 'Video Insights', arxiv: 'Research & Papers', podcast: 'Podcast Highlights', blog: 'Blog Posts', news: 'Latest News', custom: 'Custom Sources' },
  es: { youtube: 'Videos', arxiv: 'Investigacion', podcast: 'Podcasts', blog: 'Blogs', news: 'Noticias', custom: 'Fuentes propias' },
  fr: { youtube: 'Videos', arxiv: 'Recherche', podcast: 'Podcasts', blog: 'Blogs', news: 'Actualites', custom: 'Sources perso' },
};

export async function assembleDigest(
  topicName: string,
  summaries: Array<{
    title: string;
    author: string | null;
    url: string;
    source_type: string;
    summary_text: string;
    key_insights: string;
    relevance_score: number;
    reading_time_min: number;
    summary_id: string;
  }>,
  outputLanguage = 'de'
): Promise<{ title: string; intro_text: string; sections: DigestSection[]; total_reading_min: number }> {
  const ai = getAI();

  const sourceSummaries = summaries.map((s, i) =>
    `[${i + 1}] (${s.source_type}) ${s.title}\nScore: ${s.relevance_score}/10\n${s.summary_text}\nInsights: ${s.key_insights}`
  ).join('\n\n---\n\n');

  const langMap: Record<string, string> = {
    de: 'German', en: 'English', es: 'Spanish', fr: 'French', zh: 'Chinese', ja: 'Japanese',
  };
  const lang = langMap[outputLanguage] || 'German';

  const prompt = `You are assembling a daily knowledge digest about "${topicName}".
Target: ~60 minutes reading time for a busy professional.
IMPORTANT: Write the ENTIRE response in ${lang}.

Here are today's ${summaries.length} curated summaries:

${sourceSummaries}

Create an executive overview in ${lang}. Respond ONLY with JSON:
{
  "title": "<compelling digest title in ${lang}>",
  "intro": "<2-3 paragraph executive summary in ${lang}, ~200 words>",
  "themes": ["<theme in ${lang}>", "<theme in ${lang}>", "<theme in ${lang}>"]
}`;

  const response = await ai.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  let parsed;
  if (!jsonMatch) {
    console.error('[Digest] No JSON found, using fallback. Text:', text.slice(0, 200));
    parsed = { title: topicName + ' Digest', intro: text.slice(0, 500), themes: [] };
  } else {
    try {
      parsed = DigestSchema.parse(JSON.parse(jsonMatch[0]));
    } catch {
      parsed = { title: topicName + ' Digest', intro: text.slice(0, 500), themes: [] };
    }
  }

  // Group summaries by source type
  const grouped = new Map<string, typeof summaries>();
  for (const s of summaries) {
    const group = grouped.get(s.source_type) || [];
    group.push(s);
    grouped.set(s.source_type, group);
  }

  const sourceLabels = sourceLabelsByLang[outputLanguage] || sourceLabelsByLang.en;

  const sections: DigestSection[] = [];
  for (const [type, items] of grouped) {
    sections.push({
      source_type: type as any,
      title: sourceLabels[type] || type,
      items: items.map(s => ({
        summary_id: s.summary_id,
        title: s.title,
        author: s.author,
        url: s.url,
        summary_text: s.summary_text,
        key_insights: typeof s.key_insights === 'string' ? JSON.parse(s.key_insights) : s.key_insights,
        relevance_score: s.relevance_score,
        reading_time_min: s.reading_time_min || 2,
      })),
    });
  }

  const totalReading = summaries.reduce((sum, s) => sum + (s.reading_time_min || 2), 0);

  return {
    title: parsed.title,
    intro_text: parsed.intro,
    sections,
    total_reading_min: totalReading,
  };
}
