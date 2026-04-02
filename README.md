# Knowledge Curator

Dein persoenlicher KI-Assistent der taeglich das Internet durchsucht und dir die wichtigsten Erkenntnisse zusammenfasst.

**Quellen:** YouTube, arXiv, Podcasts, Blogs, News, Perplexity
**KI:** Anthropic Claude (Sonnet + Opus)
**Benachrichtigung:** Telegram Bot mit PDF-Reports

---

## Schnellstart

### Option A: Docker (Empfohlen)

```bash
docker build -t knowledge-curator .
docker run -d -p 3000:3000 -v curator-data:/app/data --restart always knowledge-curator
```

Oeffne http://localhost:3000

### Option B: Lokal mit Node.js

Voraussetzung: Node.js 20+

```bash
npm install
npm run build
npm start
```

Oeffne http://localhost:3000

---

## Einrichtung (2 Minuten)

1. Oeffne **http://localhost:3000/settings**
2. Trage deine API Keys ein:
   - **Anthropic** (Pflicht) — https://console.anthropic.com/settings/keys
   - **YouTube** (Optional, kostenlos) — https://console.cloud.google.com
   - **Perplexity** (Optional) — https://perplexity.ai/settings/api
   - **GNews** (Optional, kostenlos) — https://gnews.io
   - **Podcast Index** (Optional, kostenlos) — https://podcastindex.org
3. Richte **Telegram** ein (optional):
   - Erstelle einen Bot bei @BotFather in Telegram
   - Hole deine Chat ID bei @RawDataBot
   - Trage beides unter Settings ein
4. Klick **Scheduler starten**
5. Erstelle dein erstes Topic unter **Topics**

---

## Features

### Automatischer Digest
- Erstelle Topics mit Keywords
- Waehle Intervall: 2x taeglich bis monatlich
- Der Scheduler crawlt automatisch und sendet dir den Digest per Telegram + PDF

### Telegram Bot
Schicke deinem Bot Links und er fasst sie sofort zusammen:
- **Spotify** Podcast Links → findet YouTube-Transkript → Zusammenfassung + PDF
- **YouTube** Videos → Transkript → Zusammenfassung + PDF
- **Artikel/Blog** Links → Zusammenfassung

Bot-Befehle: `/start` `/topics` `/crawl` `/digest` `/status` `/history`

### Web-UI
- Topics mit Digest-History
- Lese-Ansicht (Instapaper-Style)
- Crawl-Pipeline Animation
- Mobile-ready (PWA)

---

## Kosten pro Topic/Crawl

| Service | Kosten |
|---------|--------|
| Anthropic Claude | ~$0.30-0.60 |
| YouTube, GNews, Podcast Index | Kostenlos |
| Perplexity | ~$0.05 |
| arXiv, Blogs/RSS | Kostenlos |

---

## Raspberry Pi / 24/7 Server

```bash
docker buildx build --platform linux/arm64 -t knowledge-curator .
docker save knowledge-curator | gzip > knowledge-curator.tar.gz
# Auf Pi uebertragen und starten
```

---

Powered by Anthropic Claude
