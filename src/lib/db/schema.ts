import type Database from 'better-sqlite3';

export function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS topics (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      keywords    TEXT NOT NULL,
      sources     TEXT NOT NULL DEFAULT '["all"]',
      is_active   INTEGER NOT NULL DEFAULT 1,
      reading_time_min INTEGER NOT NULL DEFAULT 60,
      languages   TEXT NOT NULL DEFAULT '["all"]',
      output_language TEXT NOT NULL DEFAULT 'de',
      recency_days INTEGER NOT NULL DEFAULT 30,
      crawl_interval_hours INTEGER NOT NULL DEFAULT 24,
      custom_feeds TEXT NOT NULL DEFAULT '[]',
      last_crawled_at TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS raw_content (
      id              TEXT PRIMARY KEY,
      topic_id        TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      source_type     TEXT NOT NULL,
      source_id       TEXT NOT NULL,
      title           TEXT NOT NULL,
      author          TEXT,
      url             TEXT NOT NULL,
      published_at    TEXT,
      content_text    TEXT,
      content_length  INTEGER,
      metadata        TEXT,
      fetched_at      TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(source_type, source_id, topic_id)
    );

    CREATE TABLE IF NOT EXISTS content_scores (
      id              TEXT PRIMARY KEY,
      raw_content_id  TEXT NOT NULL UNIQUE REFERENCES raw_content(id) ON DELETE CASCADE,
      relevance_score REAL NOT NULL,
      category        TEXT,
      reasoning       TEXT,
      is_included     INTEGER NOT NULL DEFAULT 0,
      scored_at       TEXT NOT NULL DEFAULT (datetime('now')),
      tokens_used     INTEGER
    );

    CREATE TABLE IF NOT EXISTS summaries (
      id              TEXT PRIMARY KEY,
      raw_content_id  TEXT NOT NULL UNIQUE REFERENCES raw_content(id) ON DELETE CASCADE,
      topic_id        TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      summary_text    TEXT NOT NULL,
      key_insights    TEXT,
      reading_time_min INTEGER,
      model_used      TEXT NOT NULL,
      tokens_used     INTEGER,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS digests (
      id              TEXT PRIMARY KEY,
      topic_id        TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      digest_date     TEXT NOT NULL,
      title           TEXT NOT NULL,
      intro_text      TEXT,
      sections        TEXT NOT NULL,
      total_sources   INTEGER NOT NULL DEFAULT 0,
      total_reading_min INTEGER NOT NULL DEFAULT 0,
      metadata        TEXT,
      sent_via_telegram INTEGER NOT NULL DEFAULT 0,
      sent_at         TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(topic_id, digest_date)
    );

    CREATE TABLE IF NOT EXISTS digest_items (
      digest_id       TEXT NOT NULL REFERENCES digests(id) ON DELETE CASCADE,
      summary_id      TEXT NOT NULL REFERENCES summaries(id) ON DELETE CASCADE,
      section_order   INTEGER NOT NULL,
      source_type     TEXT NOT NULL,
      PRIMARY KEY (digest_id, summary_id)
    );

    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id              TEXT PRIMARY KEY,
      topic_id        TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      status          TEXT NOT NULL DEFAULT 'running',
      step            TEXT,
      step_detail     TEXT,
      items_found     INTEGER DEFAULT 0,
      items_scored    INTEGER DEFAULT 0,
      items_included  INTEGER DEFAULT 0,
      items_summarized INTEGER DEFAULT 0,
      total_tokens    INTEGER DEFAULT 0,
      estimated_cost  REAL DEFAULT 0.0,
      error_message   TEXT,
      started_at      TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at    TEXT
    );

    CREATE TABLE IF NOT EXISTS notification_settings (
      id          TEXT PRIMARY KEY,
      channel     TEXT NOT NULL DEFAULT 'telegram',
      bot_token   TEXT,
      chat_id     TEXT,
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id          TEXT PRIMARY KEY,
      service     TEXT NOT NULL UNIQUE,
      api_key     TEXT NOT NULL,
      api_secret  TEXT,
      is_valid    INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_raw_topic       ON raw_content(topic_id, fetched_at DESC);
    CREATE INDEX IF NOT EXISTS idx_raw_source      ON raw_content(source_type, source_id);
    CREATE INDEX IF NOT EXISTS idx_scores_included ON content_scores(is_included) WHERE is_included = 1;
    CREATE INDEX IF NOT EXISTS idx_summaries_topic ON summaries(topic_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_digests_date    ON digests(topic_id, digest_date DESC);
    CREATE INDEX IF NOT EXISTS idx_runs_status     ON pipeline_runs(topic_id, status);
  `);
}
