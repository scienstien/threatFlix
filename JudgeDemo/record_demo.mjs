import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "../FrontEnd/node_modules/playwright-core/index.mjs";

const demoDir = dirname(fileURLToPath(import.meta.url));
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const recordingDir = join(demoDir, "recordings");
await mkdir(recordingDir, { recursive: true });

console.log("Recording the judge demo. All attack traffic targets Northstar.");
const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  recordVideo: { dir: recordingDir, size: { width: 1600, height: 900 } },
});
await fetch("http://127.0.0.1:4100/api/demo/reset", { method: "POST" });
const page = await context.newPage();
await page.goto("http://127.0.0.1:4100/presentation.html");
await page.waitForTimeout(3_000);

await new Promise((resolve, reject) => {
  const attack = spawn("python", ["attack_runner.py", "--scenario", "all", "--delay", "0.22"], {
    cwd: demoDir,
    stdio: "inherit",
  });
  attack.on("error", reject);
  attack.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`Attack runner exited with code ${code}.`)));
});
const soc = page.frameLocator('iframe[src*="5173"]');
const cases = soc.locator(".case-row");
if (await cases.count() > 0) await cases.first().click();
await page.waitForTimeout(10_000);

const video = page.video();
await context.close();
await browser.close();
console.log(`Recording saved: ${await video?.path()}`);
