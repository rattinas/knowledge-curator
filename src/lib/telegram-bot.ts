import TelegramBot from 'node-telegram-bot-api';
import {
  getAllTopics,
  getTopicById,
  getLatestDigest,
  getDigestHistory,
  getNotificationSettings,
  insertRawContent,
  getActiveTopic,
} from './db/queries';
import { runPipeline } from './pipeline/crawl';
import { summarizeContent } from './ai/summarize';
import { sendDigestViaTelegram } from './notifications/telegram';
import type { Digest } from '@/types';

let bot: TelegramBot | null = null;
let botRunning = false;

export function startTelegramBot() {
  if (botRunning) return;

  const settings = getNotificationSettings();
  if (!settings?.bot_token) {
    console.log('[TelegramBot] No bot token configured. Skipping bot startup.');
    return;
  }

  try {
    bot = new TelegramBot(settings.bot_token, { polling: true });
    botRunning = true;
    const chatId = settings.chat_id;

    console.log('[TelegramBot] Bot started with polling');

    // ── /start ──
    bot.onText(/\/start/, (msg) => {
      bot!.sendMessage(msg.chat.id,
        `🧠 <b>Knowledge Curator Bot</b>\n\n` +
        `Ich bin dein persoenlicher Wissens-Assistent. Hier sind meine Befehle:\n\n` +
        `/digest — Letzten Digest anzeigen\n` +
        `/topics — Alle Topics auflisten\n` +
        `/crawl — Jetzt neuen Crawl starten\n` +
        `/status — Pipeline-Status anzeigen\n` +
        `/history — Letzte 5 Digests\n` +
        `/help — Diese Hilfe anzeigen\n\n` +
        `📎 <b>Tipp:</b> Schick mir einfach einen Link (Podcast, Artikel, YouTube) und ich fasse ihn fuer dich zusammen!`,
        { parse_mode: 'HTML' }
      );
    });

    // ── /help ──
    bot.onText(/\/help/, (msg) => {
      bot!.sendMessage(msg.chat.id,
        `📚 <b>Alle Befehle:</b>\n\n` +
        `/digest — Zeigt den neuesten Digest\n` +
        `/digest [topic] — Digest fuer ein bestimmtes Topic\n` +
        `/topics — Liste aller Topics\n` +
        `/crawl — Startet Crawl fuer alle faelligen Topics\n` +
        `/crawl [topic] — Crawl fuer ein bestimmtes Topic\n` +
        `/status — Zeigt aktuellen Pipeline-Status\n` +
        `/history — Letzte 5 Digests\n\n` +
        `📎 <b>Links senden:</b>\n` +
        `Schick mir einfach eine URL und ich fasse den Inhalt zusammen.\n` +
        `Funktioniert mit: Podcast-Links, YouTube-Videos, Blog-Artikel, Papers`,
        { parse_mode: 'HTML' }
      );
    });

    // ── /topics ──
    bot.onText(/\/topics/, (msg) => {
      const topics = getAllTopics();
      if (topics.length === 0) {
        bot!.sendMessage(msg.chat.id, '📭 Keine Topics vorhanden. Erstelle eins im Web-UI: http://localhost:3000/topics');
        return;
      }

      const intervalLabels: Record<number, string> = { 12: '2x/Tag', 24: 'Taeglich', 48: 'Alle 2 Tage', 72: 'Alle 3 Tage', 168: 'Woechentlich', 336: 'Alle 2 Wochen', 720: 'Monatlich' };

      let text = `📋 <b>Deine Topics (${topics.length}):</b>\n\n`;
      for (const t of topics) {
        const interval = intervalLabels[t.crawl_interval_hours] || `${t.crawl_interval_hours}h`;
        const active = t.is_active ? '🟢' : '⚪';
        const lastCrawl = t.last_crawled_at
          ? new Date(t.last_crawled_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
          : 'Nie';
        text += `${active} <b>${escHtml(t.name)}</b>\n`;
        text += `   📊 ${interval} · ${t.output_language.toUpperCase()} · ${t.keywords.length} Keywords\n`;
        text += `   🕐 Letzter Crawl: ${lastCrawl}\n\n`;
      }
      bot!.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
    });

    // ── /digest [topic] ──
    bot.onText(/\/digest(.*)/, (msg, match) => {
      const topicQuery = match?.[1]?.trim();
      const topics = getAllTopics();

      let targetTopic = topics[0];
      if (topicQuery) {
        const found = topics.find(t => t.name.toLowerCase().includes(topicQuery.toLowerCase()));
        if (found) targetTopic = found;
      }

      if (!targetTopic) {
        bot!.sendMessage(msg.chat.id, '📭 Keine Topics vorhanden.');
        return;
      }

      const digest = getLatestDigest(targetTopic.id);
      if (!digest) {
        bot!.sendMessage(msg.chat.id, `📭 Kein Digest fuer "${targetTopic.name}" vorhanden. Starte mit /crawl`);
        return;
      }

      sendDigestViaTelegram(settings!.bot_token, String(msg.chat.id), digest, targetTopic.name);
    });

    // ── /crawl [topic] ──
    bot.onText(/\/crawl(.*)/, async (msg, match) => {
      const topicQuery = match?.[1]?.trim();
      const topics = topicQuery
        ? getAllTopics().filter(t => t.name.toLowerCase().includes(topicQuery.toLowerCase()))
        : getActiveTopic();

      if (topics.length === 0) {
        bot!.sendMessage(msg.chat.id, '📭 Keine passenden Topics gefunden.');
        return;
      }

      bot!.sendMessage(msg.chat.id,
        `⚡ Starte Crawl fuer ${topics.length} Topic(s):\n${topics.map(t => `• ${t.name}`).join('\n')}\n\nDas kann 2-5 Minuten dauern...`,
        { parse_mode: 'HTML' }
      );

      for (const topic of topics) {
        try {
          const result = await runPipeline(topic, (p) => {
            // Only send progress for key steps
            if (p.step === 'filter' && p.progress === p.total) {
              bot!.sendMessage(msg.chat.id, `🔍 ${topic.name}: ${p.message}`);
            }
          });

          if (result.digestId) {
            const digest = (await import('./db/queries')).getDigestById(result.digestId);
            if (digest) {
              await sendDigestViaTelegram(settings!.bot_token, String(msg.chat.id), digest, topic.name);
            }
          } else {
            bot!.sendMessage(msg.chat.id, `✅ "${topic.name}" fertig — keine neuen relevanten Inhalte gefunden.`);
          }
        } catch (e) {
          bot!.sendMessage(msg.chat.id, `❌ Fehler bei "${topic.name}": ${(e as Error).message}`);
        }
      }
    });

    // ── /status ──
    bot.onText(/\/status/, (msg) => {
      const topics = getAllTopics();
      const intervalLabels: Record<number, string> = { 12: '2x/Tag', 24: 'Taeglich', 48: '2 Tage', 72: '3 Tage', 168: 'Woche' };

      let text = `📊 <b>Status</b>\n\n`;
      text += `Topics: ${topics.length}\n`;
      text += `Aktiv: ${topics.filter(t => t.is_active).length}\n\n`;

      for (const t of topics) {
        const interval = intervalLabels[t.crawl_interval_hours] || `${t.crawl_interval_hours}h`;
        const lastCrawl = t.last_crawled_at ? new Date(t.last_crawled_at) : null;
        const nextCrawl = lastCrawl
          ? new Date(lastCrawl.getTime() + t.crawl_interval_hours * 60 * 60 * 1000)
          : null;
        const isDue = !nextCrawl || nextCrawl <= new Date();

        text += `<b>${escHtml(t.name)}</b> (${interval})\n`;
        text += isDue ? `   🔴 Faellig!\n` : `   🟢 Naechster: ${nextCrawl!.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}\n`;
      }

      bot!.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
    });

    // ── /history ──
    bot.onText(/\/history/, (msg) => {
      const digests = getDigestHistory(undefined, 5, 0);
      if (digests.length === 0) {
        bot!.sendMessage(msg.chat.id, '📭 Noch keine Digests vorhanden.');
        return;
      }

      let text = `📜 <b>Letzte ${digests.length} Digests:</b>\n\n`;
      for (const d of digests) {
        const date = new Date(d.digest_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        text += `📖 <b>${escHtml(d.title)}</b>\n`;
        text += `   ${date} · ${d.total_sources} Quellen · ~${d.total_reading_min}m\n\n`;
      }
      text += `\n🔗 Alle Digests: http://localhost:3000/history`;
      bot!.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
    });

    // ── URL/Link Handler — Auto-Summarize ──
    bot.on('message', async (msg) => {
      if (!msg.text || msg.text.startsWith('/')) return;

      // Check if message contains a URL
      const urlMatch = msg.text.match(/https?:\/\/[^\s]+/);
      if (!urlMatch) return;

      const url = urlMatch[0];
      try {
        // Determine content type and extract
        let content: string | null = null;
        let title = url;
        let sourceType = 'blog';

        // ── Spotify Links ──
        if (url.includes('spotify.com')) {
          sourceType = 'podcast';
          bot!.sendMessage(msg.chat.id, `🎙 Spotify erkannt! Suche Podcast auf YouTube fuer volles Transkript...`);

          // Get episode/show info from Spotify page
          let spotifyTitle = '';
          let showName = '';
          try {
            const res = await fetch(url, { redirect: 'follow' });
            const html = await res.text();
            const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/)?.[1];
            spotifyTitle = ogTitle || '';
            // Try to get show name from page title (format: "Episode - Show | Podcast on Spotify")
            const titleTag = html.match(/<title>([^<]+)<\/title>/)?.[1] || '';
            const showMatch = titleTag.match(/\s-\s([^|]+)\|/);
            if (showMatch) showName = showMatch[1].trim();
          } catch { /* ignore */ }

          if (!spotifyTitle) {
            try {
              const { extract } = await import('@extractus/article-extractor');
              const page = await extract(url);
              spotifyTitle = page?.title || '';
            } catch { /* ignore */ }
          }

          if (spotifyTitle) {
            title = spotifyTitle;
            bot!.sendMessage(msg.chat.id, `🔍 Gefunden: "${spotifyTitle}"\n${showName ? `Show: ${showName}\n` : ''}Suche auf YouTube...`);

            // Search YouTube with multiple strategies
            const apiKey = process.env.YOUTUBE_API_KEY;
            if (apiKey) {
              // Clean the title: remove episode numbers like #123, EP123 etc
              const cleanTitle = spotifyTitle
                .replace(/^#?\d+\s*[-–:]\s*/g, '')  // Remove #123 - prefix
                .replace(/\(([^)]+)\)/g, '$1')       // Remove parentheses but keep content
                .trim();

              // Try multiple search queries from most specific to broader
              const searchQueries = [
                showName ? `${showName} ${cleanTitle}` : cleanTitle,
                cleanTitle,
                showName ? `${showName} ${spotifyTitle.match(/\(([^)]+)\)/)?.[1] || ''}` : spotifyTitle,
              ].filter(q => q.length > 3);

              const { YoutubeTranscript } = await import('youtube-transcript');
              let found = false;

              for (const searchQuery of searchQueries) {
                if (found) break;
                const q = encodeURIComponent(searchQuery);
                const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&q=${q}&order=relevance&key=${apiKey}`;
                const ytRes = await fetch(ytUrl);
                if (!ytRes.ok) continue;
                const ytData = await ytRes.json();
                const videos = ytData.items || [];

                for (const video of videos) {
                  const videoId = video.id?.videoId;
                  if (!videoId) continue;
                  try {
                    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
                    if (transcript?.length > 10) {
                      content = transcript.map((t: any) => t.text).join(' ');
                      title = video.snippet?.title || spotifyTitle;
                      bot!.sendMessage(msg.chat.id, `✅ YouTube-Transkript gefunden! "${title}"\nFasse zusammen...`);
                      found = true;
                      break;
                    }
                  } catch { continue; }
                }
              }
            }

            if (!content) {
              bot!.sendMessage(msg.chat.id, `⚠️ Kein YouTube-Transkript gefunden. Nutze Spotify-Beschreibung...`);
              // Fallback to whatever text we got
              content = spotifyTitle;
            }
          } else {
            bot!.sendMessage(msg.chat.id, `⚠️ Konnte Spotify-Episode nicht identifizieren. Schick mir den Episode-Titel direkt!`);
            return;
          }

        // ── YouTube Links ──
        } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
          sourceType = 'youtube';
          bot!.sendMessage(msg.chat.id, `▶️ YouTube erkannt! Hole Transkript...`);
          const videoId = url.match(/(?:v=|\/)([\w-]{11})/)?.[1];
          if (videoId) {
            try {
              const { YoutubeTranscript } = await import('youtube-transcript');
              const transcript = await YoutubeTranscript.fetchTranscript(videoId);
              content = transcript.map((t: any) => t.text).join(' ');
              // Get video title
              const apiKey = process.env.YOUTUBE_API_KEY;
              if (apiKey) {
                const infoRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`);
                if (infoRes.ok) {
                  const infoData = await infoRes.json();
                  title = infoData.items?.[0]?.snippet?.title || `YouTube: ${videoId}`;
                }
              }
            } catch {
              bot!.sendMessage(msg.chat.id, '⚠️ Kein Transkript verfuegbar fuer dieses Video.');
              return;
            }
          }

        // ── Apple Podcast Links ──
        } else if (url.includes('podcasts.apple.com')) {
          sourceType = 'podcast';
          bot!.sendMessage(msg.chat.id, `🎙 Apple Podcast erkannt! Suche auf YouTube...`);
          try {
            const res = await fetch(url);
            const html = await res.text();
            const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/)?.[1] || '';
            if (ogTitle) {
              title = ogTitle;
              // Same YouTube search strategy
              const apiKey = process.env.YOUTUBE_API_KEY;
              if (apiKey) {
                const q = encodeURIComponent(ogTitle + ' podcast');
                const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=3&q=${q}&order=relevance&key=${apiKey}`);
                if (ytRes.ok) {
                  const ytData = await ytRes.json();
                  const { YoutubeTranscript } = await import('youtube-transcript');
                  for (const video of (ytData.items || [])) {
                    try {
                      const transcript = await YoutubeTranscript.fetchTranscript(video.id?.videoId);
                      if (transcript?.length > 10) {
                        content = transcript.map((t: any) => t.text).join(' ');
                        title = video.snippet?.title || ogTitle;
                        break;
                      }
                    } catch { continue; }
                  }
                }
              }
            }
          } catch { /* ignore */ }

          if (!content) {
            bot!.sendMessage(msg.chat.id, `⚠️ Kein YouTube-Match. Nutze Beschreibung...`);
          }

        // ── Normal Article Links ──
        } else {
          bot!.sendMessage(msg.chat.id, `🔍 Analysiere: ${url}\n\nEinen Moment...`);
          try {
            const { extract } = await import('@extractus/article-extractor');
            const article = await extract(url);
            if (article) {
              content = article.content?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null;
              title = article.title || url;
            }
          } catch { /* fall through */ }
        }

        if (!content) {
          bot!.sendMessage(msg.chat.id, '❌ Konnte den Inhalt nicht extrahieren. Probier einen anderen Link.');
          return;
        }

        // Get first active topic for language setting, default to German
        const topics = getActiveTopic();
        const outputLang = topics[0]?.output_language || 'de';

        // Summarize with Opus
        const summary = await summarizeContent(title, content, sourceType, 'Ad-hoc Summary', outputLang);

        // Format and send
        let response = `📝 <b>${escHtml(title)}</b>\n\n`;
        response += `${mdToTelegramHtml(summary.summary_text)}\n\n`;

        if (summary.key_insights.length > 0) {
          response += `💡 <b>Key Insights:</b>\n`;
          for (const insight of summary.key_insights) {
            response += `  • ${mdToTelegramHtml(insight)}\n`;
          }
        }

        response += `\n⏱ ~${summary.reading_time_min} Min. Lesezeit`;

        // Split if too long
        if (response.length > 4000) {
          const parts = [response.slice(0, 4000), response.slice(4000)];
          for (const part of parts) {
            await bot!.sendMessage(msg.chat.id, part, { parse_mode: 'HTML' });
          }
        } else {
          bot!.sendMessage(msg.chat.id, response, { parse_mode: 'HTML' });
        }

        // Also save to DB if there's an active topic
        if (topics[0]) {
          insertRawContent({
            topic_id: topics[0].id,
            source_type: sourceType as any,
            source_id: Buffer.from(url).toString('base64').slice(0, 64),
            title,
            author: null,
            url,
            published_at: new Date().toISOString(),
            content_text: content.slice(0, 50000),
            content_length: content.length,
            metadata: { source: 'telegram', manual: true },
          });
        }

        // Send full transcript as PDF for podcasts/videos
        if (content && content.length > 500 && (sourceType === 'podcast' || sourceType === 'youtube')) {
          try {
            bot!.sendMessage(msg.chat.id, `📄 Erstelle Transkript-PDF...`);
            const { generateTranscriptPdf } = await import('./pdf/transcript');
            const pdfPath = await generateTranscriptPdf(title, content, url);

            const fs = await import('fs');
            const fileBuffer = fs.readFileSync(pdfPath);
            const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
            const safeTitle = title.replace(/[^a-zA-Z0-9\- ]/g, '').slice(0, 60);
            const parts: Buffer[] = [];
            parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${msg.chat.id}\r\n`));
            parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\nVolles Transkript als PDF\r\n`));
            parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${safeTitle} Transkript.pdf"\r\nContent-Type: application/pdf\r\n\r\n`));
            parts.push(fileBuffer);
            parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

            const body = Buffer.concat(parts);
            const pdfRes = await fetch(`https://api.telegram.org/bot${settings!.bot_token}/sendDocument`, {
              method: 'POST',
              headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
              body,
            });
            if (pdfRes.ok) {
              console.log(`[TelegramBot] Transcript PDF sent for "${title}"`);
            }
            try { fs.unlinkSync(pdfPath); } catch { /* ignore */ }
          } catch (pdfErr) {
            console.error('[TelegramBot] Transcript PDF failed:', (pdfErr as Error).message);
          }
        }

      } catch (e) {
        bot!.sendMessage(msg.chat.id, `❌ Fehler: ${(e as Error).message}`);
      }
    });

    console.log('[TelegramBot] All handlers registered');

  } catch (e) {
    console.error('[TelegramBot] Failed to start:', e);
  }
}

export function stopTelegramBot() {
  if (bot) {
    bot.stopPolling();
    bot = null;
    botRunning = false;
    console.log('[TelegramBot] Stopped');
  }
}

function escHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Convert markdown summary to Telegram HTML */
function mdToTelegramHtml(text: string): string {
  return text
    // First escape HTML entities
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Bold **text**
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    // Italic *text* (but not inside bold)
    .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<i>$1</i>')
    // Headers ## text → bold
    .replace(/^#{1,3}\s+(.+)$/gm, '\n<b>$1</b>')
    // Bullet points
    .replace(/^[-•]\s+/gm, '  • ')
    // Code `text`
    .replace(/`(.*?)`/g, '<code>$1</code>')
    // Clean up extra newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
