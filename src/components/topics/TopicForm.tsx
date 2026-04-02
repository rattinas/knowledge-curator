'use client';
import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

const READING_TIME_OPTIONS = [
  { value: 15, label: '15 Min.' },
  { value: 30, label: '30 Min.' },
  { value: 60, label: '1 Stunde' },
  { value: 90, label: '1.5 Stunden' },
  { value: 120, label: '2 Stunden' },
];

const OUTPUT_LANGUAGE_OPTIONS = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Espanol' },
  { value: 'fr', label: 'Francais' },
  { value: 'zh', label: 'Zhongwen' },
  { value: 'ja', label: 'Nihongo' },
];

const LANGUAGE_OPTIONS = [
  { value: 'all', label: 'Alle Sprachen' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Espanol' },
  { value: 'fr', label: 'Francais' },
  { value: 'zh', label: 'Zhongwen' },
  { value: 'ja', label: 'Nihongo' },
];

const RECENCY_OPTIONS = [
  { value: 1, label: '24h' },
  { value: 3, label: '3 Tage' },
  { value: 7, label: '1 Woche' },
  { value: 14, label: '2 Wochen' },
  { value: 30, label: '1 Monat' },
  { value: 90, label: '3 Monate' },
  { value: 365, label: '1 Jahr' },
];

const CRAWL_INTERVAL_OPTIONS = [
  { value: 12, label: '2x taeglich' },
  { value: 24, label: 'Taeglich' },
  { value: 48, label: 'Alle 2 Tage' },
  { value: 72, label: 'Alle 3 Tage' },
  { value: 168, label: 'Woechentlich' },
  { value: 336, label: 'Alle 2 Wochen' },
  { value: 720, label: 'Monatlich' },
];

interface TopicFormProps {
  onSubmit: (name: string, keywords: string[], readingTime: number, languages: string[], outputLanguage: string, recencyDays: number, customFeeds: string[], crawlIntervalHours: number) => Promise<void>;
  onCancel?: () => void;
  initialName?: string;
  initialKeywords?: string[];
  initialReadingTime?: number;
  initialLanguages?: string[];
  initialOutputLanguage?: string;
  initialRecencyDays?: number;
  initialCrawlIntervalHours?: number;
  initialCustomFeeds?: string[];
}

export function TopicForm({
  onSubmit,
  onCancel,
  initialName = '',
  initialKeywords = [],
  initialReadingTime = 60,
  initialLanguages = ['all'],
  initialOutputLanguage = 'de',
  initialRecencyDays = 30,
  initialCustomFeeds = [],
  initialCrawlIntervalHours = 24,
}: TopicFormProps) {
  const [name, setName] = useState(initialName);
  const [keywordsStr, setKeywordsStr] = useState(initialKeywords.join(', '));
  const [readingTime, setReadingTime] = useState(initialReadingTime);
  const [languages, setLanguages] = useState<string[]>(initialLanguages);
  const [outputLanguage, setOutputLanguage] = useState(initialOutputLanguage);
  const [recencyDays, setRecencyDays] = useState(initialRecencyDays);
  const [crawlIntervalHours, setCrawlIntervalHours] = useState(initialCrawlIntervalHours);
  const [customFeeds, setCustomFeeds] = useState<string[]>(initialCustomFeeds);
  const [newFeed, setNewFeed] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleLanguage = (lang: string) => {
    if (lang === 'all') { setLanguages(['all']); return; }
    const withoutAll = languages.filter(l => l !== 'all');
    if (withoutAll.includes(lang)) {
      const next = withoutAll.filter(l => l !== lang);
      setLanguages(next.length === 0 ? ['all'] : next);
    } else {
      setLanguages([...withoutAll, lang]);
    }
  };

  const addFeed = () => {
    const url = newFeed.trim();
    if (url && !customFeeds.includes(url)) {
      setCustomFeeds([...customFeeds, url]);
      setNewFeed('');
    }
  };

  const removeFeed = (url: string) => {
    setCustomFeeds(customFeeds.filter(f => f !== url));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const keywords = keywordsStr.split(',').map(k => k.trim()).filter(Boolean);
    await onSubmit(name.trim(), keywords.length > 0 ? keywords : [name.trim()], readingTime, languages, outputLanguage, recencyDays, customFeeds, crawlIntervalHours);
    setLoading(false);
    setName('');
    setKeywordsStr('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        label="Was moechtest du lernen?"
        placeholder="z.B. Meta Advertising, AI Agents, React..."
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <Input
        label="Keywords (kommagetrennt)"
        placeholder="z.B. Meta Ads, Facebook Ads, Performance Marketing"
        value={keywordsStr}
        onChange={e => setKeywordsStr(e.target.value)}
      />

      {/* Output Language */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Zusammenfassung in welcher Sprache?
        </label>
        <div className="flex flex-wrap gap-2">
          {OUTPUT_LANGUAGE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setOutputLanguage(opt.value)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
                outputLanguage === opt.value
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-muted-light text-muted hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recency */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Wie aktuell sollen die Quellen sein?
        </label>
        <div className="flex flex-wrap gap-2">
          {RECENCY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRecencyDays(opt.value)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
                recencyDays === opt.value
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-muted-light text-muted hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Crawl Interval */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Wie oft neue Informationen sammeln?
        </label>
        <div className="flex flex-wrap gap-2">
          {CRAWL_INTERVAL_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setCrawlIntervalHours(opt.value)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
                crawlIntervalHours === opt.value
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-muted-light text-muted hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reading Time */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Wie lange moechtest du taeglich lesen?
        </label>
        <div className="flex flex-wrap gap-2">
          {READING_TIME_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setReadingTime(opt.value)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
                readingTime === opt.value
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-muted-light text-muted hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Source Languages */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Quellen in welchen Sprachen?
        </label>
        <div className="flex flex-wrap gap-2">
          {LANGUAGE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleLanguage(opt.value)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
                languages.includes(opt.value)
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-muted-light text-muted hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Feeds */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Eigene Quellen (Podcast RSS, YouTube Channel, Blog URL)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newFeed}
            onChange={e => setNewFeed(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFeed(); } }}
            placeholder="https://feeds.example.com/podcast.xml"
            className="flex-1 h-11 px-4 rounded-xl border border-border bg-card text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors text-sm"
          />
          <Button type="button" variant="secondary" size="md" onClick={addFeed}>
            +
          </Button>
        </div>
        {customFeeds.length > 0 && (
          <div className="space-y-1.5 mt-2">
            {customFeeds.map((feed, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-muted-light rounded-lg text-sm">
                <span className="flex-1 truncate text-muted">{feed}</span>
                <button
                  type="button"
                  onClick={() => removeFeed(feed)}
                  className="text-destructive hover:text-red-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="submit" loading={loading} className="flex-1">
          {initialName ? 'Speichern' : 'Topic erstellen'}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Abbrechen
          </Button>
        )}
      </div>
    </form>
  );
}
