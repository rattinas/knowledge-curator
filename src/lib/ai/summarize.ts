import { getAI } from './client';
import { z } from 'zod';

const SummarySchema = z.object({
  summary: z.string(),
  key_insights: z.array(z.string()),
  reading_time_min: z.number(),
});

export async function summarizeContent(
  title: string,
  content: string,
  sourceType: string,
  topicName: string,
  outputLanguage = 'de'
): Promise<{ summary_text: string; key_insights: string[]; reading_time_min: number; tokens_used: number }> {
  const ai = getAI();
  const truncated = content.slice(0, 30000);

  const langMap: Record<string, string> = {
    de: 'German', en: 'English', es: 'Spanish', fr: 'French', zh: 'Chinese', ja: 'Japanese',
  };
  const lang = langMap[outputLanguage] || 'German';

  const prompt = `You are a knowledge curator creating concise, actionable summaries for busy professionals learning about "${topicName}".

IMPORTANT: Write the ENTIRE summary and all key insights in ${lang}.

Source type: ${sourceType}
Title: ${title}

Content:
${truncated}

Create a structured summary that maximizes learning per minute of reading. Write in a direct, engaging style in ${lang}.

Respond ONLY with JSON:
{
  "summary": "<markdown summary in ${lang}, 150-300 words, structured with bold key points>",
  "key_insights": ["<insight 1 in ${lang}>", "<insight 2 in ${lang}>", "<insight 3 in ${lang}>"],
  "reading_time_min": <estimated minutes to read>
}`;

  const response = await ai.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
  const tokens = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

  // Strip code fences
  const text = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '');

  // Try to extract JSON
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  let parsed;
  if (jsonMatch) {
    try {
      // Fix truncated JSON — close any unclosed strings/brackets
      let jsonStr = jsonMatch[0];
      // Count braces to detect truncation
      const openBraces = (jsonStr.match(/\{/g) || []).length;
      const closeBraces = (jsonStr.match(/\}/g) || []).length;
      if (openBraces > closeBraces) {
        // Truncated — try to fix by closing open strings and adding brackets
        if (!jsonStr.endsWith('"')) jsonStr += '"';
        if (jsonStr.includes('"summary"') && !jsonStr.includes('"key_insights"')) {
          jsonStr += ', "key_insights": [], "reading_time_min": 3}';
        } else {
          for (let i = 0; i < openBraces - closeBraces; i++) jsonStr += '}';
        }
      }
      parsed = SummarySchema.parse(JSON.parse(jsonStr));
    } catch (parseErr) {
      console.error('[Summarize] JSON parse failed, extracting text:', (parseErr as Error).message);
      parsed = null;
    }
  }

  // Fallback: extract useful text from whatever Opus returned
  if (!parsed) {
    // Try to extract the summary field value directly
    const summaryMatch = text.match(/"summary"\s*:\s*"([\s\S]*?)(?:"|$)/);
    const insightsMatch = text.match(/"key_insights"\s*:\s*\[([\s\S]*?)(?:\]|$)/);

    const summaryText = summaryMatch
      ? summaryMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')
      : text.replace(/[{}"]/g, '').slice(0, 1500);

    const insights = insightsMatch
      ? insightsMatch[1].match(/"([^"]+)"/g)?.map(s => s.replace(/"/g, '')) || []
      : [];

    return {
      summary_text: summaryText,
      key_insights: insights.length > 0 ? insights : [],
      reading_time_min: 3,
      tokens_used: tokens,
    };
  }

  return {
    summary_text: parsed.summary,
    key_insights: parsed.key_insights,
    reading_time_min: parsed.reading_time_min,
    tokens_used: tokens,
  };
}
