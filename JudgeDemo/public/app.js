const activityList = document.querySelector("#activityList");
const investigationList = document.querySelector("#investigationList");
const statusStrip = document.querySelector("#statusStrip");
let previousActivityIds = new Set();

const statusText = {
  ready: ["Waiting for attack runner", "Northstar is operating normally. Start the Python runner to generate real application traffic."],
  attacking: ["Attack traffic is reaching Northstar", "Application endpoints are responding while the installed SDK forwards security telemetry."],
  analyzing: ["ThreatFlix is correlating evidence", "The scenario’s accepted event IDs are being evaluated by deterministic, behavioral, and graph layers."],
  complete: ["Investigation created", "The customer application remains online. The SOC can now inspect the correlated investigation."],
  error: ["Demo flow needs attention", "Check the backend and Northstar terminal output, then reset the view."],
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function time(value) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function renderActivity(items) {
  activityList.innerHTML = items.map((item, index) => {
    const fresh = !previousActivityIds.has(item.id);
    return `<div class="activity-row ${esc(item.tone)} ${fresh ? "arrive" : ""}" style="--delay:${Math.min(index * 22, 160)}ms">
      <time>${time(item.at)}</time>
      <span class="event-type"><i></i>${esc(item.event.replaceAll("_", " "))}</span>
      <div><strong>${esc(item.user)}</strong><small>${esc(item.detail)}</small></div>
      <code>${esc(item.ip)}</code>
      <span class="delivery ${item.delivered ? "yes" : "pending"}">${item.delivered ? "accepted" : "sending"}</span>
    </div>`;
  }).join("");
  previousActivityIds = new Set(items.map(item => item.id));
}

function renderInvestigations(items) {
  if (!items.length) {
    investigationList.innerHTML = '<div class="empty-state">No investigations yet. Northstar’s telemetry remains quiet.</div>';
    return;
  }
  investigationList.innerHTML = items.map((item, index) => `<a class="investigation-card" href="http://127.0.0.1:5173/dashboard" target="_blank" style="--delay:${index * 50}ms">
    <span class="severity ${esc(item.severity.toLowerCase())}">${esc(item.severity)}</span>
    <div><strong>${esc(item.attack)}</strong><small>${time(item.at)} · ${Math.round(item.confidence)}% fused confidence</small></div>
    <span class="arrow">↗</span>
  </a>`).join("");
}

async function refresh() {
  try {
    const response = await fetch("/api/state");
    const state = await response.json();
    statusStrip.dataset.status = state.status;
    document.querySelector("#statusTitle").textContent = state.activeLabel ? `${statusText[state.status][0]} · ${state.activeLabel}` : statusText[state.status][0];
    document.querySelector("#statusDetail").textContent = state.error || statusText[state.status][1];
    document.querySelector("#deliveryCount").textContent = state.deliveredEvents;
    document.querySelector("#investigationCount").textContent = state.investigations.length;
    const connectionEstablished = state.integrationConfigured && state.deliveredEvents > 0;
    document.querySelector("#integrationState").textContent = !state.integrationConfigured
      ? "Awaiting key"
      : connectionEstablished
        ? "Connected"
        : "Ready to send";
    document.querySelector("#deliveryState").innerHTML = !state.integrationConfigured
      ? "<b></b> Not configured"
      : connectionEstablished
        ? "<b></b> Healthy"
        : "<b></b> Awaiting first event";
    document.querySelector(".sdk-panel").classList.toggle("not-configured", !state.integrationConfigured);
    if (!state.integrationConfigured && state.status === "ready") {
      document.querySelector("#statusTitle").textContent = "ThreatFlix SDK is waiting for a project key";
      document.querySelector("#statusDetail").textContent = "Generate a key in ThreatFlix, paste it into threatflix.ts, then save the file.";
    }
    renderActivity(state.activity);
    renderInvestigations(state.investigations);
  } catch {
    statusStrip.dataset.status = "error";
    document.querySelector("#statusTitle").textContent = "Northstar demo server unavailable";
  }
}

document.querySelector("#resetButton").addEventListener("click", async () => {
  await fetch("/api/demo/reset", { method: "POST" });
  previousActivityIds.clear();
  refresh();
});

document.querySelector("#copyButton").addEventListener("click", async event => {
  await navigator.clipboard.writeText("python attack_runner.py --scenario all");
  event.currentTarget.textContent = "Copied";
  setTimeout(() => event.currentTarget.textContent = "Copy", 1200);
});

refresh();
setInterval(refresh, 650);
