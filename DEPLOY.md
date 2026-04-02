# Knowledge Curator auf Raspberry Pi 4 (Home Assistant OS)

## Option A: Portainer Add-on (Empfohlen)

### 1. Portainer installieren
- Home Assistant → Einstellungen → Add-ons → Add-on Store
- Suche "Portainer" → Installieren → Starten

### 2. Docker Image bauen (auf deinem Mac)
```bash
cd knowledge-curator

# ARM64 Image fuer den Pi bauen
docker buildx build --platform linux/arm64 -t knowledge-curator:latest --load .

# Image exportieren
docker save knowledge-curator:latest | gzip > knowledge-curator.tar.gz
```

### 3. Image auf den Pi laden
- Oeffne Portainer im Browser: http://homeassistant.local:9000
- Gehe zu Images → Import
- Lade `knowledge-curator.tar.gz` hoch

### 4. Container starten
- Portainer → Containers → Add Container
- Image: `knowledge-curator:latest`
- Port: 3000 → 3000
- Volume: `/data/knowledge-curator` → `/app/data`
- Restart Policy: Always
- → Deploy

### 5. Einrichten
- Oeffne http://homeassistant.local:3000
- Settings → API Keys eintragen
- Settings → Telegram einrichten
- Settings → Scheduler starten
- Fertig! Laeuft 24/7.

---

## Option B: SSH + Docker direkt

### 1. SSH Add-on installieren
- HA → Add-ons → "Terminal & SSH" installieren
- SSH aktivieren, Passwort setzen

### 2. Via SSH verbinden
```bash
ssh root@homeassistant.local
```

### 3. Docker Container starten
```bash
# Auf dem Pi:
mkdir -p /root/knowledge-curator
cd /root/knowledge-curator

# Image von deinem Mac uebertragen (siehe Option A Schritt 2)
# Oder direkt auf dem Pi bauen (dauert ~30min auf Pi 4):
git clone <dein-repo> .
docker build -t knowledge-curator .
docker run -d \
  --name knowledge-curator \
  --restart always \
  -p 3000:3000 \
  -v curator-data:/app/data \
  knowledge-curator
```

---

## Option C: Als HA Add-on (Fortgeschritten)

### 1. Lokales Add-on Repository
- HA → Einstellungen → Add-ons → Repositories
- Fuege hinzu: `/addons/knowledge-curator`

### 2. Add-on Dateien per SSH kopieren
```bash
ssh root@homeassistant.local
mkdir -p /addons/knowledge-curator
# Kopiere alle Projektdateien + ha-addon/config.yaml
```

### 3. In HA installieren
- HA → Add-ons → Lokale Add-ons → Knowledge Curator → Installieren

---

## Nach dem Deployment

### Telegram Bot testen
Schicke deinem Bot `/start` — wenn er antwortet, laeuft alles.

### Auto-Crawl pruefen
Schicke `/status` — zeigt ob Topics faellig sind.

### Von ueberall erreichbar machen
Fuer Zugriff von ausserhalb deines Netzwerks:
- HA → Einstellungen → Netzwerk → DuckDNS oder Cloudflare Tunnel
- Oder: Nur Telegram nutzen (funktioniert ueberall)
