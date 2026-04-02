import fs from 'fs';
import path from 'path';
import type { Digest } from '@/types';

export async function generateDigestPdf(digest: Digest, topicName: string): Promise<string> {
  const outputDir = path.join(process.cwd(), 'data', 'pdfs');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const filename = `digest-${digest.digest_date}-${digest.id.slice(0, 8)}.pdf`;
  const filepath = path.join(outputDir, filename);

  // Write digest data to temp file
  const tmpData = path.join(outputDir, '_tmp_digest.json');
  fs.writeFileSync(tmpData, JSON.stringify({ digest, topicName }));

  // Run PDF generation in a separate Node process to avoid Turbopack issues
  const scriptPath = path.join(process.cwd(), 'src', 'lib', 'pdf', 'render.cjs');

  // Dynamic import to avoid Turbopack bundling child_process
  const { execSync } = await import('child_process');

  try {
    execSync(`node "${scriptPath}" "${tmpData}" "${filepath}"`, {
      timeout: 30000,
      cwd: process.cwd(),
    });
  } finally {
    try { fs.unlinkSync(tmpData); } catch { /* ignore */ }
  }

  if (!fs.existsSync(filepath)) {
    throw new Error('PDF generation failed - file not created');
  }

  return filepath;
}
