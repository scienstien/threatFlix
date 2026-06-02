// ---------------------------------------------------------------------------
// ThreatFlix — EventFeed
// Live security event feed with scan-beam entrance for new rows.
// ---------------------------------------------------------------------------

import { useRef, useState, useEffect, useCallback } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useAuth } from "../../context/AuthContext";
import { getLatestEvents, type SecurityEvent } from "../../api/client";
import { GlassCard } from "../ui/GlassCard";

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getEventColor(event: string): string {
  const lower = event.toLowerCase();
  if (
    lower.includes("success") ||
    lower.includes("granted") ||
    lower.includes("allowed") ||
    lower.includes("login_success")
  ) {
    return "var(--severity-low)";
  }
  if (
    lower.includes("fail") ||
    lower.includes("denied") ||
    lower.includes("blocked") ||
    lower.includes("error") ||
    lower.includes("unauthorized")
  ) {
    return "var(--severity-critical)";
  }
  return "var(--ember-warm)";
}

const MAX_ROWS = 20;

export function EventFeed() {
  const { auth } = useAuth();
  const projectId = auth?.projectId ?? "";
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [prevIds, setPrevIds] = useState<Set<string>>(new Set());
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [hovered, setHovered] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    if (!projectId) return;
    try {
      const { events: fetched } = await getLatestEvents(projectId);
      const sliced = (fetched || []).slice(0, MAX_ROWS);
      const currentIds = new Set(events.map((e) => e.id));
      const incoming = new Set(
        sliced.filter((e) => !currentIds.has(e.id)).map((e) => e.id)
      );
      setPrevIds(currentIds);
      setNewIds(incoming);
      setEvents(sliced);
    } catch {
      // silently ignore fetch errors — feed continues
    }
  }, [projectId, events]);

  // Initial fetch + interval
  useEffect(() => {
    if (!projectId) return;
    // Initial fetch
    (async () => {
      try {
        const { events: fetched } = await getLatestEvents(projectId);
        setEvents((fetched || []).slice(0, MAX_ROWS));
      } catch {
        // ignore
      }
    })();
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    const interval = setInterval(fetchEvents, 5000);
    return () => clearInterval(interval);
  }, [projectId, fetchEvents]);

  // Auto-scroll to top (newest events) unless hovered
  useEffect(() => {
    if (!hovered && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events, hovered]);

  // Scan-beam animation for new rows
  useGSAP(
    () => {
      if (!newIds.size || !containerRef.current) return;

      const rows = containerRef.current.querySelectorAll(".event-row-new");
      rows.forEach((row) => {
        const beam = row.querySelector(".scan-beam") as HTMLElement;
        const content = row.querySelector(".row-content") as HTMLElement;
        if (!beam || !content) return;

        const tl = gsap.timeline();

        // Beam sweeps left to right
        tl.fromTo(
          beam,
          { left: 0, opacity: 1 },
          { left: "100%", opacity: 0, duration: 0.4, ease: "power1.out" }
        );

        // Content revealed with clipPath following beam
        tl.fromTo(
          content,
          { clipPath: "inset(0 100% 0 0)" },
          { clipPath: "inset(0 0% 0 0)", duration: 0.4, ease: "power1.out" },
          0
        );
      });
    },
    { dependencies: [newIds], scope: containerRef }
  );

  return (
    <GlassCard level="light">
      <div
        ref={containerRef}
        style={{ padding: "20px", height: "100%", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 mb-4"
          style={{ flexShrink: 0 }}
        >
          <h3
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "var(--text-primary)",
              letterSpacing: "0.08em",
              margin: 0,
            }}
          >
            LIVE EVENTS
          </h3>
          <div
            className="pulse-dot"
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "var(--severity-low)",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: "0.72rem",
              color: "var(--severity-low)",
              fontFamily: "var(--font-mono)",
              fontWeight: 500,
            }}
          >
            Connected
          </span>
        </div>

        {/* Column headers */}
        <div
          className="flex gap-3"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.65rem",
            fontWeight: 600,
            color: "var(--text-muted)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "6px 10px",
            borderBottom: "1px solid var(--glass-border)",
            marginBottom: 4,
            flexShrink: 0,
          }}
        >
          <span style={{ width: 72, flexShrink: 0 }}>TIME</span>
          <span style={{ width: 90, flexShrink: 0 }}>SERVICE</span>
          <span style={{ width: 110, flexShrink: 0 }}>IP</span>
          <span style={{ flex: 1 }}>EVENT</span>
        </div>

        {/* Scrollable rows */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            maxHeight: 440,
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {events.map((ev, i) => {
            const isNew = newIds.has(ev.id);
            const bgColor =
              i % 2 === 0 ? "var(--bg-surface)" : "var(--bg-deep)";

            return (
              <div
                key={ev.id}
                className={isNew ? "event-row-new" : ""}
                style={{
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: 4,
                  marginBottom: 1,
                }}
              >
                {/* Scan beam (for new events) */}
                {isNew && (
                  <div
                    className="scan-beam"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: 2,
                      height: "100%",
                      background: "var(--ember-glow)",
                      boxShadow:
                        "0 0 8px var(--ember-glow), 0 0 16px var(--ember-glow)",
                      zIndex: 2,
                      pointerEvents: "none",
                    }}
                  />
                )}

                <div
                  className="row-content flex gap-3 items-center"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.75rem",
                    padding: "7px 10px",
                    backgroundColor: bgColor,
                    transition: "background-color var(--transition-fast)",
                  }}
                >
                  {/* Timestamp */}
                  <span
                    style={{
                      width: 72,
                      flexShrink: 0,
                      color: "var(--text-muted)",
                      fontWeight: 400,
                    }}
                  >
                    {formatTime(ev.timestamp)}
                  </span>

                  {/* Service */}
                  <span
                    style={{
                      width: 90,
                      flexShrink: 0,
                      color: "var(--text-secondary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {ev.service || "—"}
                  </span>

                  {/* IP */}
                  <span
                    style={{
                      width: 110,
                      flexShrink: 0,
                      color: "var(--text-muted)",
                    }}
                  >
                    {ev.ip || "—"}
                  </span>

                  {/* Event type */}
                  <span
                    style={{
                      flex: 1,
                      color: getEventColor(ev.event),
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {ev.event}
                  </span>
                </div>
              </div>
            );
          })}

          {events.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "32px 16px",
                color: "var(--text-muted)",
                fontFamily: "var(--font-mono)",
                fontSize: "0.8rem",
              }}
            >
              Waiting for events…
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
