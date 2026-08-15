import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

const base = "http://127.0.0.1:3001";
const kylePassword = process.env.HYPERLINX_TEST_KYLE_PASSWORD;
const googlePassword = process.env.HYPERLINX_TEST_GOOGLE_PASSWORD;
if (!kylePassword || !googlePassword) {
  throw new Error("HYPERLINX_TEST_KYLE_PASSWORD and HYPERLINX_TEST_GOOGLE_PASSWORD are required.");
}
const sha = (value) => createHash("sha256").update(value).digest("hex");
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const jsonFile = (relative) => fs.readFileSync(relative);
const governedFiles = [
  "server/data/proposal-drafts/PROP-DEMO-OPPORTUNITY-3SWR-v2.json",
  "server/data/commercial-routes/ROUTE-REPO-OPP-DEMO-OPPORTUNITY-3SWR-1786645604709-COMMERCIAL-DRAFT-IMPORT-ROUTE-HELSWR-REVISED-71526-1.json",
  "server/data/certified-iof-packages/CERT-IOF-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2.json",
  "server/data/service-orders/SO-PROP-DEMO-OPPORTUNITY-3SWR-v2-R001.json",
  "server/data/scopeversions/ScopeVersion-0001-CERT-IOF-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2.json",
];
const before = Object.fromEntries(governedFiles.map((file) => [file, sha(jsonFile(file))]));
const proposal = JSON.parse(jsonFile(governedFiles[0]));
const route = JSON.parse(jsonFile(governedFiles[1]));
const serviceOrder = JSON.parse(jsonFile(governedFiles[3]));

async function login(username, password) {
  const response = await fetch(`${base}/api/auth/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({username,password}) });
  assert(response.ok, `${username} login failed`); return response.json();
}
async function download(url, token) {
  const started = performance.now(); const response = await fetch(`${base}${url}`, { headers:{Authorization:`Bearer ${token}`} }); const buffer = Buffer.from(await response.arrayBuffer());
  return { response, buffer, durationMs: Math.round((performance.now()-started)*10)/10, filename:(response.headers.get("content-disposition")??"").match(/filename="?([^";]+)/i)?.[1]??"" };
}
const kyle = await login("kyle", kylePassword); const google = await login("google", googlePassword);
const urls = {
  proposal:"/api/exports/proposals/PROP-DEMO-OPPORTUNITY-3SWR-v2/pdf",
  sow:"/api/exports/service-orders/SO-PROP-DEMO-OPPORTUNITY-3SWR-v2-R001/pdf",
  proposalKmz:"/api/exports/proposals/PROP-DEMO-OPPORTUNITY-3SWR-v2/route.kmz",
  certifiedKmz:"/api/exports/certified-iof/CERT-IOF-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2/route.kmz",
  authorizedKmz:"/api/exports/scopeversions/ScopeVersion-0001-CERT-IOF-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2/route.kmz",
};
const artifacts = {};
for (const [name,url] of Object.entries(urls)) artifacts[name] = await download(url,kyle.token);
for (const [name,item] of Object.entries(artifacts)) assert(item.response.ok, `${name} export failed: ${item.response.status}`);

const proposalText = artifacts.proposal.buffer.toString("latin1");
const sowText = artifacts.sow.buffer.toString("latin1");
assert(proposalText.startsWith("%PDF-1.4") && sowText.startsWith("%PDF-1.4"), "PDF signature invalid");
assert(proposalText.includes(proposal.proposalRevisionId) && proposalText.includes(proposal.proposalHash), "Proposal revision/hash absent");
assert(proposalText.includes("150.68 miles") && proposalText.includes("Handholes: 319") && proposalText.includes("Vaults: 19") && proposalText.includes("Splice cases: 33"), "Proposal route/quantities absent");
assert(proposalText.includes("82% plow, 12% dirt bore, 0% rock bore, 6% open trench"), "Proposal civil mix absent");
assert(proposalText.includes("NRC: $26,334,426") && proposalText.includes("MRC/O&M: $15,068"), "Proposal commercial terms absent");
assert(proposalText.includes(route.geometryHash) && proposalText.includes(route.routeRepositoryId), "Proposal governed map authority absent");
assert(!/cache key|runtime diagnostics|react render|graph-edge/i.test(proposalText), "Proposal exposes internal data");
assert(sowText.includes(serviceOrder.documentHash) && sowText.includes(serviceOrder.serviceOrderId), "SOW revision/hash absent");
assert(sowText.includes("Customer signer: Google Customer") && sowText.includes("Teralinx countersignature: Kyle"), "SOW signatures absent");
assert(sowText.includes(serviceOrder.scopeVersionId) && sowText.includes("Execution Authority: AUTHORIZED"), "Authorized ScopeVersion absent");
assert(!/cache key|runtime diagnostics|react render|graph-edge/i.test(sowText), "SOW exposes internal data");

async function inspectKmz(item) {
  const zip = await JSZip.loadAsync(item.buffer); const kml = await zip.file("doc.kml").async("string");
  const line = kml.match(/<LineString>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/)?.[1]?.trim().split(/\s+/) ?? [];
  const ids = [...kml.matchAll(/<Data name="ObjectID"><value>(.*?)<\/value><\/Data>/g)].map((m)=>m[1]);
  const types = [...kml.matchAll(/<Data name="ObjectType"><value>(.*?)<\/value><\/Data>/g)].map((m)=>m[1]);
  return { kml, line, ids, types, stationRefs:(kml.match(/ONE_MILE/g)??[]).length, placemarks:(kml.match(/<Placemark>/g)??[]).length };
}
const certified = await inspectKmz(artifacts.certifiedKmz), authorized = await inspectKmz(artifacts.authorizedKmz);
for (const item of [certified,authorized]) {
  assert(item.line.length === route.commercialGeometry.length && item.line.every((coordinate,index)=>coordinate.startsWith(`${route.commercialGeometry[index][0]},${route.commercialGeometry[index][1]},`)), "KMZ geometry differs from governed route");
  assert(item.ids.length === 433 && new Set(item.ids).size === item.ids.length, "KMZ facilities missing or duplicated");
  for (const type of ["HANDHOLE","VAULT","SPLICE_CASE","MARKER_POST","SLACK_LOOP"]) assert(item.types.includes(type), `KMZ object class missing: ${type}`);
  assert(item.stationRefs > 100 && item.stationRefs < 200, "KMZ station-reference density is invalid");
  assert(item.kml.includes("<name>Engineering Conditions</name>") && item.kml.includes("<name>Scope Components</name>"), "KMZ governed folders missing");
  assert(!/react|cache key|runtime diagnostics|render id/i.test(item.kml), "KMZ exposes internal data");
}
assert(certified.kml.includes("Execution: NOT AUTHORIZED") && !certified.kml.includes("ScopeVersion-0001"), "Certified KMZ lifecycle state invalid");
assert(authorized.kml.includes("Execution: AUTHORIZED") && authorized.kml.includes(serviceOrder.scopeVersionId), "Authorized KMZ lifecycle state invalid");
assert(certified.kml.includes(route.geometryHash) && authorized.kml.includes(route.geometryHash), "KMZ geometry hash absent");

const repeatProposal = await download(urls.proposal,kyle.token), repeatSow = await download(urls.sow,kyle.token), repeatCertified = await download(urls.certifiedKmz,kyle.token), repeatAuthorized = await download(urls.authorizedKmz,kyle.token);
assert(sha(repeatProposal.buffer)===sha(artifacts.proposal.buffer) && sha(repeatSow.buffer)===sha(artifacts.sow.buffer) && sha(repeatCertified.buffer)===sha(artifacts.certifiedKmz.buffer) && sha(repeatAuthorized.buffer)===sha(artifacts.authorizedKmz.buffer), "Binary exports are not deterministic");
const googleProposal = await download(urls.proposal,google.token); assert(googleProposal.response.ok,"Assigned customer cannot export Proposal");
const unauthenticated = await fetch(`${base}${urls.proposal}`); assert(unauthenticated.status===401,"Unauthenticated export was not rejected");
const guessed = await download("/api/exports/proposals/CROSS-TENANT-GUESSED-ID/pdf",google.token); assert(guessed.response.status===404,"Guessed cross-scope ID was not rejected");
const after = Object.fromEntries(governedFiles.map((file) => [file, sha(jsonFile(file))]));
assert(Object.keys(before).every((file)=>before[file]===after[file]),"Export mutated governed source authority");

const browserResult = { available:false };
try {
  const pages = await (await fetch("http://127.0.0.1:9222/json/list")).json(); const page=pages.find((item)=>item.type==="page"&&item.url==="http://127.0.0.1:5173/");
  if (page) {
    const downloadDirectory=path.resolve("artifacts/cip051-browser-downloads"); fs.mkdirSync(downloadDirectory,{recursive:true});
    for(const file of fs.readdirSync(downloadDirectory)) if(/^Teralinx_/.test(file)) fs.rmSync(path.join(downloadDirectory,file),{force:true});
    const socket=new WebSocket(page.webSocketDebuggerUrl); let id=0; const pending=new Map(); const exceptions=[]; const consoleErrors=[];
    socket.onmessage=(event)=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){pending.get(message.id)(message);pending.delete(message.id);}else if(message.method==="Runtime.exceptionThrown")exceptions.push(message.params);else if(message.method==="Runtime.consoleAPICalled"&&message.params.type==="error")consoleErrors.push(message.params);};
    await new Promise((resolve)=>socket.onopen=resolve); const send=(method,params={})=>new Promise((resolve)=>{const requestId=++id;pending.set(requestId,resolve);socket.send(JSON.stringify({id:requestId,method,params}));});
    const evaluate=async(expression)=>{const response=await send("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true});return response.result?.result?.value;}; const wait=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));
    await Promise.all([send("Runtime.enable"),send("Page.enable")]); await send("Browser.setDownloadBehavior",{behavior:"allow",downloadPath:downloadDirectory,eventsEnabled:true}); await send("Page.reload",{ignoreCache:true}); await wait(1200);
    await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Twin');b?.click();return Boolean(b)})()`); await wait(3200);
    const twinButtons=await evaluate(`[...document.querySelectorAll('button')].map(x=>x.textContent.trim()).filter(x=>x.startsWith('Download'))`);
    for(const label of ["Download Service Order PDF","Download Certified Route KMZ","Download Authorized Route KMZ"]){await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(label)});b?.click();return Boolean(b)})()`);await wait(700);}
    await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Commercial Planning');b?.click();return Boolean(b)})()`);
    await wait(600);
    await evaluate(`(()=>{const s=[...document.querySelectorAll('select')].find(x=>[...x.options].some(o=>o.textContent.includes('Account 2')||o.textContent.includes('Google')));if(!s)return false;const o=[...s.options].find(o=>o.textContent.includes('Account 2'))??[...s.options].find(o=>o.textContent.includes('Google'));s.value=o.value;s.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
    await wait(900);
    await evaluate(`(()=>{const id='OPP-DEMO-OPPORTUNITY-3SWR-1786645604709';const s=[...document.querySelectorAll('select')].find(x=>[...x.options].some(o=>o.value===id||o.textContent.trim()==='Demo Opportunity 3swr'));if(s){const o=[...s.options].find(o=>o.value===id)??[...s.options].find(o=>o.textContent.trim()==='Demo Opportunity 3swr');s.value=o.value;s.dispatchEvent(new Event('change',{bubbles:true}));}const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Demo Opportunity 3swr');b?.click();return Boolean(s||b)})()`);
    await wait(2500);
    let plannerButtons=[]; for(let attempt=0;attempt<80&&!plannerButtons.includes("Download Proposal PDF");attempt+=1){await wait(150);plannerButtons=await evaluate(`[...document.querySelectorAll('button')].map(x=>x.textContent.trim()).filter(x=>x.startsWith('Download'))`);}
    for(const label of ["Download Proposal PDF","Download Route KMZ"]){await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(label)});b?.click();return Boolean(b)})()`);await wait(700);}
    for(let attempt=0;attempt<40&&fs.readdirSync(downloadDirectory).filter((file)=>!file.endsWith(".crdownload")).length<5;attempt+=1)await wait(200);
    const savedFiles=fs.readdirSync(downloadDirectory).filter((file)=>!file.endsWith(".crdownload"));
    const browserFetch=await evaluate(`(async()=>{const s=JSON.parse(localStorage.getItem('teralinx:auth-session:v1'));const r=await fetch('${urls.proposal}',{headers:{Authorization:'Bearer '+s.token}});const b=await r.arrayBuffer();return {status:r.status,type:r.headers.get('content-type'),disposition:r.headers.get('content-disposition'),bytes:b.byteLength,magic:String.fromCharCode(...new Uint8Array(b.slice(0,4)))}})()`);
    const plannerBody=await evaluate(`document.body.innerText.slice(0,1800)`);
    Object.assign(browserResult,{available:true,twinButtons,plannerButtons,savedFiles,plannerBody,browserFetch,runtimeExceptions:exceptions.length,consoleErrors:consoleErrors.length}); socket.close();
    if (!twinButtons.includes("Download Service Order PDF") || !plannerButtons.includes("Download Proposal PDF") || savedFiles.length !== 5) console.error("CIP051_BROWSER_CONTROLS", JSON.stringify(browserResult));
    assert(twinButtons.includes("Download Service Order PDF")&&twinButtons.includes("Download Certified Route KMZ")&&twinButtons.includes("Download Authorized Route KMZ"),"Twin download controls missing");
    assert(plannerButtons.includes("Download Proposal PDF")&&plannerButtons.includes("Download Route KMZ"),"Planner download controls missing");
    assert(savedFiles.length===5&&savedFiles.every((file)=>/^Teralinx_.*\.(pdf|kmz)$/i.test(file)),"Browser save-to-PC workflow did not produce all five human-readable files");
    assert(browserFetch.status===200&&browserFetch.magic==="%PDF"&&/attachment/.test(browserFetch.disposition),"Browser PDF download response invalid");
    assert(exceptions.length===0&&consoleErrors.length===0,"Browser console/runtime errors detected");
  }
} catch (error) { browserResult.error=error.message; throw error; }

console.log(JSON.stringify({
  result:"PASS",
  proposal:{filename:artifacts.proposal.filename,bytes:artifacts.proposal.buffer.length,durationMs:artifacts.proposal.durationMs,hash:sha(artifacts.proposal.buffer),pages:(proposalText.match(/\/Type \/Page\b/g)??[]).length},
  serviceOrder:{filename:artifacts.sow.filename,bytes:artifacts.sow.buffer.length,durationMs:artifacts.sow.durationMs,hash:sha(artifacts.sow.buffer),pages:(sowText.match(/\/Type \/Page\b/g)??[]).length},
  proposalKmz:{filename:artifacts.proposalKmz.filename,bytes:artifacts.proposalKmz.buffer.length,durationMs:artifacts.proposalKmz.durationMs},
  certifiedKmz:{filename:artifacts.certifiedKmz.filename,bytes:artifacts.certifiedKmz.buffer.length,durationMs:artifacts.certifiedKmz.durationMs,hash:sha(artifacts.certifiedKmz.buffer),facilityCount:certified.ids.length,stationReferenceCount:certified.stationRefs,routePointCount:certified.line.length},
  authorizedKmz:{filename:artifacts.authorizedKmz.filename,bytes:artifacts.authorizedKmz.buffer.length,durationMs:artifacts.authorizedKmz.durationMs,hash:sha(artifacts.authorizedKmz.buffer),facilityCount:authorized.ids.length,stationReferenceCount:authorized.stationRefs,routePointCount:authorized.line.length},
  security:{assignedCustomerStatus:googleProposal.response.status,unauthenticatedStatus:unauthenticated.status,guessedCrossScopeStatus:guessed.response.status},
  deterministicBinary:true,sourceAuthorityUnchanged:true,browser:browserResult,
},null,2));
