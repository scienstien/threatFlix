import type { SecurityEvent } from "../types/events.ts";

export interface EventSession {
  id: string;
  projectId: string;
  key: string;
  user: string;
  ip: string;
  service: string;
  start: string;
  end: string;
  events: SecurityEvent[];
}

const DEFAULT_IDLE_GAP_MS = 30 * 60 * 1000;

export function sessionizeEvents(
  events: SecurityEvent[],
  idleGapMs: number = DEFAULT_IDLE_GAP_MS
): EventSession[] {
  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const groups = new Map<string, SecurityEvent[]>();

  for (const event of sorted) {
    const key = getSessionKey(event);
    const group = groups.get(key) ?? [];
    group.push(event);
    groups.set(key, group);
  }

  const sessions: EventSession[] = [];
  for (const [key, group] of groups) {
    let current: SecurityEvent[] = [];

    for (const event of group) {
      const previous = current[current.length - 1];
      if (
        previous &&
        new Date(event.timestamp).getTime() - new Date(previous.timestamp).getTime() > idleGapMs
      ) {
        sessions.push(buildSession(key, current));
        current = [];
      }

      current.push(event);
    }

    if (current.length > 0) {
      sessions.push(buildSession(key, current));
    }
  }

  return sessions.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );
}

function getSessionKey(event: SecurityEvent): string {
  return event.sessionId
    ? `session:${event.sessionId}`
    : `identity:${event.ip}:${event.user}`;
}

function buildSession(key: string, events: SecurityEvent[]): EventSession {
  const first = events[0];
  const last = events[events.length - 1];
  if (!first || !last) {
    throw new Error("Cannot build a session without events.");
  }

  return {
    id: crypto.randomUUID(),
    projectId: first.projectId,
    key,
    user: first.user,
    ip: first.ip,
    service: first.service,
    start: first.timestamp,
    end: last.timestamp,
    events,
  };
}
