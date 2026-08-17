import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const edge = process.env.CIP074_EDGE_PATH ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const sshKey = process.env.CIP074_SSH_KEY ?? "C:\\Users\\kbt20\\.ssh\\estella_id_ed25519";
const dalHost = process.env.CIP074_DAL_HOST ?? "ubuntu@67.213.118.179";
const baseUrl = process.env.CIP074_PUBLIC_URL ?? "https://app.teralinx.net";
const accountId = "ACCOUNT-DEMO-NORTHSTAR";
const opportunityId = "DEMO-OPP-NORTHSTAR-CLOUD-INFRASTRUCTURE-CHEYENNE-METRO-DUCT-SYSTEM-31-1786992282335";
const outputDir = path.resolve(process.env.CIP074_BROWSER_ARTIFACT_DIR ?? "artifacts/cip074");
const port = Number(process.env.CIP074_CDP_PORT ?? 9334);
const profile = await mkdtemp(path.join(tmpdir(), "cip074-edge-"));
await mkdir(outputDir, { recursive: true });

// Credential is consumed in memory from its protected DAL1 file and is never printed or persisted locally.
let password = execFileSync("ssh.exe", ["-i", sshKey, dalHost, "cat /home/ubuntu/.hyperlinx-demo-credential"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const targetUrl = `${baseUrl}/?workspace=customerView&accountId=${encodeURIComponent(accountId)}&opportunityId=${encodeURIComponent(opportunityId)}`;
const browser = spawn(edge, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--disable-default-apps",
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--window-size=1600,1000", "about:blank",
], { stdio: "ignore", windowsHide: true });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function eventually(fn, message, attempts = 80) {
  let last;
  for (let index = 0; index < attempts; index += 1) {
    try { return await fn(); } catch (error) { last = error; await delay(250); }
  }
  throw new Error(`${message}: ${last?.message ?? last}`);
}

class Cdp {
  constructor(url) {
    this.nextId = 1; this.pending = new Map(); this.socket = new WebSocket(url);
  }
  async open() {
    await new Promise((resolve, reject) => { this.socket.addEventListener("open", resolve, { once: true }); this.socket.addEventListener("error", reject, { once: true }); });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message)); else pending.resolve(message.result);
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.socket.send(JSON.stringify({ id, method, params })); });
  }
  close() { this.socket.close(); }
}

let cdp;
try {
  await eventually(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`);
    assert.equal(response.ok, true);
  }, "Edge DevTools did not become ready");
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(targetUrl)}`, { method: "PUT" })).json();
  cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  const evaluate = async (expression) => {
    const result = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const bodyText = () => evaluate("document.body?.innerText || ''");
  const waitText = (value) => eventually(async () => { const text = await bodyText(); assert.match(text, value); return text; }, `Missing browser text ${value}`);
  const clickText = (value) => evaluate(`(() => { const target = [...document.querySelectorAll('button,summary')].find((item) => item.textContent.trim() === ${JSON.stringify(value)}); if (!target) throw new Error('Control not found: ${value}'); target.click(); return true; })()`);
  const choosePersona = (value) => evaluate(`(() => { const select = document.querySelector('select[aria-label="Demo perspective"]'); if (!select) throw new Error('Demo perspective selector missing'); select.value=${JSON.stringify(value)}; select.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`);
  const waitPersona = (value, surfaceText) => eventually(async () => {
    const ready = await evaluate(`(() => { const select=document.querySelector('select[aria-label="Demo perspective"]'); const text=document.body?.innerText||''; return select?.value===${JSON.stringify(value)} && text.includes(${JSON.stringify(surfaceText)}) && /Cheyenne Metro Duct System 31/i.test(text); })()`);
    assert.equal(ready, true);
    return bodyText();
  }, `Perspective ${value} did not resolve the Cheyenne Deal Room`);
  const screenshot = async (name) => {
    const result = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await writeFile(path.join(outputDir, name), Buffer.from(result.data, "base64"));
  };
  const login = async () => {
    await waitText(/Sign In/);
    await evaluate(`(() => { const set=(input,value)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}; const inputs=[...document.querySelectorAll('input')]; const username=inputs.find((input)=>input.autocomplete==='username'); const password=inputs.find((input)=>input.type==='password'); if(!username||!password) throw new Error('Login controls unavailable'); set(username,'demo'); set(password,${JSON.stringify(password)}); return true; })()`);
    await clickText("Sign In");
    await waitText(/Customer View/);
  };

  await login();
  password = "";
  let text = await waitText(/Cheyenne Metro Duct System 31/i);
  for (const required of [/ENGINEERING/, /R2 · ACCEPTED/, /31\.05 miles/, /\$4,082,311/, /\$3,105/, /240 months/, /INTERNAL CUSTOMER VIEW · NO CUSTOMER AUTHORITY/]) assert.match(text, required);
  await screenshot("01-internal-cheyenne-overview.png");

  await clickText("Proposal");
  text = await waitText(/Proposal R2/);
  assert.match(text, /ACCEPTED/);
  assert.match(text, /View \/ Download Proposal/);
  await evaluate("document.querySelector('.customer-governed-document')?.scrollIntoView({block:'start'})");
  await delay(300);
  await screenshot("02-internal-proposal-r2.png");

  await clickText("Activity");
  text = await waitText(/Governed Activity/);
  for (const required of [/Proposal Revision 2 saved/, /Internal Commercial Review approved/, /submitted for customer review/, /Proposal accepted/, /Engineering review initiated/]) assert.match(text, required);
  await evaluate("document.querySelector('.customer-activity')?.scrollIntoView({block:'start'})");
  await delay(300);
  await screenshot("03-internal-governed-activity.png");

  await choosePersona("CUSTOMER_VIEWER");
  text = await waitPersona("CUSTOMER_VIEWER", "DEMO ENVIRONMENT · CUSTOMER VIEW · NOT PRODUCTION ELIGIBLE");
  for (const required of [/Cheyenne Metro Duct System 31/i, /ENGINEERING/, /R2 · ACCEPTED/, /31\.05 mi/]) assert.match(text, required);
  await screenshot("04-customer-viewer-cheyenne.png");

  await choosePersona("CUSTOMER_COMMERCIAL_REVIEWER");
  text = await waitPersona("CUSTOMER_COMMERCIAL_REVIEWER", "CUSTOMER COMMERCIAL REVIEWER");
  assert.doesNotMatch(text, /Accept Proposal/);
  await screenshot("05-customer-reviewer-engineering-readonly.png");

  await choosePersona("SALES");
  text = await waitPersona("SALES", "INTERNAL CUSTOMER VIEW · NO CUSTOMER AUTHORITY");
  assert.match(text, /Cheyenne Metro Duct System 31/i);
  await cdp.send("Page.reload", { ignoreCache: true });
  text = await waitText(/Cheyenne Metro Duct System 31/i);
  assert.match(text, /R2 · ACCEPTED/);
  assert.match(text, /ENGINEERING/);

  await clickText("Sign Out");
  await waitText(/Sign In/);
  password = execFileSync("ssh.exe", ["-i", sshKey, dalHost, "cat /home/ubuntu/.hyperlinx-demo-credential"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  await login();
  password = "";
  text = await waitText(/Cheyenne Metro Duct System 31/i);
  assert.match(text, /R2 · ACCEPTED/);
  assert.match(text, /ENGINEERING/);
  await screenshot("06-logout-login-rehydration.png");

  console.log(JSON.stringify({
    result: "PASS",
    browser: "Microsoft Edge headless human-control acceptance",
    targetUrl,
    visibleControlsOnly: true,
    internalCustomerView: "PASS",
    proposalR2: "ACCEPTED",
    governedMapAndEconomics: "PASS",
    governedActivity: "PASS",
    customerViewer: "PASS",
    customerReviewerReadOnlyAtEngineering: "PASS",
    perspectiveReturn: "PASS",
    refresh: "PASS",
    logoutLogin: "PASS",
    screenshots: [
      "01-internal-cheyenne-overview.png", "02-internal-proposal-r2.png", "03-internal-governed-activity.png",
      "04-customer-viewer-cheyenne.png", "05-customer-reviewer-engineering-readonly.png", "06-logout-login-rehydration.png",
    ],
  }, null, 2));
} finally {
  password = "";
  cdp?.close();
  browser.kill();
  await delay(300);
  await rm(profile, { recursive: true, force: true });
}
