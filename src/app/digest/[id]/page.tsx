'use client';
import { use } from 'react';
import { Header } from '@/components/layout/Header';
import { PageShell } from '@/components/layout/PageShell';
import { DigestReader } from '@/components/digest/DigestReader';
import { DigestSkeleton } from '@/components/ui/Skeleton';
import { useDigestById } from '@/hooks/useDigest';

export default function DigestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { digest, isLoading } = useDigestById(id);

  return (
    <>
      <Header title={digest?.title || 'Digest'} />
      <PageShell>
        {isLoading && <DigestSkeleton />}
        {digest && <DigestReader digest={digest} />}
        {!isLoading && !digest && (
          <div className="text-center py-12 text-muted">
            <p>Digest nicht gefunden.</p>
          </div>
        )}
      </PageShell>
    </>
  );
}
