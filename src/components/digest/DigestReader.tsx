'use client';
import { useState, useEffect } from 'react';
import type { Digest } from '@/types';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';

interface DigestReaderProps {
  digest: Digest;
}

const sourceIcons: Record<string, string> = {
  youtube: '▶',
  arxiv: '📄',
  podcast: '🎙',
  blog: '✍',
  news: '📰',
};

export function DigestReader({ digest }: DigestReaderProps) {
  const [readingProgress, setReadingProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      setReadingProgress(progress);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <div className="reading-progress" style={{ width: `${readingProgress}%` }} />

      <article className="prose-reader py-6">
        {/* Header */}
        <header className="mb-8">
          <time className="text-sm text-muted font-medium">
            {new Date(digest.digest_date).toLocaleDateString('de-DE', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
          <h1 className="text-2xl font-heading font-bold mt-2 mb-3 leading-tight">
            {digest.title}
          </h1>
          <div className="flex items-center gap-3 text-sm text-muted">
            <span>{digest.total_sources} Quellen</span>
            <span>·</span>
            <span>~{digest.total_reading_min} Min. Lesezeit</span>
          </div>
        </header>

        {/* Executive Summary */}
        <section className="mb-8 p-5 bg-primary-light rounded-2xl border border-primary/10">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">
            Executive Summary
          </h2>
          <div
            className="text-[15px] leading-relaxed whitespace-pre-line [&_strong]:text-foreground [&_strong]:font-semibold"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(digest.intro_text) }}
          />
        </section>

        {/* Sections by source type */}
        {digest.sections.map((section, si) => (
          <section key={si} className="mb-10">
            <h2 className="flex items-center gap-2 text-lg font-heading font-semibold mb-4 pb-2 border-b border-border">
              <span>{sourceIcons[section.source_type] || '📋'}</span>
              {section.title}
              <Badge variant={section.source_type as any}>
                {section.items.length}
              </Badge>
            </h2>

            <div className="space-y-4">
              {section.items.map((item, ii) => (
                <ContentItem key={ii} item={item} />
              ))}
            </div>
          </section>
        ))}
      </article>
    </>
  );
}

function ContentItem({ item }: { item: any }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-[15px] leading-snug mb-1">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              {item.title}
            </a>
          </h3>
          {item.author && (
            <p className="text-xs text-muted mb-2">{item.author}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-muted">{item.reading_time_min}m</span>
          <span className="w-8 h-8 rounded-lg bg-primary-light text-primary text-xs font-bold flex items-center justify-center">
            {item.relevance_score}
          </span>
        </div>
      </div>

      {/* Key Insights */}
      {item.key_insights?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.key_insights.map((insight: string, i: number) => (
            <span key={i} className="inline-block px-2.5 py-1 bg-accent-light text-accent text-xs rounded-lg font-medium">
              {insight}
            </span>
          ))}
        </div>
      )}

      {/* Expandable summary */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-3 text-xs text-primary font-medium min-h-[44px] flex items-center"
      >
        {expanded ? 'Weniger zeigen' : 'Zusammenfassung lesen'}
      </button>

      {expanded && (
        <div
          className="mt-2 text-sm leading-relaxed text-muted prose-reader whitespace-pre-line [&_strong]:text-foreground [&_strong]:font-semibold"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(item.summary_text) }}
        />
      )}
    </Card>
  );
}

function renderMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    .replace(/^### (.*$)/gm, '<span class="block text-sm font-semibold text-foreground mt-3 mb-1">$1</span>')
    .replace(/^## (.*$)/gm, '<span class="block text-base font-semibold text-foreground mt-4 mb-1">$1</span>')
    .replace(/^[-•] (.*$)/gm, '<span class="block pl-4 relative ml-2">• $1</span>')
    .replace(/^\d+\. (.*$)/gm, '<span class="block pl-4">$1</span>');
}
