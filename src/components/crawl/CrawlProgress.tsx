'use client';
import { useEffect, useState } from 'react';
import type { PipelineRun } from '@/types';

const PIPELINE_STEPS = [
  {
    id: 'crawl',
    icon: '🌐',
    label: 'Quellen durchsuchen',
    description: 'YouTube, arXiv, Podcasts, Blogs, News, Perplexity',
    color: 'from-blue-500 to-cyan-400',
    tools: ['YouTube API', 'arXiv', 'Podcast Index', 'RSS Parser', 'GNews', 'Perplexity'],
  },
  {
    id: 'extract',
    icon: '📥',
    label: 'Inhalte extrahieren',
    description: 'Transkripte laden, Artikel parsen, Texte aufbereiten',
    color: 'from-violet-500 to-purple-400',
    tools: ['YouTube Transcript', 'Article Extractor', 'RSS Parser'],
  },
  {
    id: 'filter',
    icon: '🧠',
    label: 'KI bewertet Relevanz',
    description: 'Claude Opus analysiert jeden Inhalt einzeln',
    color: 'from-amber-500 to-orange-400',
    tools: ['Claude Opus 4.6'],
  },
  {
    id: 'summarize',
    icon: '✍️',
    label: 'Zusammenfassungen',
    description: 'Claude Opus erstellt strukturierte Summaries',
    color: 'from-emerald-500 to-green-400',
    tools: ['Claude Opus 4.6'],
  },
  {
    id: 'assemble',
    icon: '📚',
    label: 'Digest erstellen',
    description: 'Executive Summary + Cross-Source-Analyse',
    color: 'from-rose-500 to-pink-400',
    tools: ['Claude Opus 4.6', 'PDF Generator'],
  },
];

interface CrawlProgressProps {
  status: PipelineRun | null;
}

export function CrawlProgress({ status }: CrawlProgressProps) {
  const [pulseIndex, setPulseIndex] = useState(0);
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setPulseIndex(p => (p + 1) % 3);
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  if (!status) return null;
  if ((status as any).status === 'idle') return null;

  const isRunning = status.status === 'running';
  const isFailed = status.status === 'failed';
  const isCompleted = status.status === 'completed';
  const currentStepIndex = PIPELINE_STEPS.findIndex(s => s.id === status.step);

  const elapsed = status.started_at
    ? Math.floor((Date.now() - new Date(status.started_at).getTime()) / 1000)
    : 0;
  const elapsedStr = elapsed > 60
    ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
    : `${elapsed}s`;

  return (
    <div className={`rounded-2xl border overflow-hidden mb-4 transition-all ${
      isRunning ? 'border-primary/30 bg-gradient-to-b from-primary/5 to-transparent' :
      isCompleted ? 'border-secondary/30 bg-secondary/5' :
      'border-destructive/30 bg-destructive/5'
    }`}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isRunning && (
            <div className="relative w-5 h-5">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <div className="absolute inset-1 rounded-full bg-primary animate-pulse" />
            </div>
          )}
          {isCompleted && <span className="text-secondary text-lg">✓</span>}
          {isFailed && <span className="text-destructive text-lg">✗</span>}
          <span className="font-heading font-semibold text-sm">
            {isRunning ? 'Pipeline laeuft' + dots : isCompleted ? 'Fertig!' : 'Fehler'}
          </span>
        </div>
        <span className="text-xs text-muted font-mono">{elapsedStr}</span>
      </div>

      {/* Pipeline Steps */}
      <div className="px-4 pb-4 space-y-1">
        {PIPELINE_STEPS.map((step, i) => {
          const isActive = isRunning && step.id === status.step;
          const isDone = currentStepIndex > i || isCompleted;
          const isPending = !isDone && !isActive;
          const activeToolIndex = isActive ? pulseIndex % step.tools.length : -1;

          return (
            <div
              key={step.id}
              className={`rounded-xl transition-all duration-500 overflow-hidden ${
                isActive ? 'bg-card border border-primary/20 shadow-lg shadow-primary/5' :
                isDone ? 'opacity-70' :
                'opacity-30'
              }`}
            >
              <div className={`flex items-center gap-3 px-3 py-2 ${isActive ? 'py-3' : ''}`}>
                {/* Status indicator */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 ${
                  isDone ? 'bg-secondary/10 text-secondary' :
                  isActive ? `bg-gradient-to-br ${step.color} text-white shadow-sm` :
                  'bg-muted-light text-muted'
                }`}>
                  {isDone ? '✓' : step.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${isActive ? 'text-foreground' : isDone ? 'text-muted' : 'text-muted'}`}>
                      {step.label}
                    </span>
                    {isActive && (
                      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    )}
                  </div>

                  {/* Active step shows detail */}
                  {isActive && (
                    <div className="mt-1 space-y-1.5">
                      <p className="text-[11px] text-muted leading-relaxed">
                        {(status as any).step_detail || step.description}
                      </p>

                      {/* Active tools animation */}
                      <div className="flex flex-wrap gap-1">
                        {step.tools.map((tool, ti) => (
                          <span
                            key={tool}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium transition-all duration-300 ${
                              ti === activeToolIndex
                                ? 'bg-primary/10 text-primary scale-105'
                                : 'bg-muted-light/50 text-muted'
                            }`}
                          >
                            {ti === activeToolIndex && (
                              <span className="inline-block w-1 h-1 rounded-full bg-primary animate-pulse" />
                            )}
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Done step shows stats */}
                  {isDone && step.id === 'crawl' && status.items_found > 0 && (
                    <span className="text-[10px] text-secondary">{status.items_found} gefunden</span>
                  )}
                  {isDone && step.id === 'filter' && status.items_included > 0 && (
                    <span className="text-[10px] text-secondary">{status.items_included}/{status.items_scored} relevant</span>
                  )}
                  {isDone && step.id === 'summarize' && status.items_summarized > 0 && (
                    <span className="text-[10px] text-secondary">{status.items_summarized} Summaries</span>
                  )}
                </div>

                {/* Connector line */}
                {i < PIPELINE_STEPS.length - 1 && (
                  <div className={`w-px h-4 absolute left-[2.1rem] mt-10 ${isDone ? 'bg-secondary/30' : 'bg-border'}`} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Stats bar */}
      {(isRunning || isCompleted) && (
        <div className="px-4 pb-3 flex items-center gap-4 text-[10px] text-muted">
          {status.items_found > 0 && <span>📊 {status.items_found} gefunden</span>}
          {status.items_scored > 0 && <span>🧠 {status.items_scored} bewertet</span>}
          {status.items_included > 0 && <span>✅ {status.items_included} relevant</span>}
          {status.items_summarized > 0 && <span>✍️ {status.items_summarized} zusammengefasst</span>}
          {status.total_tokens > 0 && <span>🔤 {(status.total_tokens / 1000).toFixed(1)}k tokens</span>}
          {status.estimated_cost > 0 && <span>💰 ${status.estimated_cost.toFixed(2)}</span>}
        </div>
      )}

      {/* Error */}
      {isFailed && status.error_message && (
        <div className="px-4 pb-3 text-xs text-destructive">
          {status.error_message}
        </div>
      )}
    </div>
  );
}
