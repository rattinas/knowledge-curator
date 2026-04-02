import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

let client: Anthropic | null = null;

function loadApiKey(): string {
  // First try process.env
  if (process.env.ANTHROPIC_API_KEY) {
    return process.env.ANTHROPIC_API_KEY;
  }

  // Fallback: read directly from .env.local
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/ANTHROPIC_API_KEY=(.+)/);
    if (match) {
      const key = match[1].trim();
      // Also set it in process.env for future calls
      process.env.ANTHROPIC_API_KEY = key;
      return key;
    }
  } catch (e) {
    // File not found, ignore
  }

  throw new Error('ANTHROPIC_API_KEY not found in env or .env.local');
}

export function getAI(): Anthropic {
  if (client) return client;

  const apiKey = loadApiKey();
  client = new Anthropic({ apiKey });
  console.log('[AI Client] Initialized, key starts with:', apiKey.substring(0, 12));
  return client;
}
