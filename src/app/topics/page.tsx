'use client';
import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { PageShell } from '@/components/layout/PageShell';
import { TopicForm } from '@/components/topics/TopicForm';
import { TopicCard } from '@/components/topics/TopicCard';
import { TopicSkeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { CrawlProgress } from '@/components/crawl/CrawlProgress';
import { useTopics } from '@/hooks/useTopics';
import { useCrawlStatus } from '@/hooks/useCrawlStatus';

export default function TopicsPage() {
  const { topics, isLoading, createTopic, deleteTopic } = useTopics();
  const { status, isRunning, startCrawl } = useCrawlStatus();
  const [showForm, setShowForm] = useState(false);
  const [crawlingTopicId, setCrawlingTopicId] = useState<string | null>(null);

  const handleCrawl = async (id: string) => {
    setCrawlingTopicId(id);
    await startCrawl(id);
  };

  return (
    <>
      <Header
        title="Topics"
        subtitle={`${topics.length} Topics`}
        action={
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Schliessen' : '+ Neu'}
          </Button>
        }
      />
      <PageShell className="py-4">
        {showForm && (
          <div className="mb-6 p-4 bg-card rounded-2xl border border-border">
            <TopicForm
              onSubmit={async (name, keywords, readingTime, languages, outputLanguage, recencyDays, customFeeds, crawlIntervalHours) => {
                await createTopic(name, keywords, readingTime, languages, outputLanguage, recencyDays, customFeeds, crawlIntervalHours);
                setShowForm(false);
              }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        <CrawlProgress status={status} />

        {isLoading ? (
          <TopicSkeleton />
        ) : topics.length === 0 ? (
          <div className="text-center py-12 text-muted">
            <p className="text-sm">Noch keine Topics. Erstelle dein erstes!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {topics.map(topic => (
              <TopicCard
                key={topic.id}
                topic={topic}
                onCrawl={handleCrawl}
                onDelete={deleteTopic}
                isRunning={isRunning && crawlingTopicId === topic.id}
              />
            ))}
          </div>
        )}
      </PageShell>
    </>
  );
}
