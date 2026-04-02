'use client';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { PageShell } from '@/components/layout/PageShell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDigestHistory } from '@/hooks/useDigest';

export default function HistoryPage() {
  const { digests, isLoading } = useDigestHistory();

  return (
    <>
      <Header title="History" subtitle={`${digests.length} Digests`} />
      <PageShell className="py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="p-4 rounded-2xl border border-border">
                <Skeleton className="h-5 w-2/3 mb-2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            ))}
          </div>
        ) : digests.length === 0 ? (
          <div className="text-center py-12 text-muted">
            <p className="text-sm">Noch keine Digests vorhanden.</p>
            <p className="text-xs mt-1">Starte einen Crawl auf der Topics-Seite.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {digests.map(digest => (
              <Link key={digest.id} href={`/digest/${digest.id}`}>
                <Card hover className="p-4 mb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading font-medium text-[15px] leading-snug line-clamp-2">
                        {digest.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-muted">
                        <time>
                          {new Date(digest.digest_date).toLocaleDateString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </time>
                        <span>·</span>
                        <span>{digest.total_sources} Quellen</span>
                        <span>·</span>
                        <span>~{digest.total_reading_min}m</span>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-muted shrink-0 mt-1" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </PageShell>
    </>
  );
}
