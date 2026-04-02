// Standalone transcript PDF renderer
// Usage: node render-transcript.cjs <input.json> <output.pdf>

const fs = require('fs');
const PDFDocument = require('pdfkit');

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  console.error('Usage: node render-transcript.cjs <input.json> <output.pdf>');
  process.exit(1);
}

const { title, transcript, sourceUrl } = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 50, bottom: 50, left: 50, right: 50 },
  info: { Title: title, Author: 'Knowledge Curator' },
});

const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

const W = doc.page.width - 100;

// Header
doc.rect(0, 0, doc.page.width, 4).fill('#6366F1');

doc.fontSize(11).fillColor('#6366F1').font('Helvetica-Bold').text('KNOWLEDGE CURATOR — TRANSKRIPT', 50, 60);
doc.fontSize(10).fillColor('#64748B').font('Helvetica').text(new Date().toLocaleDateString('de-DE', {
  year: 'numeric', month: 'long', day: 'numeric',
}), 50, 60, { align: 'right' });

// Title
doc.moveDown(2);
doc.fontSize(20).fillColor('#0F172A').font('Helvetica-Bold').text(title, 50, doc.y, { width: W, lineGap: 3 });

// Source URL
doc.moveDown(0.5);
doc.fontSize(8).fillColor('#6366F1').font('Helvetica').text(sourceUrl, 50, doc.y, { width: W, link: sourceUrl, underline: true });

// Word count + estimated reading time
const wordCount = transcript.split(/\s+/).length;
const readingMin = Math.ceil(wordCount / 200);
doc.moveDown(0.5);
doc.fontSize(9).fillColor('#64748B').font('Helvetica')
  .text(`${wordCount.toLocaleString('de-DE')} Woerter  ·  ~${readingMin} Min. Lesezeit`, { width: W });

// Divider
doc.moveDown(1);
doc.moveTo(50, doc.y).lineTo(50 + W, doc.y).strokeColor('#E2E8F0').lineWidth(1).stroke();
doc.moveDown(1);

// Transcript body — split into paragraphs for better readability
// Add paragraph breaks every ~300 words
const words = transcript.split(/\s+/);
const paragraphs = [];
for (let i = 0; i < words.length; i += 300) {
  paragraphs.push(words.slice(i, i + 300).join(' '));
}

for (const para of paragraphs) {
  if (doc.y > doc.page.height - 80) {
    doc.addPage();
    doc.rect(0, 0, doc.page.width, 2).fill('#6366F1');
    doc.moveDown(1);
  }
  doc.fontSize(9.5).fillColor('#334155').font('Helvetica').text(para, 50, doc.y, { width: W, lineGap: 3 });
  doc.moveDown(0.8);
}

// Footer
doc.moveDown(1);
if (doc.y > doc.page.height - 60) doc.addPage();
doc.moveTo(50, doc.y).lineTo(50 + W, doc.y).strokeColor('#E2E8F0').lineWidth(1).stroke();
doc.moveDown(0.5);
doc.fontSize(8).fillColor('#64748B').font('Helvetica')
  .text('Transkript generiert von Knowledge Curator · Powered by Anthropic Claude', 50, doc.y, { width: W, align: 'center' });

doc.end();

stream.on('finish', () => {
  console.log('Transcript PDF generated:', outputPath, fs.statSync(outputPath).size, 'bytes');
  process.exit(0);
});

stream.on('error', (err) => {
  console.error('PDF error:', err);
  process.exit(1);
});
