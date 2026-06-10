import { useEffect, useState, type FormEvent } from "react";
import {
  getInvestigationChat,
  sendInvestigationChat,
  type Alert,
  type LlmChatMessage,
} from "../../api/client";

export function SocChatDrawer({ investigation }: { investigation: Alert }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<LlmChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMessages([]);
    setError(null);
    if (!open || investigation.source !== "investigation") return;
    getInvestigationChat(investigation.id)
      .then((response) => setMessages(response.messages))
      .catch((reason) => setError(reason.message));
  }, [investigation.id, investigation.source, open]);

  if (investigation.source !== "investigation") return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sending) return;
    setSending(true);
    setError(null);
    setDraft("");
    try {
      const response = await sendInvestigationChat(investigation.id, message);
      setMessages((current) => [
        ...current,
        {
          id: `local-${Date.now()}`,
          investigationId: investigation.id,
          projectId: investigation.projectId,
          reportId: response.message.reportId,
          contextVersion: response.message.contextVersion,
          role: "analyst",
          content: message,
          referencedSourceIds: [],
          createdAt: new Date().toISOString(),
        },
        response.message,
      ]);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button className="chat-launcher" onClick={() => setOpen(true)} type="button" aria-expanded={open}>
        <span>Ask SOC assistant</span>
        <span className="chat-launcher-key">/</span>
      </button>
      {open ? (
        <aside className="chat-drawer" aria-label="SOC assistant">
          <div className="chat-drawer-header">
            <div>
              <span className="eyebrow">Grounded in this case</span>
              <h3>SOC assistant</h3>
            </div>
            <button className="icon-button" onClick={() => setOpen(false)} type="button" aria-label="Close chat">
              X
            </button>
          </div>
          <div className="chat-log">
            {messages.length === 0 ? (
              <p className="quiet-state">Ask a focused question about evidence, telemetry, or next actions.</p>
            ) : (
              messages.map((message) => (
                <div className={`chat-entry chat-entry-${message.role}`} key={message.id}>
                  <span>{message.role === "analyst" ? "Analyst" : "Assistant"}</span>
                  <p>{message.content}</p>
                  {message.referencedSourceIds.length ? (
                    <small>{message.referencedSourceIds.join(" / ")}</small>
                  ) : null}
                </div>
              ))
            )}
          </div>
          {error ? <p className="inline-error">{error}</p> : null}
          <form className="chat-form" onSubmit={submit}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about this investigation..."
              maxLength={2000}
              disabled={investigation.llmReportStatus !== "completed"}
            />
            <button className="primary-action" type="submit" disabled={sending || investigation.llmReportStatus !== "completed"}>
              {sending ? "Sending..." : "Send"}
            </button>
          </form>
        </aside>
      ) : null}
    </>
  );
}
