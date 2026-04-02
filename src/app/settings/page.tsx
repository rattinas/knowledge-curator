'use client';
import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/Button';

interface ApiKeyEntry {
  service: string;
  label: string;
  description: string;
  required: boolean;
  hasSecret?: boolean;
  secretLabel?: string;
  docsUrl?: string;
  icon: string;
  color: string;
}

const API_SERVICES: ApiKeyEntry[] = [
  { service: 'anthropic', label: 'Anthropic (Claude)', description: 'Pflicht — wird fuer KI-Filterung und Zusammenfassung benoetigt', required: true, docsUrl: 'https://console.anthropic.com/settings/keys', icon: '🧠', color: 'bg-violet-500' },
  { service: 'perplexity', label: 'Perplexity', description: 'Echtzeit-Websuche — findet die neuesten Inhalte im gesamten Internet', required: false, docsUrl: 'https://www.perplexity.ai/settings/api', icon: '🔍', color: 'bg-blue-500' },
  { service: 'youtube', label: 'YouTube Data API', description: 'YouTube-Videos und Transkripte durchsuchen', required: false, docsUrl: 'https://console.cloud.google.com/apis/api/youtube.googleapis.com', icon: '▶️', color: 'bg-red-500' },
  { service: 'gnews', label: 'GNews', description: 'Aktuelle Nachrichten-Artikel durchsuchen', required: false, docsUrl: 'https://gnews.io', icon: '📰', color: 'bg-orange-500' },
  { service: 'podcast_index', label: 'Podcast Index', description: 'Podcasts durchsuchen', required: false, hasSecret: true, secretLabel: 'API Secret', docsUrl: 'https://podcastindex.org', icon: '🎙️', color: 'bg-green-500' },
];

interface SavedKey {
  service: string;
  api_key: string;
  api_secret: string | null;
  is_valid: boolean;
}

export default function SettingsPage() {
  const [savedKeys, setSavedKeys] = useState<SavedKey[]>([]);
  const [editingService, setEditingService] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [secretInput, setSecretInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings/keys').then(r => r.json()).then(setSavedKeys);
  }, []);

  const saveKey = async (service: string, hasSecret?: boolean) => {
    if (!keyInput.trim()) return;
    setSaving(true);
    await fetch('/api/settings/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service,
        api_key: keyInput.trim(),
        api_secret: hasSecret ? secretInput.trim() : undefined,
      }),
    });
    const updated = await fetch('/api/settings/keys').then(r => r.json());
    setSavedKeys(updated);
    setEditingService(null);
    setKeyInput('');
    setSecretInput('');
    setSaving(false);
  };

  const removeKey = async (service: string) => {
    await fetch('/api/settings/keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service }),
    });
    setSavedKeys(savedKeys.filter(k => k.service !== service));
  };

  const isConnected = (service: string) => savedKeys.some(k => k.service === service);
  const getKey = (service: string) => savedKeys.find(k => k.service === service);

  return (
    <>
      <Header title="Einstellungen" subtitle="API Keys & Konfiguration" />
      <PageShell className="py-6 space-y-4">

        {/* Status Overview */}
        <div className="grid grid-cols-3 gap-3 mb-2">
          <div className="bg-card rounded-2xl border border-border p-3 text-center">
            <div className="text-2xl font-heading font-bold text-primary">
              {savedKeys.filter(k => k.is_valid).length}
            </div>
            <div className="text-xs text-muted mt-0.5">Verbunden</div>
          </div>
          <div className="bg-card rounded-2xl border border-border p-3 text-center">
            <div className="text-2xl font-heading font-bold text-secondary">
              {API_SERVICES.length}
            </div>
            <div className="text-xs text-muted mt-0.5">Verfuegbar</div>
          </div>
          <div className="bg-card rounded-2xl border border-border p-3 text-center">
            <div className="text-2xl font-heading font-bold text-accent">
              {API_SERVICES.filter(s => !s.required && !isConnected(s.service)).length}
            </div>
            <div className="text-xs text-muted mt-0.5">Optional</div>
          </div>
        </div>

        {/* API Keys List */}
        {API_SERVICES.map(svc => {
          const connected = isConnected(svc.service);
          const key = getKey(svc.service);
          const isEditing = editingService === svc.service;

          return (
            <div
              key={svc.service}
              className={`bg-card rounded-2xl border overflow-hidden transition-all ${
                connected ? 'border-secondary/30' : svc.required ? 'border-destructive/30' : 'border-border'
              }`}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl ${svc.color} flex items-center justify-center text-white text-lg shrink-0`}>
                    {svc.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading font-semibold text-sm">{svc.label}</h3>
                      {svc.required && (
                        <span className="px-1.5 py-0.5 bg-destructive/10 text-destructive text-[10px] font-bold rounded-md uppercase">Pflicht</span>
                      )}
                      {connected && (
                        <span className="px-1.5 py-0.5 bg-secondary/10 text-secondary text-[10px] font-bold rounded-md uppercase">Verbunden</span>
                      )}
                    </div>
                    <p className="text-xs text-muted mt-0.5 leading-relaxed">{svc.description}</p>

                    {connected && key && !isEditing && (
                      <div className="mt-2 flex items-center gap-2">
                        <code className="text-xs bg-muted-light px-2 py-1 rounded-lg font-mono text-muted">
                          {key.api_key}
                        </code>
                      </div>
                    )}
                  </div>
                </div>

                {/* Edit Form */}
                {isEditing && (
                  <div className="mt-3 space-y-2">
                    <input
                      type="password"
                      value={keyInput}
                      onChange={e => setKeyInput(e.target.value)}
                      placeholder="API Key eingeben..."
                      className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                      autoFocus
                    />
                    {svc.hasSecret && (
                      <input
                        type="password"
                        value={secretInput}
                        onChange={e => setSecretInput(e.target.value)}
                        placeholder={svc.secretLabel || 'API Secret eingeben...'}
                        className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveKey(svc.service, svc.hasSecret)} loading={saving} className="flex-1">
                        Speichern
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingService(null); setKeyInput(''); setSecretInput(''); }}>
                        Abbrechen
                      </Button>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {!isEditing && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant={connected ? 'secondary' : 'primary'}
                      onClick={() => { setEditingService(svc.service); setKeyInput(''); setSecretInput(''); }}
                      className="flex-1"
                    >
                      {connected ? 'Key aendern' : 'Key hinzufuegen'}
                    </Button>
                    {svc.docsUrl && (
                      <a
                        href={svc.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center h-8 px-3 rounded-lg text-xs text-muted hover:text-foreground hover:bg-muted-light transition-colors min-h-[44px]"
                      >
                        Docs ↗
                      </a>
                    )}
                    {connected && (
                      <button
                        onClick={() => removeKey(svc.service)}
                        className="flex items-center justify-center h-8 px-3 rounded-lg text-xs text-destructive hover:bg-destructive/10 transition-colors min-h-[44px]"
                      >
                        Entfernen
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Telegram Notifications */}
        <TelegramSetup />

        {/* Info Footer */}
        <div className="bg-card rounded-2xl border border-border p-4 mt-6">
          <h3 className="font-heading font-semibold text-sm mb-2">Kosten-Schaetzung</h3>
          <div className="space-y-1.5 text-xs text-muted">
            <div className="flex justify-between">
              <span>Anthropic (Opus) pro Topic/Tag</span>
              <span className="font-mono">~$0.60</span>
            </div>
            <div className="flex justify-between">
              <span>Perplexity pro Topic/Tag</span>
              <span className="font-mono">~$0.05</span>
            </div>
            <div className="flex justify-between">
              <span>YouTube, GNews, Podcast Index</span>
              <span className="font-mono text-secondary">Kostenlos</span>
            </div>
            <div className="flex justify-between">
              <span>arXiv, Blogs/RSS</span>
              <span className="font-mono text-secondary">Kein Key noetig</span>
            </div>
            <div className="border-t border-border pt-1.5 mt-1.5 flex justify-between font-medium text-foreground">
              <span>Gesamt pro Topic/Tag</span>
              <span className="font-mono">~$0.65</span>
            </div>
          </div>
        </div>

        {/* Scheduler */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-white text-lg">⏰</div>
            <div>
              <h3 className="font-heading font-semibold text-sm">Auto-Scheduler</h3>
              <p className="text-xs text-muted">Crawlt automatisch basierend auf Topic-Intervallen</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              await fetch('/api/scheduler', { method: 'POST' });
              alert('Scheduler gestartet! Prueft alle 15 Minuten ob Topics gecrawlt werden muessen.');
            }}
            className="w-full mt-2"
          >
            Scheduler starten
          </Button>
        </div>

        <p className="text-center text-xs text-muted py-2">
          Knowledge Curator v1.2 — Powered by Anthropic Claude
        </p>
      </PageShell>
    </>
  );
}

// ── Telegram Setup Component ──

function TelegramSetup() {
  const [settings, setSettings] = useState<{ bot_token: string; chat_id: string } | null>(null);
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/settings/telegram').then(r => r.json()).then(data => {
      if (data) setSettings(data);
    });
  }, []);

  const save = async () => {
    if (!botToken || !chatId) return;
    setSaving(true);
    setError('');
    const res = await fetch('/api/settings/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bot_token: botToken, chat_id: chatId }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    const updated = await fetch('/api/settings/telegram').then(r => r.json());
    setSettings(updated);
    setIsEditing(false);
    setBotToken('');
    setChatId('');
  };

  const disconnect = async () => {
    await fetch('/api/settings/telegram', { method: 'DELETE' });
    setSettings(null);
  };

  return (
    <div className={`bg-card rounded-2xl border overflow-hidden ${settings ? 'border-secondary/30' : 'border-border'}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500 flex items-center justify-center text-white text-lg shrink-0">
            ✈️
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-semibold text-sm">Telegram Benachrichtigungen</h3>
              {settings && (
                <span className="px-1.5 py-0.5 bg-secondary/10 text-secondary text-[10px] font-bold rounded-md uppercase">Aktiv</span>
              )}
            </div>
            <p className="text-xs text-muted mt-0.5 leading-relaxed">
              Erhalte deine Digests automatisch als Telegram-Nachricht.
            </p>

            {settings && !isEditing && (
              <div className="mt-2">
                <code className="text-xs bg-muted-light px-2 py-1 rounded-lg font-mono text-muted">
                  Chat: {settings.chat_id}
                </code>
              </div>
            )}
          </div>
        </div>

        {isEditing && (
          <div className="mt-3 space-y-2">
            <div>
              <label className="text-xs text-muted block mb-1">Bot Token (von @BotFather)</label>
              <input
                type="password"
                value={botToken}
                onChange={e => setBotToken(e.target.value)}
                placeholder="123456:ABC-DEF..."
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Chat ID (von @userinfobot)</label>
              <input
                type="text"
                value={chatId}
                onChange={e => setChatId(e.target.value)}
                placeholder="123456789"
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={save} loading={saving} className="flex-1">
                Verbinden & Testen
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>Abbrechen</Button>
            </div>
          </div>
        )}

        {!isEditing && (
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant={settings ? 'secondary' : 'primary'}
              onClick={() => setIsEditing(true)}
              className="flex-1"
            >
              {settings ? 'Einstellungen aendern' : 'Telegram einrichten'}
            </Button>
            {settings && (
              <button
                onClick={disconnect}
                className="flex items-center justify-center h-8 px-3 rounded-lg text-xs text-destructive hover:bg-destructive/10 transition-colors min-h-[44px]"
              >
                Trennen
              </button>
            )}
          </div>
        )}

        {!isEditing && !settings && (
          <div className="mt-3 bg-muted-light rounded-xl p-3 text-xs text-muted leading-relaxed">
            <strong>So geht's:</strong><br />
            1. Oeffne Telegram und suche @BotFather<br />
            2. Sende /newbot und folge den Anweisungen<br />
            3. Kopiere den Bot Token<br />
            4. Suche @userinfobot fuer deine Chat ID<br />
            5. Starte deinen Bot (sende /start)
          </div>
        )}
      </div>
    </div>
  );
}
