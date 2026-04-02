import { NextResponse } from 'next/server';
import { getTopicById, getNotificationSettings, getDigestById } from '@/lib/db/queries';
import { runPipeline } from '@/lib/pipeline/crawl';
import { sendDigestViaTelegram } from '@/lib/notifications/telegram';

// Store running pipelines globally so they survive page navigations
const runningPipelines = new Map<string, Promise<any>>();

export async function POST(req: Request) {
  const { topicId } = await req.json();
  if (!topicId) {
    return NextResponse.json({ error: 'topicId required' }, { status: 400 });
  }

  const topic = getTopicById(topicId);
  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
  }

  // Don't start duplicate crawls
  if (runningPipelines.has(topicId)) {
    return NextResponse.json({ status: 'already_running', topicId });
  }

  // Run pipeline fully detached - this runs even if the user navigates away
  const pipeline = runPipeline(topic).then(async (result) => {
    console.log(`[Crawl] Pipeline completed for "${topic.name}":`, result);

    // Send Telegram notification if configured
    if (result.digestId) {
      try {
        const notifSettings = getNotificationSettings();
        if (notifSettings?.is_active && notifSettings.bot_token && notifSettings.chat_id) {
          const digest = getDigestById(result.digestId);
          if (digest) {
            await sendDigestViaTelegram(notifSettings.bot_token, notifSettings.chat_id, digest, topic.name);
          }
        }
      } catch (e) {
        console.error('[Crawl] Telegram notification failed:', e);
      }
    }

    return result;
  }).catch(e => {
    console.error(`[Crawl] Pipeline failed for "${topic.name}":`, e);
  }).finally(() => {
    runningPipelines.delete(topicId);
  });

  runningPipelines.set(topicId, pipeline);

  return NextResponse.json({ status: 'started', topicId });
}
