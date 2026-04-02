import { randomBytes } from 'crypto';
import { getDb } from './index';
import type { Topic, RawContent, ContentScore, Summary, Digest, PipelineRun } from '@/types';

function genId(): string {
  return randomBytes(8).toString('hex');
}

// ── Topics ──

export function getAllTopics(): Topic[] {
  const rows = getDb().prepare('SELECT * FROM topics ORDER BY created_at DESC').all() as any[];
  return rows.map(parseTopicRow);
}

export function getActiveTopic(): Topic[] {
  const rows = getDb().prepare('SELECT * FROM topics WHERE is_active = 1 ORDER BY created_at DESC').all() as any[];
  return rows.map(parseTopicRow);
}

export function getTopicById(id: string): Topic | null {
  const row = getDb().prepare('SELECT * FROM topics WHERE id = ?').get(id) as any;
  return row ? parseTopicRow(row) : null;
}

export function createTopic(
  name: string, keywords: string[], sources: string[] = ['all'],
  readingTimeMin = 60, languages: string[] = ['all'],
  outputLanguage = 'de', recencyDays = 30, customFeeds: string[] = [],
  crawlIntervalHours = 24
): Topic {
  const id = genId();
  getDb().prepare(
    'INSERT INTO topics (id, name, keywords, sources, reading_time_min, languages, output_language, recency_days, custom_feeds, crawl_interval_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, name, JSON.stringify(keywords), JSON.stringify(sources), readingTimeMin, JSON.stringify(languages), outputLanguage, recencyDays, JSON.stringify(customFeeds), crawlIntervalHours);
  return getTopicById(id)!;
}

export function updateTopic(id: string, data: Partial<Pick<Topic, 'name' | 'keywords' | 'sources' | 'is_active' | 'reading_time_min' | 'languages' | 'output_language' | 'recency_days' | 'custom_feeds' | 'crawl_interval_hours'>>): Topic {
  const topic = getTopicById(id);
  if (!topic) throw new Error('Topic not found');
  const updates: string[] = [];
  const values: any[] = [];
  if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
  if (data.keywords !== undefined) { updates.push('keywords = ?'); values.push(JSON.stringify(data.keywords)); }
  if (data.sources !== undefined) { updates.push('sources = ?'); values.push(JSON.stringify(data.sources)); }
  if (data.is_active !== undefined) { updates.push('is_active = ?'); values.push(data.is_active ? 1 : 0); }
  if (data.reading_time_min !== undefined) { updates.push('reading_time_min = ?'); values.push(data.reading_time_min); }
  if (data.languages !== undefined) { updates.push('languages = ?'); values.push(JSON.stringify(data.languages)); }
  if (data.output_language !== undefined) { updates.push('output_language = ?'); values.push(data.output_language); }
  if (data.recency_days !== undefined) { updates.push('recency_days = ?'); values.push(data.recency_days); }
  if (data.custom_feeds !== undefined) { updates.push('custom_feeds = ?'); values.push(JSON.stringify(data.custom_feeds)); }
  if (data.crawl_interval_hours !== undefined) { updates.push('crawl_interval_hours = ?'); values.push(data.crawl_interval_hours); }
  updates.push("updated_at = datetime('now')");
  values.push(id);
  getDb().prepare(`UPDATE topics SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return getTopicById(id)!;
}

export function deleteTopic(id: string): void {
  getDb().prepare('DELETE FROM topics WHERE id = ?').run(id);
}

function parseTopicRow(row: any): Topic {
  return {
    ...row,
    keywords: JSON.parse(row.keywords),
    languages: row.languages ? JSON.parse(row.languages) : ['all'],
    reading_time_min: row.reading_time_min || 60,
    sources: JSON.parse(row.sources),
    is_active: !!row.is_active,
    output_language: row.output_language || 'de',
    recency_days: row.recency_days || 30,
    crawl_interval_hours: row.crawl_interval_hours || 24,
    custom_feeds: row.custom_feeds ? JSON.parse(row.custom_feeds) : [],
    last_crawled_at: row.last_crawled_at || null,
  };
}

export function updateLastCrawled(topicId: string): void {
  getDb().prepare("UPDATE topics SET last_crawled_at = datetime('now') WHERE id = ?").run(topicId);
}

export function getTopicsDueForCrawl(): Topic[] {
  const rows = getDb().prepare(`
    SELECT * FROM topics
    WHERE is_active = 1
    AND (
      last_crawled_at IS NULL
      OR datetime(last_crawled_at, '+' || crawl_interval_hours || ' hours') <= datetime('now')
    )
  `).all() as any[];
  return rows.map(parseTopicRow);
}

// ── Notification Settings ──

export function getNotificationSettings(): { bot_token: string; chat_id: string; is_active: boolean } | null {
  const row = getDb().prepare('SELECT * FROM notification_settings WHERE is_active = 1 LIMIT 1').get() as any;
  return row ? { bot_token: row.bot_token, chat_id: row.chat_id, is_active: !!row.is_active } : null;
}

export function upsertNotificationSettings(botToken: string, chatId: string): void {
  const id = genId();
  getDb().prepare(`
    DELETE FROM notification_settings
  `).run();
  getDb().prepare(`
    INSERT INTO notification_settings (id, channel, bot_token, chat_id) VALUES (?, 'telegram', ?, ?)
  `).run(id, botToken, chatId);
}

export function deleteNotificationSettings(): void {
  getDb().prepare('DELETE FROM notification_settings').run();
}

// ── Raw Content ──

export function insertRawContent(data: Omit<RawContent, 'id' | 'fetched_at'>): string | null {
  const id = genId();
  try {
    getDb().prepare(
      `INSERT INTO raw_content (id, topic_id, source_type, source_id, title, author, url, published_at, content_text, content_length, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, data.topic_id, data.source_type, data.source_id, data.title, data.author, data.url, data.published_at, data.content_text, data.content_length, JSON.stringify(data.metadata));
    return id;
  } catch (e: any) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return null;
    throw e;
  }
}

export function getUnextractedContent(topicId: string): any[] {
  return getDb().prepare(
    'SELECT * FROM raw_content WHERE topic_id = ? AND content_text IS NULL'
  ).all(topicId) as any[];
}

export function updateContentText(id: string, text: string): void {
  getDb().prepare(
    'UPDATE raw_content SET content_text = ?, content_length = ? WHERE id = ?'
  ).run(text, text.length, id);
}

export function getUnscoredContent(topicId: string): any[] {
  return getDb().prepare(
    `SELECT rc.* FROM raw_content rc
     LEFT JOIN content_scores cs ON cs.raw_content_id = rc.id
     WHERE rc.topic_id = ? AND cs.id IS NULL AND rc.content_text IS NOT NULL`
  ).all(topicId) as any[];
}

export function insertScore(data: { raw_content_id: string; relevance_score: number; category: string; reasoning: string; is_included: boolean; tokens_used: number }): void {
  const id = genId();
  getDb().prepare(
    `INSERT INTO content_scores (id, raw_content_id, relevance_score, category, reasoning, is_included, tokens_used)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.raw_content_id, data.relevance_score, data.category, data.reasoning, data.is_included ? 1 : 0, data.tokens_used);
}

export function getIncludedUnsummarized(topicId: string): any[] {
  return getDb().prepare(
    `SELECT rc.*, cs.relevance_score, cs.category FROM raw_content rc
     JOIN content_scores cs ON cs.raw_content_id = rc.id
     LEFT JOIN summaries s ON s.raw_content_id = rc.id
     WHERE rc.topic_id = ? AND cs.is_included = 1 AND s.id IS NULL`
  ).all(topicId) as any[];
}

export function insertSummary(data: { raw_content_id: string; topic_id: string; summary_text: string; key_insights: string[]; reading_time_min: number; model_used: string; tokens_used: number }): string {
  const id = genId();
  getDb().prepare(
    `INSERT INTO summaries (id, raw_content_id, topic_id, summary_text, key_insights, reading_time_min, model_used, tokens_used)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.raw_content_id, data.topic_id, data.summary_text, JSON.stringify(data.key_insights), data.reading_time_min, data.model_used, data.tokens_used);
  return id;
}

export function getTodaysSummaries(topicId: string): any[] {
  return getDb().prepare(
    `SELECT s.*, rc.title, rc.author, rc.url, rc.source_type, rc.published_at, cs.relevance_score
     FROM summaries s
     JOIN raw_content rc ON rc.id = s.raw_content_id
     JOIN content_scores cs ON cs.raw_content_id = rc.id
     WHERE s.topic_id = ? AND date(s.created_at) = date('now')
     ORDER BY cs.relevance_score DESC`
  ).all(topicId) as any[];
}

export function insertDigest(data: { topic_id: string; digest_date: string; title: string; intro_text: string; sections: any; total_sources: number; total_reading_min: number; metadata: any }): string {
  // Delete existing digest for same topic+date (allows re-crawling same day)
  getDb().prepare('DELETE FROM digests WHERE topic_id = ? AND digest_date = ?').run(data.topic_id, data.digest_date);

  const id = genId();
  getDb().prepare(
    `INSERT INTO digests (id, topic_id, digest_date, title, intro_text, sections, total_sources, total_reading_min, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.topic_id, data.digest_date, data.title, data.intro_text, JSON.stringify(data.sections), data.total_sources, data.total_reading_min, JSON.stringify(data.metadata));
  return id;
}

export function getLatestDigest(topicId: string): Digest | null {
  const row = getDb().prepare(
    'SELECT * FROM digests WHERE topic_id = ? ORDER BY digest_date DESC LIMIT 1'
  ).get(topicId) as any;
  return row ? parseDigestRow(row) : null;
}

export function getDigestById(id: string): Digest | null {
  const row = getDb().prepare('SELECT * FROM digests WHERE id = ?').get(id) as any;
  return row ? parseDigestRow(row) : null;
}

export function getDigestHistory(topicId?: string, limit = 20, offset = 0): Digest[] {
  let query = 'SELECT d.*, t.name as topic_name FROM digests d JOIN topics t ON t.id = d.topic_id';
  const params: any[] = [];
  if (topicId) { query += ' WHERE d.topic_id = ?'; params.push(topicId); }
  query += ' ORDER BY d.digest_date DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  return (getDb().prepare(query).all(...params) as any[]).map(parseDigestRow);
}

export function getDigestsGroupedByTopic(): Record<string, { topic: Topic; digests: Digest[] }> {
  const topics = getAllTopics();
  const result: Record<string, { topic: Topic; digests: Digest[] }> = {};
  for (const topic of topics) {
    const digests = getDigestHistory(topic.id, 10, 0);
    result[topic.id] = { topic, digests };
  }
  return result;
}

export function markDigestSent(digestId: string): void {
  getDb().prepare("UPDATE digests SET sent_via_telegram = 1, sent_at = datetime('now') WHERE id = ?").run(digestId);
}

export function getUnsentDigests(): Digest[] {
  const rows = getDb().prepare(
    `SELECT d.*, t.name as topic_name FROM digests d
     JOIN topics t ON t.id = d.topic_id
     WHERE d.sent_via_telegram = 0
     ORDER BY d.created_at DESC`
  ).all() as any[];
  return rows.map(parseDigestRow);
}

export function getSchedulerStatus(): { topics_total: number; topics_active: number; topics_due: number; last_crawl: string | null; total_digests: number; unsent_digests: number } {
  const total = (getDb().prepare('SELECT count(*) as c FROM topics').get() as any).c;
  const active = (getDb().prepare('SELECT count(*) as c FROM topics WHERE is_active = 1').get() as any).c;
  const due = getTopicsDueForCrawl().length;
  const lastCrawl = (getDb().prepare('SELECT max(last_crawled_at) as lc FROM topics').get() as any).lc;
  const totalDigests = (getDb().prepare('SELECT count(*) as c FROM digests').get() as any).c;
  const unsent = (getDb().prepare('SELECT count(*) as c FROM digests WHERE sent_via_telegram = 0').get() as any).c;
  return { topics_total: total, topics_active: active, topics_due: due, last_crawl: lastCrawl, total_digests: totalDigests, unsent_digests: unsent };
}

function parseDigestRow(row: any): Digest {
  return {
    ...row,
    sections: typeof row.sections === 'string' ? JSON.parse(row.sections) : row.sections,
    metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : {},
    sent_via_telegram: !!row.sent_via_telegram,
    sent_at: row.sent_at || null,
  };
}

// ── Pipeline Runs ──

export function createPipelineRun(topicId: string): string {
  const id = genId();
  getDb().prepare('INSERT INTO pipeline_runs (id, topic_id) VALUES (?, ?)').run(id, topicId);
  return id;
}

export function updatePipelineRun(id: string, data: Partial<PipelineRun>): void {
  const updates: string[] = [];
  const values: any[] = [];
  for (const [key, val] of Object.entries(data)) {
    if (key === 'id') continue;
    updates.push(`${key} = ?`);
    values.push(val);
  }
  values.push(id);
  if (updates.length > 0) {
    getDb().prepare(`UPDATE pipeline_runs SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }
}

export function getLatestPipelineRun(topicId: string): PipelineRun | null {
  return getDb().prepare(
    'SELECT * FROM pipeline_runs WHERE topic_id = ? ORDER BY started_at DESC LIMIT 1'
  ).get(topicId) as PipelineRun | null;
}

// ── API Keys ──

export interface ApiKeyRecord {
  id: string;
  service: string;
  api_key: string;
  api_secret: string | null;
  is_valid: boolean;
  created_at: string;
  updated_at: string;
}

export function getAllApiKeys(): ApiKeyRecord[] {
  const rows = getDb().prepare('SELECT * FROM api_keys ORDER BY service').all() as any[];
  return rows.map(r => ({ ...r, is_valid: !!r.is_valid }));
}

export function getApiKey(service: string): string | null {
  const row = getDb().prepare('SELECT api_key FROM api_keys WHERE service = ? AND is_valid = 1').get(service) as any;
  return row?.api_key || null;
}

export function getApiKeyWithSecret(service: string): { key: string; secret: string | null } | null {
  const row = getDb().prepare('SELECT api_key, api_secret FROM api_keys WHERE service = ? AND is_valid = 1').get(service) as any;
  return row ? { key: row.api_key, secret: row.api_secret } : null;
}

export function upsertApiKey(service: string, apiKey: string, apiSecret?: string): void {
  const id = genId();
  getDb().prepare(
    `INSERT INTO api_keys (id, service, api_key, api_secret) VALUES (?, ?, ?, ?)
     ON CONFLICT(service) DO UPDATE SET api_key = excluded.api_key, api_secret = excluded.api_secret, updated_at = datetime('now')`
  ).run(id, service, apiKey, apiSecret || null);
  // Also set in process.env for current session
  const envMap: Record<string, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    youtube: 'YOUTUBE_API_KEY',
    gnews: 'GNEWS_API_KEY',
    podcast_index_key: 'PODCAST_INDEX_KEY',
    podcast_index_secret: 'PODCAST_INDEX_SECRET',
    perplexity: 'PERPLEXITY_API_KEY',
  };
  if (envMap[service]) process.env[envMap[service]] = apiKey;
  if (apiSecret && service === 'podcast_index') process.env.PODCAST_INDEX_SECRET = apiSecret;
}

export function deleteApiKey(service: string): void {
  getDb().prepare('DELETE FROM api_keys WHERE service = ?').run(service);
}

// Load all API keys from DB into process.env at startup
export function loadApiKeysIntoEnv(): void {
  const keys = getAllApiKeys();
  const envMap: Record<string, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    youtube: 'YOUTUBE_API_KEY',
    gnews: 'GNEWS_API_KEY',
    podcast_index: 'PODCAST_INDEX_KEY',
    perplexity: 'PERPLEXITY_API_KEY',
  };
  for (const k of keys) {
    if (k.is_valid && envMap[k.service]) {
      process.env[envMap[k.service]] = k.api_key;
    }
    if (k.service === 'podcast_index' && k.api_secret) {
      process.env.PODCAST_INDEX_SECRET = k.api_secret;
    }
  }
}
