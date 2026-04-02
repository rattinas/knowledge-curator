'use client';
import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { PageShell } from '@/components/layout/PageShell';
import { DigestReader } from '@/components/digest/DigestReader';
import { DigestSkeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useCrawlStatus } from '@/hooks/useCrawlStatus';
import { CrawlProgress } from '@/components/crawl/CrawlProgress';
import Link from 'next/link';
import type { Topic, Digest } from '@/types';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface DashboardData {
  grouped: Record<string, { topic: Topic; digests: Digest[] }>;
  scheduler: {
    topics_total: number;
    topics_active: number;
    topics_due: number;
    last_crawl: string | null;
    total_digests: number;
    unsent_digests: number;
  };
}

export default function HomePage() {
  const { data, isLoading, mutate } = useSWR<DashboardData>('/api/dashboard', fetcher, { refreshInterval: 10000 });
  const { status, isRunning, startCrawl } = useCrawlStatus();
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [expandedDigest, setExpandedDigest] = useState<string | null>(null);

  const grouped = data?.grouped || {};
  const scheduler = data?.scheduler;
  const topicEntries = Object.values(grouped).sort((a, b) => {
    const aDate = a.digests[0]?.created_at || '0';
    const bDate = b.digests[0]?.created_at || '0';
    return bDate.localeCompare(aDate);
  });

  const hasTopics = topicEntries.length > 0;

  return (
    <>
      <Header
        title="Knowledge Curator"
        subtitle={scheduler ? `${scheduler.topics_active} Topics · ${scheduler.total_digests} Digests` : 'Dein taeglicher Wissens-Digest'}
      />
      <PageShell>
        {/* Scheduler Status Bar */}
        {scheduler && hasTopics && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-card rounded-2xl border border-border mb-4 text-xs">
            <div className={`w-2 h-2 rounded-full ${scheduler.topics_due > 0 ? 'bg-accent animate-pulse' : 'bg-secondary'}`} />
            <span className="text-muted flex-1">
              {scheduler.topics_due > 0
                ? `${scheduler.topics_due} Topic(s) faellig`
                : 'Alles aktuell'}
            </span>
            {scheduler.unsent_digests > 0 && (
              <span className="text-accent font-medium">{scheduler.unsent_digests} nicht gesendet</span>
            )}
            {scheduler.last_crawl && (
              <span className="text-muted">
                Letzter Crawl: {new Date(scheduler.last_crawl).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        )}

        {/* Crawl Progress */}
        {isRunning && <CrawlProgress status={status} />}

        {/* No topics - Onboarding */}
        {!isLoading && !hasTopics && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-violet-400 flex items-center justify-center shadow-lg shadow-primary/20 mb-6">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <h2 className="font-heading text-2xl font-bold mb-2">Willkommen!</h2>
            <p className="text-muted text-sm mb-8 max-w-sm">Erstelle dein erstes Topic um loszulegen.</p>
            <div className="flex flex-col gap-2">
              <Link href="/settings"><Button variant="secondary">1. API Keys einrichten</Button></Link>
              <Link href="/topics"><Button>2. Topic erstellen</Button></Link>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && <div className="py-6"><DigestSkeleton /></div>}

        {/* Topic Cards with Digests */}
        {hasTopics && (
          <div className="space-y-3">
            {topicEntries.map(({ topic, digests }) => {
              const isExpanded = expandedTopic === topic.id;
              const latestDigest = digests[0];
              const intervalLabels: Record<number, string> = { 12: '2x/Tag', 24: 'Taeglich', 48: 'Alle 2d', 72: 'Alle 3d', 168: 'Woechentlich', 336: 'Alle 2 Wo.', 720: 'Monatlich' };

              return (
                <div key={topic.id} className="bg-card rounded-2xl border border-border overflow-hidden">
                  {/* Topic Header - always visible */}
                  <button
                    onClick={() => setExpandedTopic(isExpanded ? null : topic.id)}
                    className="w-full text-left p-4 hover:bg-card-hover transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center`}>
                        <span className="text-primary font-heading font-bold text-sm">{topic.name.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-heading font-semibold text-sm truncate">{topic.name}</h3>
                          <Badge variant="default">{intervalLabels[topic.crawl_interval_hours] || 'Custom'}</Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted flex-wrap">
                          <span>{digests.length} Digests</span>
                          {topic.last_crawled_at && (
                            <>
                              <span>·</span>
                              <span>Letzter Crawl: {new Date(topic.last_crawled_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                            </>
                          )}
                          <span>·</span>
                          <NextCrawlCountdown lastCrawled={topic.last_crawled_at} intervalHours={topic.crawl_interval_hours} />
                          {latestDigest?.sent_via_telegram && (
                            <>
                              <span>·</span>
                              <span className="text-secondary">✓ Gesendet</span>
                            </>
                          )}
                          {latestDigest && !latestDigest.sent_via_telegram && (
                            <>
                              <span>·</span>
                              <span className="text-accent">⏳ Nicht gesendet</span>
                            </>
                          )}
                        </div>
                      </div>
                      <svg className={`w-5 h-5 text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded: Digest List */}
                  {isExpanded && (
                    <div className="border-t border-border">
                      {/* Crawl Button */}
                      <div className="px-4 py-3 bg-muted-light/50">
                        <Button
                          size="sm"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await startCrawl(topic.id);
                            const poll = setInterval(async () => {
                              const res = await fetch(`/api/crawl/status?topicId=${topic.id}`);
                              const d = await res.json();
                              if (d.status === 'completed' || d.status === 'failed') {
                                clearInterval(poll);
                                mutate();
                              }
                            }, 3000);
                          }}
                          loading={isRunning}
                          className="w-full"
                        >
                          {isRunning ? 'Crawling...' : 'Jetzt crawlen'}
                        </Button>
                      </div>

                      {/* Digest List */}
                      {digests.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-muted">
                          Noch keine Digests. Starte einen Crawl!
                        </div>
                      ) : (
                        <div className="divide-y divide-border">
                          {digests.map(digest => {
                            const isDigestExpanded = expandedDigest === digest.id;
                            return (
                              <div key={digest.id}>
                                <button
                                  onClick={() => setExpandedDigest(isDigestExpanded ? null : digest.id)}
                                  className="w-full text-left px-4 py-3 hover:bg-card-hover transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 min-w-0">
                                      <h4 className="text-sm font-medium line-clamp-1">{digest.title}</h4>
                                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted">
                                        <span>{new Date(digest.digest_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                        <span>·</span>
                                        <span>{digest.total_sources} Quellen</span>
                                        <span>·</span>
                                        <span>~{digest.total_reading_min}m</span>
                                        {digest.sent_via_telegram && <span className="text-secondary">✓</span>}
                                      </div>
                                    </div>
                                    <svg className={`w-4 h-4 text-muted transition-transform shrink-0 ${isDigestExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                    </svg>
                                  </div>
                                </button>

                                {/* Full Digest Reader */}
                                {isDigestExpanded && (
                                  <div className="px-4 pb-4 border-t border-border/50">
                                    <DigestReader digest={digest} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </PageShell>
    </>
  );
}

function NextCrawlCountdown({ lastCrawled, intervalHours }: { lastCrawled: string | null; intervalHours: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  if (!lastCrawled) {
    return <span className="text-accent font-medium">Faellig!</span>;
  }

  const lastTime = new Date(lastCrawled).getTime();
  const nextTime = lastTime + intervalHours * 60 * 60 * 1000;
  const remaining = nextTime - now;

  if (remaining <= 0) {
    return <span className="text-accent font-medium">Faellig!</span>;
  }

  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return <span className="text-muted">Naechster in {days}d {hours % 24}h</span>;
  }

  return <span className="text-muted">Naechster in {hours}h {minutes}m</span>;
}
