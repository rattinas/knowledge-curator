// Standalone PDF renderer - runs outside of Next.js/Turbopack
// Usage: node render.cjs <input.json> <output.pdf>

const fs = require('fs');
const PDFDocument = require('pdfkit');

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  console.error('Usage: node render.cjs <input.json> <output.pdf>');
  process.exit(1);
}

const { digest, topicName } = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

const COLORS = {
  primary: '#6366F1',
  text: '#0F172A',
  muted: '#64748B',
  light: '#F1F5F9',
  accent: '#F59E0B',
};

const SOURCE_LABELS = {
  youtube: { label: 'VIDEO', color: '#FF0000' },
  arxiv: { label: 'PAPER', color: '#B31B1B' },
  podcast: { label: 'PODCAST', color: '#1DB954' },
  blog: { label: 'BLOG', color: '#3B82F6' },
  news: { label: 'NEWS', color: '#F97316' },
};

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 50, bottom: 50, left: 50, right: 50 },
  info: {
    Title: digest.title,
    Author: 'Knowledge Curator',
    Subject: topicName,
  },
});

const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

const W = doc.page.width - 100;

// Header bar
doc.rect(0, 0, doc.page.width, 4).fill(COLORS.primary);

// Branding + Date
const dateStr = new Date(digest.digest_date).toLocaleDateString('de-DE', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
});
doc.fontSize(11).fillColor(COLORS.primary).font('Helvetica-Bold').text('KNOWLEDGE CURATOR', 50, 60);
doc.fontSize(10).fillColor(COLORS.muted).font('Helvetica').text(dateStr, 50, 60, { align: 'right' });

// Title
doc.moveDown(2);
doc.fontSize(24).fillColor(COLORS.text).font('Helvetica-Bold').text(digest.title, 50, doc.y, { width: W, lineGap: 4 });

// Meta
doc.moveDown(0.5);
doc.fontSize(10).fillColor(COLORS.muted).font('Helvetica')
  .text(`${topicName}  ·  ${digest.total_sources} Quellen  ·  ~${digest.total_reading_min} Min. Lesezeit`, { width: W });

// Divider
doc.moveDown(1);
doc.moveTo(50, doc.y).lineTo(50 + W, doc.y).strokeColor(COLORS.light).lineWidth(1).stroke();

// Executive Summary
doc.moveDown(1);
doc.fontSize(9).fillColor(COLORS.primary).font('Helvetica-Bold').text('EXECUTIVE SUMMARY', 50, doc.y, { width: W });
doc.moveDown(0.5);
doc.fontSize(10.5).fillColor(COLORS.text).font('Helvetica').text(digest.intro_text || '', 50, doc.y, { width: W, lineGap: 3 });

doc.moveDown(1.5);
doc.moveTo(50, doc.y).lineTo(50 + W, doc.y).strokeColor(COLORS.light).lineWidth(1).stroke();

// Sections
const sections = digest.sections || [];
for (const section of sections) {
  doc.moveDown(1.5);
  if (doc.y > doc.page.height - 150) {
    doc.addPage();
    doc.rect(0, 0, doc.page.width, 2).fill(COLORS.primary);
    doc.moveDown(1);
  }

  const src = SOURCE_LABELS[section.source_type] || { label: section.source_type.toUpperCase(), color: COLORS.primary };
  doc.fontSize(8).fillColor(src.color).font('Helvetica-Bold')
    .text(`${src.label}  —  ${section.title.toUpperCase()}`, 50, doc.y, { width: W });
  doc.moveDown(0.3);
  doc.moveTo(50, doc.y).lineTo(50 + W, doc.y).strokeColor(src.color).lineWidth(0.5).opacity(0.3).stroke();
  doc.opacity(1);
  doc.moveDown(0.8);

  const items = section.items || [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (doc.y > doc.page.height - 180) {
      doc.addPage();
      doc.rect(0, 0, doc.page.width, 2).fill(COLORS.primary);
      doc.moveDown(1);
    }

    // Title
    doc.fontSize(11).fillColor(COLORS.text).font('Helvetica-Bold').text(item.title || '', 50, doc.y, { width: W });

    // Author + meta
    const meta = [item.author, `~${item.reading_time_min || 2}m`, `Score: ${item.relevance_score}/10`].filter(Boolean).join('  ·  ');
    doc.fontSize(8).fillColor(COLORS.muted).font('Helvetica').text(meta, 50, doc.y, { width: W });
    doc.moveDown(0.4);

    // Summary with bold support
    renderRichText(doc, item.summary_text || '', 50, W);

    // Key Insights
    if (item.key_insights && item.key_insights.length > 0) {
      doc.moveDown(0.4);
      doc.fontSize(8).fillColor(COLORS.accent).font('Helvetica-Bold').text('KEY INSIGHTS:', 50, doc.y);
      doc.moveDown(0.2);
      for (const insight of item.key_insights) {
        doc.fontSize(8.5).fillColor('#475569').font('Helvetica').text(`→  ${insight}`, 58, doc.y, { width: W - 16, lineGap: 1 });
        doc.moveDown(0.15);
      }
    }

    // Link
    doc.moveDown(0.3);
    doc.fontSize(7.5).fillColor(COLORS.primary).font('Helvetica').text(item.url || '', 50, doc.y, { width: W, link: item.url, underline: true });

    // Separator
    if (i < items.length - 1) {
      doc.moveDown(0.8);
      doc.moveTo(70, doc.y).lineTo(50 + W - 20, doc.y).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
      doc.moveDown(0.8);
    }
  }
}

// Footer
doc.moveDown(2);
if (doc.y > doc.page.height - 80) doc.addPage();
doc.moveTo(50, doc.y).lineTo(50 + W, doc.y).strokeColor(COLORS.light).lineWidth(1).stroke();
doc.moveDown(0.5);
doc.fontSize(8).fillColor(COLORS.muted).font('Helvetica')
  .text(`Generiert von Knowledge Curator  ·  ${dateStr}  ·  Powered by Anthropic Claude`, 50, doc.y, { width: W, align: 'center' });

doc.end();

function renderRichText(doc, text, x, width) {
  // Clean markdown
  let cleaned = text
    .replace(/#{1,3}\s*/g, '')
    .replace(/`(.*?)`/g, '$1');

  // Split into paragraphs
  const paragraphs = cleaned.split(/\n\n+/);

  for (const para of paragraphs) {
    const lines = para.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Page break check
      if (doc.y > doc.page.height - 60) {
        doc.addPage();
        doc.rect(0, 0, doc.page.width, 2).fill('#6366F1');
        doc.moveDown(1);
      }

      // Detect bullets/numbered lists
      const isBullet = /^[-•]\s/.test(trimmed);
      const isNumbered = /^\d+\.\s/.test(trimmed);
      let lineText = trimmed;
      let prefix = '';
      let lineX = x;

      if (isBullet) {
        lineText = trimmed.replace(/^[-•]\s*/, '');
        prefix = '  •  ';
        lineX = x;
      } else if (isNumbered) {
        const num = trimmed.match(/^(\d+\.)\s*/);
        prefix = '  ' + (num ? num[1] : '') + '  ';
        lineText = trimmed.replace(/^\d+\.\s*/, '');
        lineX = x;
      }

      // Strip bold markers and render as single text block
      // (PDFKit continued:true is buggy, so we render clean text)
      const cleanText = prefix + lineText.replace(/\*\*(.*?)\*\*/g, '$1');

      doc.fontSize(9.5).fillColor('#334155').font('Helvetica')
        .text(cleanText, lineX, doc.y, { width: width, lineGap: 2 });
    }
    doc.moveDown(0.3);
  }
}

stream.on('finish', () => {
  console.log('PDF generated:', outputPath, fs.statSync(outputPath).size, 'bytes');
  process.exit(0);
});

stream.on('error', (err) => {
  console.error('PDF error:', err);
  process.exit(1);
});
