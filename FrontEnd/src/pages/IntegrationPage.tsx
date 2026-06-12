import { useEffect, useMemo, useState } from "react";
import { createApiKey, getApiKeys, type ApiKey } from "../api/client";
import { useAuth } from "../context/AuthContext";

export function IntegrationPage() {
  const { auth } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [label, setLabel] = useState("Northstar identity service");
  const [generatedKey, setGeneratedKey] = useState("");
  const [copied, setCopied] = useState<"key" | "snippet">();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    getApiKeys()
      .then((result) => setKeys(result.keys))
      .catch((reason) => setError((reason as Error).message));
  }, []);

  const snippet = useMemo(() => `import SecurityAI from "../SDK/src/index.ts";

export const THREATFLIX_API_KEY = "${generatedKey || "PASTE_GENERATED_KEY_HERE"}";

export const threatflix = new SecurityAI({
  apiKey: THREATFLIX_API_KEY,
  projectId: "${auth?.projectId ?? "your-project-id"}",
  backendUrl: "http://127.0.0.1:8000/api",
});`, [auth?.projectId, generatedKey]);

  async function generate() {
    if (!label.trim()) return;
    setCreating(true);
    setError(undefined);
    try {
      const result = await createApiKey(label.trim());
      setGeneratedKey(result.key);
      const refreshed = await getApiKeys();
      setKeys(refreshed.keys);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function copy(value: string, target: "key" | "snippet") {
    await navigator.clipboard.writeText(value);
    setCopied(target);
    window.setTimeout(() => setCopied(undefined), 1_500);
  }

  return (
    <main className="integration-page">
      <header className="integration-header">
        <div>
          <span className="section-index">02</span>
          <h1>Connect an application</h1>
          <p>Generate a tenant-scoped key, initialize the SDK, then emit security events from existing application actions.</p>
        </div>
        <div className="integration-project">
          <span>Project ID</span>
          <code>{auth?.projectId}</code>
        </div>
      </header>

      <section className="integration-steps">
        <article className="integration-step integration-key-step">
          <div className="integration-step-number">01</div>
          <div className="integration-step-content">
            <h2>Generate a project key</h2>
            <p>The SDK uses this key to deliver telemetry only to this ThreatFlix tenant.</p>
            <div className="integration-key-form">
              <input value={label} onChange={(event) => setLabel(event.target.value)} aria-label="API key label" />
              <button onClick={generate} disabled={creating} type="button">
                {creating ? "Generating..." : "Generate API key"}
              </button>
            </div>
            {generatedKey ? (
              <div className="integration-generated-key">
                <div><span>New project key</span><strong>Copy it into Northstar now</strong></div>
                <code>{generatedKey}</code>
                <button onClick={() => copy(generatedKey, "key")} type="button">
                  {copied === "key" ? "Copied" : "Copy key"}
                </button>
              </div>
            ) : null}
            {error ? <p className="inline-error">{error}</p> : null}
          </div>
        </article>

        <article className="integration-step integration-code-step">
          <div className="integration-step-number">02</div>
          <div className="integration-step-content">
            <h2>Initialize the SDK</h2>
            <p>For the demo, write this small block into <code>JudgeDemo/threatflix.ts</code>.</p>
            <pre><code>{snippet}</code></pre>
            <button className="integration-copy-code" onClick={() => copy(snippet, "snippet")} type="button">
              {copied === "snippet" ? "Snippet copied" : "Copy SDK snippet"}
            </button>
          </div>
        </article>

        <article className="integration-step integration-event-step">
          <div className="integration-step-number">03</div>
          <div className="integration-step-content">
            <h2>Instrument an application action</h2>
            <p>Emit domain telemetry where the action already occurs. ThreatFlix owns the detection logic.</p>
            <pre><code>{`await threatflix.event("failed_login", {
  user: email,
  ip: requestIp,
  service: "northstar-identity",
  sessionId,
});`}</code></pre>
          </div>
        </article>
      </section>

      <section className="integration-existing">
        <div className="section-heading">
          <div><span className="section-index">04</span><h2>Active project keys</h2></div>
          <span className="quiet-count">{keys.length} active</span>
        </div>
        {keys.length ? keys.map((key) => (
          <div className="integration-key-row" key={key.key}>
            <span>{key.label}</span>
            <code>{maskKey(key.key)}</code>
            <time>{new Date(key.createdAt).toLocaleString()}</time>
          </div>
        )) : <p className="quiet-state">No project key has been generated yet.</p>}
      </section>
    </main>
  );
}

function maskKey(key: string): string {
  return `${key.slice(0, 7)}...${key.slice(-6)}`;
}
