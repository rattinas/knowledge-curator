import cron from 'node-cron';
import { getTopicsDueForCrawl, updateLastCrawled, getNotificationSettings, getDigestById } from './db/queries';
import { runPipeline } from './pipeline/crawl';
import { sendDigestViaTelegram } from './notifications/telegram';
import { startTelegramBot } from './telegram-bot';

const MAX_PARALLEL = 5;
let schedulerRunning = false;
let currentlyRunning = 0;

export function startScheduler() {
  if (schedulerRunning) return;
  schedulerRunning = true;

  console.log('[Scheduler] Started - parallel limit: ' + MAX_PARALLEL);

  // Start Telegram Bot
  try {
    startTelegramBot();
  } catch (e) {
    console.error('[Scheduler] Telegram bot failed:', e);
  }

  // Check every 10 minutes for topics that need crawling
  cron.schedule('*/10 * * * *', async () => {
    console.log(`[Scheduler] Check: ${currentlyRunning}/${MAX_PARALLEL} running`);
    await runDueTopics();
  });

  // Also run immediately on startup
  setTimeout(() => runDueTopics(), 5000);
}

async function runDueTopics() {
  try {
    const dueTopics = getTopicsDueForCrawl();
    if (dueTopics.length === 0) {
      console.log('[Scheduler] No topics due');
      return;
    }

    const available = MAX_PARALLEL - currentlyRunning;
    if (available <= 0) {
      console.log(`[Scheduler] ${dueTopics.length} due but all ${MAX_PARALLEL} slots busy`);
      return;
    }

    // Take as many as we can run in parallel
    const batch = dueTopics.slice(0, available);
    console.log(`[Scheduler] Running ${batch.length}/${dueTopics.length} due topics (${currentlyRunning} already running)`);

    // Launch all in parallel
    const promises = batch.map(topic => runSingleTopic(topic));
    await Promise.allSettled(promises);

  } catch (e) {
    console.error('[Scheduler] Error:', e);
  }
}

async function runSingleTopic(topic: { id: string; name: string; [key: string]: any }) {
  currentlyRunning++;
  const startTime = Date.now();
  console.log(`[Scheduler] [${topic.name}] Starting (${currentlyRunning}/${MAX_PARALLEL} slots used)`);

  try {
    const result = await runPipeline(topic as any, (p) => {
      if (p.step === 'crawl' || p.step === 'filter' || p.step === 'assemble') {
        console.log(`[Scheduler] [${topic.name}] ${p.step}: ${p.message}`);
      }
    });

    updateLastCrawled(topic.id);
    const elapsed = Math.round((Date.now() - startTime) / 1000);

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
        console.error(`[Scheduler] [${topic.name}] Telegram failed:`, (e as Error).message);
      }
    }

    console.log(`[Scheduler] [${topic.name}] Done in ${elapsed}s. Digest: ${result.digestId || 'none'}`);
  } catch (e) {
    console.error(`[Scheduler] [${topic.name}] Failed:`, (e as Error).message);
  } finally {
    currentlyRunning--;
  }
}
