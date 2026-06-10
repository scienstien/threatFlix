from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Iterable

import numpy as np

from feature_extractor import UEBA_FEATURE_NAMES, derive_feature_rows, write_feature_jsonl


PROJECT_ID = "synthetic-demo"
SEED = 42
DEFAULT_USER_COUNT = 200
DEFAULT_TRAINING_DAYS = 30
DEFAULT_EVALUATION_DAYS = 7
ATTACK_SCENARIOS = (
    "brute_force_takeover",
    "password_spray",
    "mfa_bypass",
    "rogue_api_key_creation",
    "post_login_data_export",
)

OUTPUT_DIR = Path(__file__).with_name("outputs") / "datasets"
TRAINING_EVENTS_PATH = OUTPUT_DIR / "training_events.jsonl"
EVALUATION_EVENTS_PATH = OUTPUT_DIR / "evaluation_events.jsonl"
TRAINING_FEATURES_PATH = OUTPUT_DIR / "training_features.jsonl"
EVALUATION_FEATURES_PATH = OUTPUT_DIR / "evaluation_features.jsonl"
MANIFEST_PATH = OUTPUT_DIR / "dataset_manifest.json"


@dataclass(frozen=True)
class SyntheticEvent:
    id: str
    projectId: str
    event: str
    user: str
    ip: str
    service: str
    timestamp: str
    metadata: dict[str, object]
    sessionId: str | None = None
    tags: list[str] | None = None


def generate_dataset(
    seed: int = SEED,
    user_count: int = DEFAULT_USER_COUNT,
    training_days: int = DEFAULT_TRAINING_DAYS,
    evaluation_days: int = DEFAULT_EVALUATION_DAYS,
) -> tuple[list[dict[str, object]], list[dict[str, object]], dict[str, object]]:
    rng = np.random.default_rng(seed)
    start = datetime(2026, 1, 1, tzinfo=UTC)
    users = [f"user-{index:03d}@example.com" for index in range(user_count)]

    training_events = generate_normal_events(
        rng=rng,
        users=users,
        start=start,
        days=training_days,
        label="normal",
    )
    evaluation_start = start + timedelta(days=training_days)
    evaluation_events = generate_normal_events(
        rng=rng,
        users=users,
        start=evaluation_start,
        days=evaluation_days,
        label="normal",
    )

    scenario_counts: dict[str, int] = {}
    for index, scenario in enumerate(ATTACK_SCENARIOS):
        injected = inject_attack_scenario(
            rng=rng,
            scenario=scenario,
            users=users,
            start=evaluation_start + timedelta(days=index),
            attack_index=index,
        )
        evaluation_events.extend(injected)
        scenario_counts[scenario] = len(injected)

    training_events.sort(key=lambda event: str(event["timestamp"]))
    evaluation_events.sort(key=lambda event: str(event["timestamp"]))

    manifest = {
        "seed": seed,
        "projectId": PROJECT_ID,
        "userCount": user_count,
        "trainingDays": training_days,
        "evaluationDays": evaluation_days,
        "trainingEventCount": len(training_events),
        "evaluationEventCount": len(evaluation_events),
        "attackScenarios": list(ATTACK_SCENARIOS),
        "scenarioEventCounts": scenario_counts,
    }
    return training_events, evaluation_events, manifest


def write_dataset() -> dict[str, object]:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    training_events, evaluation_events, manifest = generate_dataset()
    training_features = derive_feature_rows(training_events)
    evaluation_features = derive_feature_rows(evaluation_events)
    write_jsonl(TRAINING_EVENTS_PATH, training_events)
    write_jsonl(EVALUATION_EVENTS_PATH, evaluation_events)
    write_feature_jsonl(TRAINING_FEATURES_PATH, training_features)
    write_feature_jsonl(EVALUATION_FEATURES_PATH, evaluation_features)
    manifest["featureNames"] = UEBA_FEATURE_NAMES
    manifest["trainingFeatureRowCount"] = len(training_features)
    manifest["evaluationFeatureRowCount"] = len(evaluation_features)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def generate_normal_events(
    rng: np.random.Generator,
    users: list[str],
    start: datetime,
    days: int,
    label: str,
) -> list[dict[str, object]]:
    events: list[dict[str, object]] = []
    for day in range(days):
        day_start = start + timedelta(days=day)
        for user in users:
            for session_index in range(int(rng.integers(1, 4))):
                session_id = session_identifier(user, day, session_index, label)
                session_time = day_start + timedelta(
                    hours=float(np.clip(rng.normal(8.5, 2.0), 0.0, 23.5)),
                    minutes=int(rng.integers(0, 60)),
                )
                ip = normal_ip_for_user(rng, user)
                events.append(
                    event(
                        event_id=f"{session_id}-success",
                        event_type="successful_login",
                        user=user,
                        ip=ip,
                        timestamp=session_time,
                        session_id=session_id,
                        label=label,
                        scenario="normal",
                    )
                )
                if rng.random() < 0.25:
                    events.append(
                        event(
                            event_id=f"{session_id}-mfa",
                            event_type="mfa_challenge",
                            user=user,
                            ip=ip,
                            timestamp=session_time + timedelta(seconds=20),
                            session_id=session_id,
                            label=label,
                            scenario="normal",
                        )
                    )
                if rng.random() < 0.18:
                    events.append(
                        event(
                            event_id=f"{session_id}-fail",
                            event_type="failed_login",
                            user=user,
                            ip=ip,
                            timestamp=session_time - timedelta(minutes=1),
                            session_id=session_id,
                            label=label,
                            scenario="normal",
                        )
                    )
    return events


def inject_attack_scenario(
    rng: np.random.Generator,
    scenario: str,
    users: list[str],
    start: datetime,
    attack_index: int,
) -> list[dict[str, object]]:
    if scenario == "brute_force_takeover":
        target = users[attack_index % len(users)]
        ip = attack_ip(attack_index)
        session_id = f"attack-bruteforce-{attack_index}"
        events = [
            event(
                event_id=f"{session_id}-fail-{index}",
                event_type="failed_login",
                user=target,
                ip=ip,
                timestamp=start + timedelta(seconds=index * 15),
                session_id=session_id,
                label="attack",
                scenario=scenario,
            )
            for index in range(10)
        ]
        events.extend(
            [
                event(
                    event_id=f"{session_id}-success",
                    event_type="successful_login",
                    user=target,
                    ip=ip,
                    timestamp=start + timedelta(minutes=3),
                    session_id=session_id,
                    label="attack",
                    scenario=scenario,
                ),
                event(
                    event_id=f"{session_id}-key",
                    event_type="api_key_created",
                    user=target,
                    ip=ip,
                    timestamp=start + timedelta(minutes=4),
                    session_id=session_id,
                    label="attack",
                    scenario=scenario,
                ),
            ]
        )
        return events

    if scenario == "password_spray":
        ip = attack_ip(attack_index)
        return [
            event(
                event_id=f"attack-spray-{attack_index}-{index}",
                event_type="failed_login",
                user=users[(attack_index * 17 + index) % len(users)],
                ip=ip,
                timestamp=start + timedelta(seconds=index * 30),
                session_id=f"attack-spray-{attack_index}",
                label="attack",
                scenario=scenario,
            )
            for index in range(12)
        ]

    if scenario == "mfa_bypass":
        target = users[(attack_index * 7) % len(users)]
        ip = attack_ip(attack_index)
        session_id = f"attack-mfa-{attack_index}"
        events = [
            event(
                event_id=f"{session_id}-mfa-fail-{index}",
                event_type="mfa_failure",
                user=target,
                ip=ip,
                timestamp=start + timedelta(seconds=index * 25),
                session_id=session_id,
                label="attack",
                scenario=scenario,
            )
            for index in range(3)
        ]
        events.append(
            event(
                event_id=f"{session_id}-success",
                event_type="successful_login",
                user=target,
                ip=ip,
                timestamp=start + timedelta(minutes=2),
                session_id=session_id,
                label="attack",
                scenario=scenario,
            )
        )
        return events

    if scenario == "rogue_api_key_creation":
        target = users[(attack_index * 11) % len(users)]
        ip = attack_ip(attack_index)
        session_id = f"attack-key-{attack_index}"
        return [
            event(
                event_id=f"{session_id}-success",
                event_type="successful_login",
                user=target,
                ip=ip,
                timestamp=start,
                session_id=session_id,
                label="attack",
                scenario=scenario,
            ),
            event(
                event_id=f"{session_id}-mfa-off",
                event_type="mfa_disabled",
                user=target,
                ip=ip,
                timestamp=start + timedelta(minutes=1),
                session_id=session_id,
                label="attack",
                scenario=scenario,
            ),
            event(
                event_id=f"{session_id}-key",
                event_type="api_key_created",
                user=target,
                ip=ip,
                timestamp=start + timedelta(minutes=2),
                session_id=session_id,
                label="attack",
                scenario=scenario,
            ),
        ]

    if scenario == "post_login_data_export":
        target = users[(attack_index * 13) % len(users)]
        ip = attack_ip(attack_index)
        session_id = f"attack-export-{attack_index}"
        return [
            event(
                event_id=f"{session_id}-success",
                event_type="successful_login",
                user=target,
                ip=ip,
                timestamp=start,
                session_id=session_id,
                label="attack",
                scenario=scenario,
            ),
            event(
                event_id=f"{session_id}-role",
                event_type="role_changed",
                user=target,
                ip=ip,
                timestamp=start + timedelta(minutes=1),
                session_id=session_id,
                label="attack",
                scenario=scenario,
            ),
            event(
                event_id=f"{session_id}-export",
                event_type="data_export",
                user=target,
                ip=ip,
                timestamp=start + timedelta(minutes=3),
                session_id=session_id,
                label="attack",
                scenario=scenario,
            ),
        ]

    raise ValueError(f"Unsupported scenario: {scenario}")


def event(
    event_id: str,
    event_type: str,
    user: str,
    ip: str,
    timestamp: datetime,
    session_id: str,
    label: str,
    scenario: str,
) -> dict[str, object]:
    synthetic = SyntheticEvent(
        id=event_id,
        projectId=PROJECT_ID,
        event=event_type,
        user=user,
        ip=ip,
        service="auth-service" if "export" not in event_type else "data-service",
        timestamp=timestamp.isoformat().replace("+00:00", "Z"),
        sessionId=session_id,
        metadata={
            "syntheticLabel": label,
            "syntheticScenario": scenario,
        },
        tags=["synthetic", f"label:{label}", f"scenario:{scenario}"],
    )
    return asdict(synthetic)


def session_identifier(user: str, day: int, session_index: int, label: str) -> str:
    safe_user = user.split("@", 1)[0]
    return f"{label}-{safe_user}-d{day:02d}-s{session_index:02d}"


def normal_ip_for_user(rng: np.random.Generator, user: str) -> str:
    user_index = int(user.split("-", 1)[1].split("@", 1)[0])
    base = 10 + (user_index % 50)
    host = 10 + int(rng.integers(0, 4))
    return f"10.{base}.0.{host}"


def attack_ip(index: int) -> str:
    return f"203.0.113.{20 + index}"


def write_jsonl(path: Path, rows: Iterable[dict[str, object]]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, sort_keys=True) + "\n")


if __name__ == "__main__":
    manifest = write_dataset()
    print(json.dumps(manifest, indent=2))
