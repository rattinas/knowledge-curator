import { getAI } from './client';
import { z } from 'zod';

const ScoreSchema = z.object({
  relevance_score: z.number().min(0).max(10),
  category: z.enum(['research', 'tutorial', 'news', 'opinion', 'tool', 'other']),
  reasoning: z.string(),
});

export async function scoreRelevance(
  title: string,
  contentExcerpt: string,
  topicName: string,
  keywords: string[]
): Promise<{ relevance_score: number; category: string; reasoning: string; tokens_used: number }> {
  const ai = getAI();
  const prompt = `You are a generous content relevance scorer for a knowledge curation tool. Rate how relevant this content is to the topic "${topicName}" (keywords: ${keywords.join(', ')}).

Be GENEROUS with scoring. If the content is even tangentially related to the topic, the industry, or could provide useful context, give it at least a 4-5. Only give 0-2 for completely unrelated content.

Scoring guide:
- 8-10: Directly about the topic
- 5-7: Related to the topic or industry
- 3-4: Tangentially related, could provide useful context
- 0-2: Completely unrelated

Title: ${title}
Content excerpt: ${contentExcerpt.slice(0, 1500)}

Respond ONLY with valid JSON, no other text:
{"relevance_score": <number 0-10>, "category": "<research|tutorial|news|opinion|tool|other>", "reasoning": "<one sentence>"}`;

  const response = await ai.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in Haiku response');

  const parsed = ScoreSchema.parse(JSON.parse(jsonMatch[0]));
  const tokens = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

  return { ...parsed, tokens_used: tokens };
}

export async function batchScoreRelevance(
  items: Array<{ id: string; title: string; content_text: string | null }>,
  topicName: string,
  keywords: string[]
): Promise<Array<{ id: string; relevance_score: number; category: string; reasoning: string; tokens_used: number }>> {
  const results = [];
  for (const item of items) {
    try {
      const score = await scoreRelevance(
        item.title,
        item.content_text || item.title,
        topicName,
        keywords
      );
      results.push({ id: item.id, ...score });
    } catch (e) {
      console.error(`[Filter] Scoring failed for "${item.title}":`, (e as Error).message);
      results.push({
        id: item.id,
        relevance_score: 0,
        category: 'other' as const,
        reasoning: `Scoring failed: ${(e as Error).message}`,
        tokens_used: 0,
      });
    }
  }
  return results;
}
