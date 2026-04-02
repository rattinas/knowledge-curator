import { NextResponse } from 'next/server';
import { getNotificationSettings, upsertNotificationSettings, deleteNotificationSettings } from '@/lib/db/queries';
import { testTelegramConnection } from '@/lib/notifications/telegram';

export async function GET() {
  const settings = getNotificationSettings();
  if (!settings) return NextResponse.json(null);
  return NextResponse.json({
    ...settings,
    bot_token: settings.bot_token ? maskToken(settings.bot_token) : null,
  });
}

export async function POST(req: Request) {
  const { bot_token, chat_id } = await req.json();
  if (!bot_token || !chat_id) {
    return NextResponse.json({ error: 'bot_token and chat_id required' }, { status: 400 });
  }

  // Test connection first
  const test = await testTelegramConnection(bot_token, chat_id);
  if (!test.ok) {
    return NextResponse.json({ error: `Telegram-Verbindung fehlgeschlagen: ${test.error}` }, { status: 400 });
  }

  upsertNotificationSettings(bot_token, chat_id);
  return NextResponse.json({ ok: true, message: 'Telegram verbunden!' });
}

export async function DELETE() {
  deleteNotificationSettings();
  return NextResponse.json({ ok: true });
}

function maskToken(token: string): string {
  if (token.length < 15) return '••••••••';
  return token.substring(0, 6) + '••••' + token.substring(token.length - 4);
}
