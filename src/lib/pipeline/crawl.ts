import { getAvailableAdapters } from '../sources/registry';
import { CustomFeedAdapter } from '../sources/custom';
import { batchScoreRelevance } from '../ai/filter';
import { summarizeContent } from '../ai/summarize';
import { assembleDigest } from '../ai/digest';
import {
  insertRawContent,
  getUnscoredContent,
  insertScore,
  getIncludedUnsummarized,
  insertSummary,
  getTodaysSummaries,
  insertDigest,
  createPipelineRun,
  updatePipelineRun,
  getUnextractedContent,
  updateContentText,
  updateLastCrawled,
} from '../db/queries';
import type { Topic, PipelineProgress } from '@/types';

const RELEVANCE_THRESHOLD = 3;
const MAX_RESULTS_PER_SOURCE = 15;

type ProgressCallback = (progress: PipelineProgress) => void;

export async function runPipeline(topic: Topic, onProgress?: ProgressCallback) {
  const runId = createPipelineRun(topic.id);

  const emit = (step: string, progress: number, total: number, message: string, detail?: string, extraData?: Record<string, any>) => {
    updatePipelineRun(runId, { step, step_detail: detail || message, ...extraData } as any);
    onProgress?.({ step, progress, total, message });
  };

  try {
    // ── Step 1: CRAWL ──
    emit('crawl', 0, 1, 'Searching all sources...', 'Initialisiere Source Adapters');
    const adapters = getAvailableAdapters(topic.sources);
    // Add custom feed adapter if topic has custom feeds
    const customFeeds = topic.custom_feeds || [];
    if (customFeeds.length > 0) {
      adapters.push(new CustomFeedAdapter());
    }

    const searchParams = {
      query: topic.name + ' ' + topic.keywords.join(' '),
      keywords: topic.keywords,
      maxResults: MAX_RESULTS_PER_SOURCE,
      fromDate: new Date(Date.now() - (topic.recency_days || 30) * 24 * 60 * 60 * 1000).toISOString(),
      customFeeds,
    };

    const searchPromises = adapters.map(adapter =>
      adapter.search(searchParams).catch(e => {
        console.error(`${adapter.displayName} failed:`, e);
        return [];
      })
    );

    const searchResults = await Promise.allSettled(searchPromises);
    let totalFound = 0;

    for (let i = 0; i < searchResults.length; i++) {
      const result = searchResults[i];
      const adapterName = adapters[i]?.displayName || 'unknown';
      if (result.status === 'fulfilled') {
        console.log(`[Pipeline] ${adapterName}: ${result.value.length} results`);
        for (const item of result.value) {
          try {
            const inserted = insertRawContent({
              topic_id: topic.id,
              source_type: item.sourceType,
              source_id: item.sourceId,
              title: item.title,
              author: item.author,
              url: item.url,
              published_at: item.publishedAt,
              content_text: item.contentText,
              content_length: item.contentLength,
              metadata: item.metadata,
            });
            if (inserted) totalFound++;
          } catch (insertErr) {
            console.error(`[Pipeline] Insert failed for "${item.title}":`, insertErr);
          }
        }
      }
    }

    emit('crawl', 1, 1, `Found ${totalFound} new items across ${adapters.length} sources`, `${totalFound} neue Inhalte aus ${adapters.length} Quellen`, { items_found: totalFound });

    // ── Step 2: EXTRACT ──
    emit('extract', 0, 1, 'Extracting content...', 'Lade Transkripte und Artikel-Texte');
    const unextracted = getUnextractedContent(topic.id);
    let extracted = 0;

    for (const item of unextracted) {
      const adapter = adapters.find(a => a.sourceType === item.source_type);
      if (adapter?.extractContent) {
        try {
          const sourceResult = {
            sourceType: item.source_type,
            sourceId: item.source_id,
            title: item.title,
            author: item.author,
            url: item.url,
            publishedAt: item.published_at,
            contentText: item.content_text,
            contentLength: item.content_length,
            metadata: item.metadata ? JSON.parse(item.metadata) : {},
          };
          const text = await adapter.extractContent(sourceResult);
          if (text) {
            updateContentText(item.id, text.slice(0, 50000));
            extracted++;
          }
        } catch (e) {
          console.error(`Extract failed for ${item.id}:`, e);
        }
      }
      emit('extract', extracted, unextracted.length, `Extracted ${extracted}/${unextracted.length}`, `${item.source_type}: ${item.title?.slice(0, 50)}`);
    }

    // ── Step 3: FILTER (Haiku) ──
    emit('filter', 0, 1, 'AI is scoring relevance...', 'Claude Opus bewertet Relevanz jedes Artikels');
    const unscored = getUnscoredContent(topic.id);
    const scores = await batchScoreRelevance(
      unscored.map(r => ({ id: r.id, title: r.title, content_text: r.content_text })),
      topic.name,
      topic.keywords
    );

    let included = 0;
    let totalTokens = 0;
    for (const score of scores) {
      const isIncluded = score.relevance_score >= RELEVANCE_THRESHOLD;
      if (isIncluded) included++;
      totalTokens += score.tokens_used;
      insertScore({
        raw_content_id: score.id,
        relevance_score: score.relevance_score,
        category: score.category,
        reasoning: score.reasoning,
        is_included: isIncluded,
        tokens_used: score.tokens_used,
      });
    }

    emit('filter', 1, 1, `${included}/${scores.length} items passed relevance filter`, `${included} von ${scores.length} als relevant eingestuft`, {
      items_scored: scores.length,
      items_included: included,
      total_tokens: totalTokens,
    });

    // ── Step 4: SUMMARIZE (Sonnet) ──
    emit('summarize', 0, included, 'Creating summaries...');
    const toSummarize = getIncludedUnsummarized(topic.id);
    let summarized = 0;

    for (const item of toSummarize) {
      try {
        const result = await summarizeContent(
          item.title,
          item.content_text || item.title,
          item.source_type,
          topic.name,
          topic.output_language || 'de'
        );
        insertSummary({
          raw_content_id: item.id,
          topic_id: topic.id,
          summary_text: result.summary_text,
          key_insights: result.key_insights,
          reading_time_min: result.reading_time_min,
          model_used: 'claude-opus-4-6',
          tokens_used: result.tokens_used,
        });
        totalTokens += result.tokens_used;
        summarized++;
        emit('summarize', summarized, toSummarize.length, `Summarized ${summarized}/${toSummarize.length}`, `Claude Opus: "${item.title?.slice(0, 50)}"`, {
          items_summarized: summarized,
          total_tokens: totalTokens,
        });
      } catch (e) {
        console.error(`Summarize failed for ${item.id}:`, e);
      }
    }

    // (counters already updated per-item in emit above)

    // ── Step 5: ASSEMBLE DIGEST ──
    emit('assemble', 0, 1, 'Assembling daily digest...');
    const todaysSummaries = getTodaysSummaries(topic.id);

    if (todaysSummaries.length === 0) {
      emit('assemble', 1, 1, 'No summaries to assemble into digest');
      updatePipelineRun(runId, {
        status: 'completed',
        completed_at: new Date().toISOString(),
      });
      return { runId, digestId: null };
    }

    const digest = await assembleDigest(
      topic.name,
      todaysSummaries.map(s => ({
        ...s,
        summary_id: s.id,
        key_insights: s.key_insights,
      })),
      topic.output_language || 'de'
    );

    const costPerInputToken = 0.000003;
    const costPerOutputToken = 0.000015;
    const estimatedCost = totalTokens * ((costPerInputToken + costPerOutputToken) / 2);

    const digestId = insertDigest({
      topic_id: topic.id,
      digest_date: new Date().toISOString().split('T')[0],
      title: digest.title,
      intro_text: digest.intro_text,
      sections: digest.sections,
      total_sources: todaysSummaries.length,
      total_reading_min: digest.total_reading_min,
      metadata: { totalTokens, estimatedCost, runId },
    });

    updatePipelineRun(runId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      estimated_cost: estimatedCost,
      total_tokens: totalTokens,
    });

    emit('assemble', 1, 1, `Digest ready! ${todaysSummaries.length} sources, ~${digest.total_reading_min}min read`, `Digest mit ${todaysSummaries.length} Quellen erstellt`, {
      estimated_cost: estimatedCost,
      total_tokens: totalTokens,
    });

    // Mark topic as crawled
    updateLastCrawled(topic.id);

    return { runId, digestId };
  } catch (e) {
    const msg = (e as Error).message;
    updatePipelineRun(runId, { status: 'failed', error_message: msg });
    emit('error', 0, 0, `Pipeline failed: ${msg}`);
    throw e;
  }
}
