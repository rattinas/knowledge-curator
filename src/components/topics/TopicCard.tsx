'use client';
import type { Topic } from '@/types';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

const readingTimeLabels: Record<number, string> = {
  15: '15 Min.',
  30: '30 Min.',
  60: '1h',
  90: '1.5h',
  120: '2h',
};

interface TopicCardProps {
  topic: Topic;
  onCrawl: (id: string) => void;
  onDelete: (id: string) => void;
  isRunning?: boolean;
}

export function TopicCard({ topic, onCrawl, onDelete, isRunning }: TopicCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-semibold text-base">{topic.name}</h3>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {topic.keywords.map((kw, i) => (
              <Badge key={i}>{kw}</Badge>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted flex-wrap">
            <span>Lesezeit: {readingTimeLabels[topic.reading_time_min] || `${topic.reading_time_min}m`}</span>
            <span>·</span>
            <span>Ausgabe: {(topic.output_language || 'de').toUpperCase()}</span>
            <span>·</span>
            <span>Max. {topic.recency_days || 30}d alt</span>
            {topic.custom_feeds?.length > 0 && (
              <>
                <span>·</span>
                <span>{topic.custom_feeds.length} eigene Quellen</span>
              </>
            )}
          </div>
        </div>
        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${topic.is_active ? 'bg-secondary' : 'bg-muted'}`} />
      </div>

      <div className="flex gap-2 mt-4">
        <Button
          size="sm"
          onClick={() => onCrawl(topic.id)}
          loading={isRunning}
          className="flex-1"
        >
          {isRunning ? 'Crawling...' : 'Jetzt crawlen'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDelete(topic.id)}
          className="text-destructive hover:text-destructive"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
        </Button>
      </div>
    </Card>
  );
}
