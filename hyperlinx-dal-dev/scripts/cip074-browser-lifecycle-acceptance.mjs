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
const opportunityId = "DEMO-OPP-NORTHSTAR-CLOUD-INFRASTRUCTURE-OPPORTUNITY-3-1786992269237";
const opportunityTitle = "Northstar Cloud Infrastructure Opportunity 3";
const outputDir = path.resolve(process.env.CIP074_BROWSER_ARTIFACT_DIR ?? "artifacts/cip074");
const port = Number(process.env.CIP074_CDP_PORT ?? 9335);
const profile = await mkdtemp(path.join(tmpdir(), "cip074-lifecycle-edge-"));
await mkdir(outputDir, { recursive: true });

// The protected credential is consumed only in memory and is never printed or persisted.
let password = execFileSync("ssh.exe", ["-i", sshKey, dalHost, "cat /home/ubuntu/.hyperlinx-demo-credential"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const targetUrl = `${baseUrl}/?workspace=customerView&accountId=${encodeURIComponent(accountId)}&opportunityId=${encodeURIComponent(opportunityId)}`;
const browser = spawn(edge, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--disable-default-apps",
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--window-size=1600,1000", "about:blank",
], { stdio: "ignore", windowsHide: true });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function eventually(fn, message, attempts = 160) {
  let last;
  for (let index = 0; index < attempts; index += 1) {
    try { return await fn(); } catch (error) { last = error; await delay(250); }
  }
  throw new Error(`${message}: ${last?.message ?? last}`);
}

class Cdp {
  constructor(url) { this.nextId = 1; this.pending = new Map(); this.socket = new WebSocket(url); }
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
  await eventually(async () => assert.equal((await fetch(`http://127.0.0.1:${port}/json/version`)).ok, true), "Edge DevTools did not become ready");
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(targetUrl)}`, { method: "PUT" })).json();
  cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  const evaluate = async (expression) => {
    const result = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  };
  const bodyText = () => evaluate("document.body?.innerText || ''");
  const waitText = (pattern, message = String(pattern)) => eventually(async () => { const text = await bodyText(); assert.match(text, pattern); return text; }, `Missing browser text ${message}`);
  const controlState = (label) => evaluate(`(() => { const item=[...document.querySelectorAll('button,summary')].find((node)=>node.textContent.trim()===${JSON.stringify(label)}); return item ? { exists:true, disabled:Boolean(item.disabled), visible:Boolean(item.getClientRects().length) } : { exists:false }; })()`);
  const clickText = async (label) => eventually(async () => {
    const state = await controlState(label);
    assert.equal(state.exists, true, `Control not found: ${label}`);
    assert.equal(state.visible, true, `Control not visible: ${label}`);
    assert.equal(state.disabled, false, `Control disabled: ${label}`);
    return evaluate(`(() => { const item=[...document.querySelectorAll('button,summary')].find((node)=>node.textContent.trim()===${JSON.stringify(label)}); item.scrollIntoView({block:'center'}); item.click(); return true; })()`);
  }, `Visible enabled control unavailable: ${label}`);
  const choosePersona = (value) => evaluate(`(() => { const select=document.querySelector('select[aria-label="Demo perspective"]'); if(!select) throw new Error('Demo perspective selector missing'); select.value=${JSON.stringify(value)}; select.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`);
  const screenshot = async (name) => {
    const result = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await writeFile(path.join(outputDir, name), Buffer.from(result.data, "base64"));
  };
  const login = async () => {
    await waitText(/Sign In/);
    await evaluate(`(() => { const set=(input,value)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}; const inputs=[...document.querySelectorAll('input')]; const username=inputs.find((input)=>input.autocomplete==='username'); const secret=inputs.find((input)=>input.type==='password'); if(!username||!secret) throw new Error('Login controls unavailable'); set(username,'demo'); set(secret,${JSON.stringify(password)}); return true; })()`);
    await clickText("Sign In");
    await waitText(new RegExp(opportunityTitle, "i"));
  };

  await login();
  password = "";
  let text = await waitText(new RegExp(opportunityTitle, "i"));
  assert.match(text, /DRAFT/);
  await screenshot("07-draft-before-commercial.png");

  await clickText("Continue Commercial");
  text = await eventually(async () => {
    const current = await bodyText();
    const header = await evaluate("document.querySelector('.commercial-compact-header-grid')?.innerText || ''");
    assert.match(header, new RegExp(opportunityId));
    return current;
  }, "Commercial repository restore did not complete");
  if (!(await controlState("Save Proposal Revision")).exists) await clickText("Open Proposal Builder");
  await eventually(async () => {
    const state = await controlState("Save Proposal Revision");
    assert.deepEqual({ exists: state.exists, disabled: state.disabled, visible: state.visible }, { exists: true, disabled: false, visible: true });
  }, "Proposal Builder did not become operable");
  await screenshot("08-commercial-proposal-builder.png");

  await clickText("Save Proposal Revision");
  await eventually(async () => assert.equal((await controlState("Approve Internal Commercial Review")).disabled, false), "Internal Commercial Review did not become eligible");
  await clickText("Approve Internal Commercial Review");
  await eventually(async () => assert.equal((await controlState("Submit to Customer")).disabled, false), "Submit to Customer did not become eligible");
  await clickText("Submit to Customer");
  text = await waitText(/CUSTOMER REVIEW/);
  assert.match(text, new RegExp(opportunityTitle, "i"));
  await screenshot("09-submitted-to-customer.png");

  await choosePersona("CUSTOMER_COMMERCIAL_REVIEWER");
  text = await waitText(/CUSTOMER COMMERCIAL REVIEWER/);
  assert.match(text, new RegExp(opportunityTitle, "i"));
  await clickText("Accept Proposal");
  text = await waitText(/This exact Proposal Revision was accepted/);
  assert.match(text, /ACCEPTED/);
  await screenshot("10-customer-accepted.png");

  await choosePersona("SALES");
  text = await waitText(/INTERNAL CUSTOMER VIEW/);
  assert.match(text, new RegExp(opportunityTitle, "i"));
  assert.match(text, /ACCEPTED/);
  await clickText("Send to Engineering");
  text = await waitText(/The accepted commercial package was sent to Engineering/);
  assert.match(text, /ENGINEERING/);
  assert.doesNotMatch(text, /CERTIFIED/);
  await screenshot("11-engineering-boundary.png");

  console.log(JSON.stringify({
    result: "PASS",
    browser: "Microsoft Edge headless human-control lifecycle acceptance",
    visibleControlsOnly: true,
    accountId,
    opportunityId,
    flow: ["DRAFT", "PROPOSAL_REVISION_SAVED", "INTERNAL_COMMERCIAL_APPROVED", "CUSTOMER_REVIEW", "ACCEPTED", "ENGINEERING"],
    stoppedAt: "ENGINEERING",
    screenshots: [
      "07-draft-before-commercial.png", "08-commercial-proposal-builder.png", "09-submitted-to-customer.png",
      "10-customer-accepted.png", "11-engineering-boundary.png",
    ],
  }, null, 2));
} finally {
  password = "";
  cdp?.close();
  browser.kill();
  await delay(300);
  await rm(profile, { recursive: true, force: true });
}
