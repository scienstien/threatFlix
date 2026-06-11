import { afterEach, describe, expect, test } from "bun:test";
import SecurityAI from "./index";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("ThreatFlix SDK canonical event delivery", () => {
  test("sends extended event fields and returns backend event IDs", async () => {
    let captured: { url?: string; init?: RequestInit } = {};
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      captured = { url: String(url), init };
      return new Response(JSON.stringify({ inserted: 1, eventIds: ["evt-1"] }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const sdk = new SecurityAI({
      apiKey: "key",
      projectId: "project",
      backendUrl: "http://localhost:8000/api",
      headers: { "X-ThreatFlix-Demo-Deferred": "true" },
    });

    const result = await sdk.event("api_key_created", {
      user: "priya@example.com",
      ip: "203.0.113.8",
      service: "identity",
      sessionId: "session-1",
      severity: "critical",
      tags: ["demo"],
      metadata: { scope: "tenant:export" },
    });

    expect(result?.eventIds).toEqual(["evt-1"]);
    expect(captured.url).toBe("http://localhost:8000/api/events");
    const body = JSON.parse(String(captured.init?.body));
    expect(body.sessionId).toBe("session-1");
    expect(body.severity).toBe("critical");
    expect(body.tags).toEqual(["demo"]);
    expect((captured.init?.headers as Record<string, string>)["X-ThreatFlix-Demo-Deferred"]).toBe("true");
  });
});
