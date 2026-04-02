import fs from 'fs';
import path from 'path';

export async function generateTranscriptPdf(title: string, transcript: string, sourceUrl: string): Promise<string> {
  const outputDir = path.join(process.cwd(), 'data', 'pdfs');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const filename = `transcript-${Date.now()}.pdf`;
  const filepath = path.join(outputDir, filename);

  // Write data to temp file
  const tmpData = path.join(outputDir, '_tmp_transcript.json');
  fs.writeFileSync(tmpData, JSON.stringify({ title, transcript, sourceUrl }));

  // Run in separate process
  const scriptPath = path.join(process.cwd(), 'src', 'lib', 'pdf', 'render-transcript.cjs');
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
    throw new Error('Transcript PDF generation failed');
  }

  return filepath;
}
