#!/usr/bin/env python3
"""Reproducible attack runner for the fictional Northstar customer application.

This script never calls ThreatFlix. It interacts only with Northstar's normal
identity/admin HTTP endpoints. Northstar's installed SDK emits the telemetry.
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.request

BASE_URL = "http://127.0.0.1:4100"
ATTACKER_IP = "185.220.101.42"
VICTIM = "maya.singh@northstar-demo.in"


def post(path: str, payload: dict, allow_error: bool = False) -> dict:
    request = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as error:
        body = json.loads(error.read() or b"{}")
        if allow_error:
            return body
        raise RuntimeError(body.get("error", str(error))) from error


def pause(seconds: float) -> None:
    time.sleep(seconds)


def begin(scenario: str) -> None:
    print(f"\n[ATTACK] {scenario}")
    post("/api/demo/begin", {"scenario": scenario})


def complete() -> None:
    print("[DETECT] Asking Northstar to close the scenario; its SDK event IDs are analyzed.")
    result = post("/api/demo/complete", {})
    alert = result["alert"]
    print(f"[CREATED] {alert['severity']} · {alert['attack']} · {round(alert['confidence'])}% confidence")


def brute_force(delay: float) -> None:
    begin("brute-force")
    session = "attack-brute-force-session"
    for attempt in range(1, 11):
        post("/api/auth/login", {"email": VICTIM, "password": f"wrong-{attempt}", "ip": ATTACKER_IP, "sessionId": session}, True)
        print(f"  rejected credential attempt {attempt}/10")
        pause(delay)
    post("/api/auth/login", {"email": VICTIM, "password": "Northstar!2026", "ip": ATTACKER_IP, "sessionId": session})
    print("  valid credential accepted after failures")
    complete()


def password_spray(delay: float) -> None:
    begin("password-spray")
    for index in range(1, 13):
        user = f"employee-{index:02d}@northstar-demo.in"
        post("/api/auth/login", {"email": user, "password": "Summer2026!", "ip": "203.0.113.201", "sessionId": f"spray-{index}"}, True)
        print(f"  sprayed shared password against {user}")
        pause(delay)
    complete()


def credential_stuffing(delay: float) -> None:
    begin("credential-stuffing")
    ips = ["198.51.100.31", "198.51.100.32", "198.51.100.33"]
    for index in range(18):
        user = f"leaked-user-{index + 1:02d}@northstar-demo.in"
        ip = ips[index % len(ips)]
        post("/api/auth/login", {"email": user, "password": f"LeakedPass-{index}", "ip": ip, "sessionId": f"stuff-{index}"}, True)
        print(f"  replayed leaked credential {index + 1}/18 via {ip}")
        pause(delay)
    complete()


def persistence(delay: float) -> None:
    begin("persistence")
    session = "attack-persistence-session"
    post("/api/admin/roles/grant", {"actor": VICTIM, "target": VICTIM, "ip": ATTACKER_IP, "sessionId": session})
    print("  elevated victim to tenant_admin")
    pause(delay)
    post("/api/admin/api-keys", {"actor": VICTIM, "label": "billing-export-automation", "ip": ATTACKER_IP, "sessionId": session})
    print("  created persistent API credential")
    complete()


def exfiltration(delay: float) -> None:
    begin("exfiltration")
    post("/api/admin/export", {"actor": VICTIM, "ip": ATTACKER_IP, "sessionId": "attack-export-session"})
    print("  downloaded workforce-directory.csv (18,420 records)")
    pause(delay)
    complete()


SCENARIOS = {
    "brute-force": brute_force,
    "password-spray": password_spray,
    "credential-stuffing": credential_stuffing,
    "persistence": persistence,
    "exfiltration": exfiltration,
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Attack the Northstar judge-demo site and let its ThreatFlix SDK report the telemetry.")
    parser.add_argument("--scenario", choices=[*SCENARIOS, "all"], default="all")
    parser.add_argument("--delay", type=float, default=0.18, help="Delay between visible attack actions.")
    args = parser.parse_args()

    print("ThreatFlix judge demo attack runner")
    print(f"Target: {BASE_URL} (Northstar only; no direct ThreatFlix API calls)")
    selected = SCENARIOS if args.scenario == "all" else {args.scenario: SCENARIOS[args.scenario]}
    for name, runner in selected.items():
        runner(args.delay)
        pause(max(args.delay * 3, 0.5))
    print("\n[DONE] Attack sequence complete. Open ThreatFlix to inspect the investigations.")


if __name__ == "__main__":
    main()
