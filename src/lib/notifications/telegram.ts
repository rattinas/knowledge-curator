import type { Digest } from '@/types';
import { generateDigestPdf } from '../pdf/generate';
import { markDigestSent } from '../db/queries';
import fs from 'fs';

export async function sendDigestViaTelegram(
  botToken: string,
  chatId: string,
  digest: Digest,
  topicName: string
): Promise<boolean> {
  try {
    // 1. Send short summary message
    const message = formatShortDigest(digest, topicName);
    await sendTelegramMessage(botToken, chatId, message);

    // 2. Generate and send PDF with full report
    try {
      console.log(`[Telegram] Generating PDF for "${topicName}"...`);
      const pdfPath = await generateDigestPdf(digest, topicName);
      console.log(`[Telegram] PDF generated at: ${pdfPath}, size: ${fs.statSync(pdfPath).size} bytes`);

      // Sanitize filename - remove special chars that Telegram doesn't like
      const safeFilename = topicName.replace(/[^a-zA-Z0-9\- ]/g, '') + ' Digest ' + digest.digest_date + '.pdf';
      await sendTelegramDocument(botToken, chatId, pdfPath, safeFilename);
      console.log(`[Telegram] PDF sent for "${topicName}"`);
      // Mark as sent in DB
      try { markDigestSent(digest.id); } catch { /* ignore */ }
    } catch (pdfErr) {
      console.error('[Telegram] PDF failed, falling back to text:', (pdfErr as Error).message, (pdfErr as Error).stack);
      // Fallback: send full text version
      try {
        await sendFullTextDigest(botToken, chatId, digest);
        try { markDigestSent(digest.id); } catch { /* ignore */ }
      } catch (textErr) {
        console.error('[Telegram] Text fallback also failed:', textErr);
      }
    }

    return true;
  } catch (e) {
    console.error('[Telegram] Error:', e);
    return false;
  }
}

async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<void> {
  const chunks = splitMessage(text, 4000);
  for (const chunk of chunks) {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      console.error('[Telegram] Send failed:', err);
    }
  }
}

async function sendTelegramDocument(botToken: string, chatId: string, filePath: string, filename: string): Promise<void> {
  const fileBuffer = fs.readFileSync(filePath);

  // Build multipart form manually
  const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);

  const parts: Buffer[] = [];

  // chat_id field
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`
  ));

  // caption field
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n📄 Voller Digest-Report als PDF\r\n`
  ));

  // document field
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${filename}"\r\nContent-Type: application/pdf\r\n\r\n`
  ));
  parts.push(fileBuffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  const body = Buffer.concat(parts);

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Telegram sendDocument failed: ${JSON.stringify(err)}`);
  }

  // Clean up PDF file after sending
  try { fs.unlinkSync(filePath); } catch { /* ignore */ }
}

function formatShortDigest(digest: Digest, topicName: string): string {
  let msg = `📚 <b>${escHtml(digest.title)}</b>\n`;
  msg += `<i>${topicName} · ${digest.total_sources} Quellen · ~${digest.total_reading_min} Min.</i>\n\n`;

  // Executive Summary (kurz)
  const introShort = digest.intro_text.length > 500
    ? digest.intro_text.slice(0, 500) + '...'
    : digest.intro_text;
  msg += `${mdToTgHtml(introShort)}\n\n`;

  // Section overview
  for (const section of digest.sections) {
    const icon = sectionIcon(section.source_type);
    msg += `${icon} <b>${escHtml(section.title)}</b> (${section.items.length})\n`;
    for (const item of section.items.slice(0, 3)) {
      msg += `  • ${escHtml(item.title)}\n`;
    }
    if (section.items.length > 3) {
      msg += `  <i>+${section.items.length - 3} mehr im PDF</i>\n`;
    }
    msg += '\n';
  }

  msg += `📄 <b>Voller Report folgt als PDF...</b>`;
  return msg;
}

async function sendFullTextDigest(botToken: string, chatId: string, digest: Digest): Promise<void> {
  // Fallback if PDF fails — send full text in multiple messages
  for (const section of digest.sections) {
    let sectionMsg = `${sectionIcon(section.source_type)} <b>${escHtml(section.title)}</b>\n\n`;
    for (const item of section.items) {
      sectionMsg += `<b>${escHtml(item.title)}</b>\n`;
      if (item.author) sectionMsg += `<i>${escHtml(item.author)}</i>\n`;
      sectionMsg += `${mdToTgHtml(item.summary_text)}\n`;
      if (item.key_insights?.length > 0) {
        sectionMsg += `💡 ${item.key_insights.map(i => escHtml(i)).join(' · ')}\n`;
      }
      sectionMsg += `🔗 ${item.url}\n\n`;
    }
    await sendTelegramMessage(botToken, chatId, sectionMsg);
  }
}

function sectionIcon(sourceType: string): string {
  const icons: Record<string, string> = {
    youtube: '▶️', arxiv: '📄', podcast: '🎙', blog: '✍️', news: '📰',
  };
  return icons[sourceType] || '📋';
}

function escHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function mdToTgHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<i>$1</i>')
    .replace(/^#{1,3}\s+(.+)$/gm, '\n<b>$1</b>')
    .replace(/^[-•]\s+/gm, '  • ')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) { chunks.push(remaining); break; }
    let splitAt = remaining.lastIndexOf('\n', maxLen);
    if (splitAt < maxLen / 2) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  return chunks;
}

export async function testTelegramConnection(botToken: string, chatId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '✅ Knowledge Curator verbunden! Du bekommst ab jetzt deine Digests als Nachricht + PDF.',
        parse_mode: 'HTML',
      }),
    });
    const data = await res.json();
    if (!data.ok) return { ok: false, error: data.description };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
