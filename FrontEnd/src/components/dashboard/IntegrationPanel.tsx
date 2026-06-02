// ---------------------------------------------------------------------------
// ThreatFlix — IntegrationPanel
// API Keys + Webhooks management in a two-column glass layout.
// ---------------------------------------------------------------------------

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  getApiKeys,
  createApiKey,
  getWebhooks,
  createWebhook,
  deleteWebhook,
  type ApiKey,
  type Webhook,
} from "../../api/client";
import { GlassCard } from "../ui/GlassCard";

// ── Helpers ──────────────────────────────────────────────────────────────────

function maskKey(key: string): string {
  if (key.length <= 8) return key;
  const last4 = key.slice(-4);
  return `sk-****-${last4}`;
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function truncateUrl(url: string, max = 38): string {
  return url.length > max ? url.slice(0, max) + "…" : url;
}

// ── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "8px 12px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--glass-border)",
  background: "var(--bg-deep)",
  color: "var(--text-primary)",
  fontFamily: "var(--font-mono)",
  fontSize: "0.8rem",
  outline: "none",
};

const btnPrimary: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--ember-warm)",
  background: "rgba(232, 148, 58, 0.12)",
  color: "var(--ember-warm)",
  fontFamily: "var(--font-primary)",
  fontSize: "0.8rem",
  fontWeight: 600,
  cursor: "pointer",
  transition: "all var(--transition-fast)",
  whiteSpace: "nowrap",
};

const btnDanger: React.CSSProperties = {
  padding: "5px 12px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--severity-critical)",
  background: "transparent",
  color: "var(--severity-critical)",
  fontFamily: "var(--font-primary)",
  fontSize: "0.72rem",
  fontWeight: 500,
  cursor: "pointer",
  transition: "all var(--transition-fast)",
};

// ── Component ────────────────────────────────────────────────────────────────

export function IntegrationPanel() {
  const { auth } = useAuth();

  // API Keys state
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Webhooks state
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Fetch on mount
  useEffect(() => {
    (async () => {
      try {
        const [keysRes, whRes] = await Promise.all([
          getApiKeys(),
          getWebhooks(),
        ]);
        setKeys(keysRes.keys || []);
        setWebhooks(whRes.webhooks || []);
      } catch {
        // ignore
      }
    })();
  }, []);

  // ── API Key handlers ─────────────────────────────────────────────────────

  const handleGenerateKey = useCallback(async () => {
    if (!newKeyLabel.trim()) return;
    try {
      const result = await createApiKey(newKeyLabel.trim());
      setGeneratedKey(result.key);
      setNewKeyLabel("");
      // Refresh key list
      const { keys: refreshed } = await getApiKeys();
      setKeys(refreshed || []);
    } catch {
      // ignore
    }
  }, [newKeyLabel]);

  const handleCopy = useCallback(async (key: string, id: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedKeyId(id);
      setTimeout(() => setCopiedKeyId(null), 2000);
    } catch {
      // fallback
    }
  }, []);

  // ── Webhook handlers ─────────────────────────────────────────────────────

  const handleRegisterWebhook = useCallback(async () => {
    if (!newWebhookUrl.trim()) return;
    try {
      const wh = await createWebhook(newWebhookUrl.trim());
      setWebhooks((prev) => [...prev, wh]);
      setNewWebhookUrl("");
    } catch {
      // ignore
    }
  }, [newWebhookUrl]);

  const handleDeleteWebhook = useCallback(async (id: string) => {
    try {
      await deleteWebhook(id);
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      setConfirmDeleteId(null);
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="flex flex-col md:flex-row gap-6 w-full">
      {/* ─── API Keys Column ─────────────────────────────────────────── */}
      <div className="flex-1">
        <GlassCard level="light">
          <div style={{ padding: 20 }}>
            <h3
              style={{
                fontFamily: "var(--font-primary)",
                fontWeight: 700,
                fontSize: "1rem",
                color: "var(--text-primary)",
                margin: "0 0 16px 0",
                letterSpacing: "0.04em",
              }}
            >
              🔑 API KEYS
            </h3>

            {/* Key list */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginBottom: 16,
              }}
            >
              {keys.length === 0 && (
                <p
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "0.82rem",
                    margin: 0,
                  }}
                >
                  No API keys yet.
                </p>
              )}
              {keys.map((k) => (
                <div
                  key={k.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--bg-deep)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.78rem",
                      color: "var(--text-primary)",
                      flex: 1,
                    }}
                  >
                    {maskKey(k.key)}
                  </span>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--text-muted)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {k.label}
                  </span>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      color: "var(--text-muted)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatDate(k.createdAt)}
                  </span>
                  <button
                    onClick={() => handleCopy(k.key, k.key)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "1px solid var(--glass-border)",
                      background: "transparent",
                      color:
                        copiedKeyId === k.key
                          ? "var(--ember-hot)"
                          : "var(--text-secondary)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.7rem",
                      cursor: "pointer",
                      transition: "all var(--transition-fast)",
                      minWidth: 72,
                    }}
                  >
                    {copiedKeyId === k.key ? "✓ Copied" : "Copy"}
                  </button>
                </div>
              ))}
            </div>

            {/* Generated key highlight */}
            {generatedKey && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--radius-sm)",
                  background: "rgba(255, 107, 53, 0.08)",
                  border: "1px solid var(--ember-hot)",
                  marginBottom: 16,
                }}
              >
                <span
                  className="text-label"
                  style={{ display: "block", marginBottom: 4 }}
                >
                  New Key (copy now — won't be shown again)
                </span>
                <code
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.82rem",
                    color: "var(--ember-glow)",
                    wordBreak: "break-all",
                  }}
                >
                  {generatedKey}
                </code>
              </div>
            )}

            {/* Generate new key */}
            {!showKeyForm ? (
              <button
                onClick={() => {
                  setShowKeyForm(true);
                  setGeneratedKey(null);
                }}
                style={btnPrimary}
              >
                + Generate New Key
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)}
                  placeholder="Key label (e.g. production)"
                  style={inputStyle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleGenerateKey();
                  }}
                />
                <button onClick={handleGenerateKey} style={btnPrimary}>
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowKeyForm(false);
                    setNewKeyLabel("");
                  }}
                  style={{
                    ...btnPrimary,
                    borderColor: "var(--text-muted)",
                    color: "var(--text-muted)",
                    background: "transparent",
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* ─── Webhooks Column ─────────────────────────────────────────── */}
      <div className="flex-1">
        <GlassCard level="light">
          <div style={{ padding: 20 }}>
            <h3
              style={{
                fontFamily: "var(--font-primary)",
                fontWeight: 700,
                fontSize: "1rem",
                color: "var(--text-primary)",
                margin: "0 0 16px 0",
                letterSpacing: "0.04em",
              }}
            >
              🔗 WEBHOOKS
            </h3>

            {/* Webhook list */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginBottom: 16,
              }}
            >
              {webhooks.length === 0 && (
                <p
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "0.82rem",
                    margin: 0,
                  }}
                >
                  No webhooks registered.
                </p>
              )}
              {webhooks.map((wh) => (
                <div
                  key={wh.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--bg-deep)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.76rem",
                      color: "var(--text-primary)",
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={wh.url}
                  >
                    {truncateUrl(wh.url)}
                  </span>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      color: "var(--text-muted)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatDate(wh.createdAt)}
                  </span>
                  {/* Status badge */}
                  <span
                    style={{
                      fontSize: "0.65rem",
                      fontWeight: 600,
                      color: "var(--severity-low)",
                      background: "rgba(126, 184, 126, 0.12)",
                      padding: "2px 8px",
                      borderRadius: 999,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Active
                  </span>
                  {/* Delete */}
                  {confirmDeleteId === wh.id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDeleteWebhook(wh.id)}
                        style={{
                          ...btnDanger,
                          background: "rgba(255, 77, 77, 0.12)",
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        style={{
                          ...btnDanger,
                          borderColor: "var(--text-muted)",
                          color: "var(--text-muted)",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(wh.id)}
                      style={btnDanger}
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Register webhook form */}
            <div className="flex gap-2">
              <input
                value={newWebhookUrl}
                onChange={(e) => setNewWebhookUrl(e.target.value)}
                placeholder="https://your-endpoint.com/webhook"
                style={inputStyle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRegisterWebhook();
                }}
              />
              <button onClick={handleRegisterWebhook} style={btnPrimary}>
                Register
              </button>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
