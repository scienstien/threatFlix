from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Iterable


HOUR_MS = 60 * 60 * 1000
DAY_MS = 24 * HOUR_MS
THIRTY_DAYS_MS = 30 * DAY_MS
IST_OFFSET_MINUTES = 5 * 60 + 30
PRIVILEGE_EVENT_TYPES = {
    "privilege_escalation",
    "role_changed",
    "permission_granted",
    "permission_revoked",
    "mfa_disabled",
}
UEBA_FEATURE_NAMES = [
    "eventCount",
    "failedLogins",
    "successfulLogins",
    "mfaFailures",
    "privilegedEvents",
    "apiKeyCreations",
    "dataExports",
    "durationSeconds",
    "failuresPerMinute",
    "failureToSuccessFlag",
    "hourSin",
    "hourCos",
    "offHoursFlag",
    "newIpForUserFlag",
    "distinctIpsForUser24h",
    "distinctUsersForIp24h",
    "apiKeysForUser24h",
    "dataExportsForUser24h",
    "privilegeChangesForUser24h",
    "userFailureRate24h",
    "tenantFailureRate24h",
]


@dataclass(frozen=True)
class Session:
    id: str
    project_id: str
    user: str
    ip: str
    service: str
    start: str
    end: str
    events: list[dict[str, object]]


def derive_feature_rows(
    events: list[dict[str, object]]
) -> list[dict[str, object]]:
    sessions = sessionize_events(events)
    rows: list[dict[str, object]] = []
    for session in sessions:
        features = extract_ueba_features(session, events)
        label = session.events[0]["metadata"]["syntheticLabel"]
        scenario = session.events[0]["metadata"]["syntheticScenario"]
        rows.append(
            {
                "projectId": session.project_id,
                "sessionId": session.id,
                "user": session.user,
                "ip": session.ip,
                "service": session.service,
                "label": label,
                "scenario": scenario,
                "eventIds": [str(event["id"]) for event in session.events],
                "features": features,
            }
        )
    return rows


def write_feature_jsonl(path: Path, rows: Iterable[dict[str, object]]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, sort_keys=True) + "\n")


def sessionize_events(events: list[dict[str, object]]) -> list[Session]:
    sorted_events = sorted(events, key=lambda event: timestamp_ms(str(event["timestamp"])))
    grouped: dict[str, list[dict[str, object]]] = {}
    for event in sorted_events:
        session_id = str(event.get("sessionId") or f"identity:{event['ip']}:{event['user']}")
        grouped.setdefault(session_id, []).append(event)

    sessions: list[Session] = []
    for session_id, session_events in grouped.items():
        first = session_events[0]
        last = session_events[-1]
        sessions.append(
            Session(
                id=session_id,
                project_id=str(first["projectId"]),
                user=str(first["user"]),
                ip=str(first["ip"]),
                service=str(first["service"]),
                start=str(first["timestamp"]),
                end=str(last["timestamp"]),
                events=session_events,
            )
        )

    return sorted(sessions, key=lambda session: timestamp_ms(session.start))


def extract_ueba_features(
    session: Session,
    historical_events: list[dict[str, object]],
) -> dict[str, float]:
    session_events = sorted(session.events, key=lambda event: timestamp_ms(str(event["timestamp"])))
    session_start_ms = timestamp_ms(session.start)
    session_end_ms = timestamp_ms(session.end)
    duration_seconds = max(1, round((session_end_ms - session_start_ms) / 1000))
    failed_logins = count(session_events, "failed_login")
    history = [
        event
        for event in historical_events
        if event["projectId"] == session.project_id and timestamp_ms(str(event["timestamp"])) < session_start_ms
    ]
    history_24h = [
        event for event in history if timestamp_ms(str(event["timestamp"])) >= session_start_ms - DAY_MS
    ]
    history_30d = [
        event for event in history if timestamp_ms(str(event["timestamp"])) >= session_start_ms - THIRTY_DAYS_MS
    ]
    user_history_24h = [event for event in history_24h if event["user"] == session.user]
    ip_history_24h = [event for event in history_24h if event["ip"] == session.ip]
    user_history_30d = [event for event in history_30d if event["user"] == session.user]
    ist_hour = get_ist_hour(session.start)
    angle = 2 * 3.141592653589793 * ist_hour / 24

    return {
        "eventCount": float(len(session_events)),
        "failedLogins": float(failed_logins),
        "successfulLogins": float(count(session_events, "successful_login")),
        "mfaFailures": float(count(session_events, "mfa_failure")),
        "privilegedEvents": float(sum(1 for event in session_events if event["event"] in PRIVILEGE_EVENT_TYPES)),
        "apiKeyCreations": float(count(session_events, "api_key_created")),
        "dataExports": float(count(session_events, "data_export")),
        "durationSeconds": float(duration_seconds),
        "failuresPerMinute": float(failed_logins / max(1, duration_seconds / 60)),
        "failureToSuccessFlag": 1.0 if has_failure_before_success(session_events) else 0.0,
        "hourSin": __import__("math").sin(angle),
        "hourCos": __import__("math").cos(angle),
        "offHoursFlag": 1.0 if ist_hour < 8 or ist_hour >= 18 else 0.0,
        "newIpForUserFlag": 0.0 if any(event["ip"] == session.ip for event in user_history_30d) else 1.0,
        "distinctIpsForUser24h": float(unique_count(user_history_24h, "ip")),
        "distinctUsersForIp24h": float(unique_count(ip_history_24h, "user")),
        "apiKeysForUser24h": float(count(user_history_24h, "api_key_created")),
        "dataExportsForUser24h": float(count(user_history_24h, "data_export")),
        "privilegeChangesForUser24h": float(
            sum(1 for event in user_history_24h if event["event"] in PRIVILEGE_EVENT_TYPES)
        ),
        "userFailureRate24h": float(login_failure_rate(user_history_24h)),
        "tenantFailureRate24h": float(login_failure_rate(history_24h)),
    }


def timestamp_ms(timestamp: str) -> int:
    normalized = timestamp.replace("Z", "+00:00")
    return int(datetime.fromisoformat(normalized).timestamp() * 1000)


def get_ist_hour(timestamp: str) -> float:
    dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    minutes = dt.hour * 60 + dt.minute + IST_OFFSET_MINUTES
    wrapped = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60)
    return wrapped / 60


def count(events: list[dict[str, object]], event_type: str) -> int:
    return sum(1 for event in events if event["event"] == event_type)


def unique_count(events: list[dict[str, object]], field: str) -> int:
    return len({str(event[field]) for event in events})


def has_failure_before_success(events: list[dict[str, object]]) -> bool:
    saw_failure = False
    for event in events:
        if event["event"] == "failed_login":
            saw_failure = True
        if event["event"] == "successful_login" and saw_failure:
            return True
    return False


def login_failure_rate(events: list[dict[str, object]]) -> float:
    failures = count(events, "failed_login")
    successes = count(events, "successful_login")
    return failures / max(1, failures + successes)
