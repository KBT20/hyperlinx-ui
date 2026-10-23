import path from 'node:path';
import {mkdir,open,unlink} from 'node:fs/promises';
import {DATA_ROOT,DIRS,currentRepositoryAuthority,listRecords,loadRecord,persistRecord,prevalidateGovernedRecord,nowIso} from '../routes/_shared.js';
import {userHasPermission} from '../routes/auth.js';
import {contentCanonicalHash as hash} from '../content/content-registry-authority.js';
import {assertIofScope} from './iof-package-repository.js';
import {openIofExport} from './iof-package-outputs.js';
import {offlineCalibrationState,previewOfflineExport,createOfflineCalibrationExport} from './iof-offline-calibration-store.js';
import {workingFinancialState,preliminaryBudget,estimateVariance,r4cScope} from './iof-working-financial.js';
import {financialEnrichmentContext} from './iof-financial-enrichment-contract.js';
import {iofResearchState,saveIofResearch} from './iof-research-store.js';
import {researchConfiguration,providerStatus,checkResearchProvider,assertNoResearchSecrets} from './iof-research-provider.js';
export const FINANCIAL_AI_ACK='I authorize bounded OpenAI analysis of this exact local P2P package, Spine, doctrine and financial evidence. Findings require human review and cannot change geometry, approved costs, engineering or customer commitments.';
export const FINANCIAL_REVIEW_ACK='I reviewed the exact finding, source evidence and financial comparison. I assign responsibility for this preliminary decision; it does not certify Engineering or release a binding quotation or ScopeVersion.';
export const R4C_BUDGET={model:'gpt-5-mini',maxRuns:3,maxAggregateUsd:10,maxPerRunUsd:0.1,stopAfterSuccess:true,inputUsdPerMillion:0.25,outputUsdPerMillion:2,priceSource:'https://developers.openai.com/api/docs/models/gpt-5-mini',priceRevision:'OPENAI-GPT-5-MINI-STANDARD-2026-10-18'};
const options={projectRepositoryAuthority:false,readOnly:true},fail=(code,status=422)=>{throw Object.assign(Error(code),{code,status});},missing=e=>{if(e.code==='ENOENT')return null;throw e;};
function authorize(user){if(currentRepositoryAuthority().authorityClass!=='DEMO'||!user?.principalId||!user.membershipId||!user.sessionId||!userHasPermission(user,'proposal.manage'))fail('R4C_LOCAL_REVIEW_PERMISSION_REQUIRED',403);}
function config(){const c=researchConfiguration(),p=c.providers.find(p=>p.providerId==='OPENAI');Object.assign(p,{model:R4C_BUDGET.model,enabled:true,inputUsdPerMillion:R4C_BUDGET.inputUsdPerMillion,outputUsdPerMillion:R4C_BUDGET.outputUsdPerMillion,priceRevision:R4C_BUDGET.priceRevision});c.liveAuthorized=true;return c;}
function verify(r){if(hash(r.payload)!==r.hash)fail('R4C_EVIDENCE_HASH_CONFLICT',409);return r;}
async function record(id,payload){const r=prevalidateGovernedRecord(id,{artifactId:id,revision:1,payload,hash:hash(payload),immutable:true});await persistRecord(DIRS.runtimeEvidence,id,r);return r;}
async function lock(name,action){const dir=path.join(currentRepositoryAuthority().dataRoot,path.relative(DATA_ROOT,DIRS.runtimeEvidence));await mkdir(dir,{recursive:true});const file=path.join(dir,name+'.lock');let h;try{h=await open(file,'wx');}catch(e){if(e.code==='EEXIST')fail('R4C_BUSY_OR_RECOVERY_REQUIRED',409);throw e;}try{return await action();}finally{await h.close();await unlink(file);}}
export function budgetState(reservations,successful){const reservedUsd=reservations.reduce((n,r)=>n+r.payload.reservedUsd,0),runs=reservations.length;return {...R4C_BUDGET,runs,reservedUsd,successful,remainingRuns:Math.max(0,R4C_BUDGET.maxRuns-runs),blocked:successful?'SUCCESS_REQUIRES_EXECUTIVE_REVIEW':runs>=R4C_BUDGET.maxRuns?'RUN_LIMIT_EXHAUSTED':reservedUsd+R4C_BUDGET.maxPerRunUsd>R4C_BUDGET.maxAggregateUsd?'AGGREGATE_BUDGET_EXHAUSTED':null};}
async function budget(){const records=await listRecords(DIRS.runtimeEvidence,options),reservations=records.filter(r=>r.payload?.schemaVersion==='IOF-R4C-BUDGET-RESERVATION-R1').map(verify);const successful=records.some(r=>{if(r.payload?.schemaVersion!=='IOF-RESEARCH-RESULT-R1'||r.payload.run?.purpose!=='R4C_SPINE_FINANCIAL_ENRICHMENT')return false;verify(r);const run=r.payload.run,b={...run};delete b.runHash;delete b.immutable;if(hash(b)!==run.runHash)fail('R4C_RUN_HASH_CONFLICT',409);return run.executionMode==='LIVE_ATTEMPT'&&run.status==='COMPLETE';});return budgetState(reservations,successful);}
async function context(scope,id){const saved=await openIofExport(scope,id);if(!r4cScope(saved.snapshot))fail('R4C_EXACT_AUTHORIZED_P2P_REQUIRED',403);return saved;}
async function decisions(scope,saved){const rows=[];for(const r of await listRecords(DIRS.runtimeEvidence,options)){if(r.payload?.schemaVersion!=='IOF-R4C-HUMAN-DECISION-R1')continue;try{assertIofScope(scope,r,saved.snapshot.context.opportunityId);}catch{continue;}if(r.payload.exportId===saved.exportId)rows.push(verify(r).payload);}return rows;}
export async function financialAiState(scope,id,user){
 authorize(user);const saved=await context(scope,id),research=await iofResearchState(scope,id,user),reviewed=await decisions(scope,saved);
 const origin=saved.snapshot.iofPackage.constructionAssemblyRevision?.baseExportId;
 if(origin){const prior=await financialAiState(scope,origin,user);research.runs.push(...prior.runs.filter(r=>!research.runs.some(existing=>existing.runHash===r.runHash)));reviewed.push(...prior.decisions);}
 return {exportId:id,artifactHash:saved.snapshot.artifactHash,provider:providerStatus(config()).find(p=>p.providerId==='OPENAI'),budget:await budget(),runs:research.runs.filter(r=>r.purpose==='R4C_SPINE_FINANCIAL_ENRICHMENT'),decisions:reviewed,acknowledgementText:FINANCIAL_AI_ACK,reviewAcknowledgementText:FINANCIAL_REVIEW_ACK};
}
export async function financialAiReadiness(scope,id,user){authorize(user);await context(scope,id);const c=config(),p=c.providers.find(p=>p.providerId==='OPENAI'),b=await budget();if(b.blocked)fail('R4C_'+b.blocked,409);if(!p.apiKey)return {ready:false,reason:'SERVER_CREDENTIALS_NOT_CONFIGURED',budget:b};const checked=await checkResearchProvider(p);return {ready:checked.readiness==='MODEL_ADVERTISED_INFERENCE_NOT_VERIFIED',provider:checked,budget:b};}
export async function runFinancialAi(scope,id,body,user){
 authorize(user);const saved=await context(scope,id);
 if(!body||Object.keys(body).some(k=>!['requestId','expectedArtifactHash','acknowledgementText'].includes(k))||!/^[A-Za-z0-9_-]{8,128}$/.test(body.requestId||'')||body.acknowledgementText!==FINANCIAL_AI_ACK)fail('R4C_ENRICHMENT_ACK_REQUIRED');
 if(saved.snapshot.artifactHash!==body.expectedArtifactHash)fail('R4C_STALE_PACKAGE',409);
 return lock('r4c-aggregate-budget',async()=>{
  const commandHash=hash({exportId:id,...body}),reservationId='IOF-R4C-BUDGET-DEMO-'+hash({principalId:user.principalId,requestId:body.requestId}),prior=await loadRecord(DIRS.runtimeEvidence,reservationId,options).catch(missing);
  if(prior){verify(prior);assertIofScope(scope,prior,saved.snapshot.context.opportunityId);if(prior.payload.commandHash!==commandHash)fail('R4C_RETRY_CONTENT_CONFLICT',409);const state=await financialAiState(scope,id,user),run=state.runs.find(r=>r.actor.requestId===body.requestId&&r.actor.principalId===user.principalId);if(!run)fail('R4C_INTERRUPTED_REQUIRES_OPERATOR_REVIEW',409);return {run,idempotent:true,budget:state.budget};}
  const ready=await financialAiReadiness(scope,id,user);if(!ready.ready)fail('R4C_SERVER_CREDENTIALS_NOT_READY',409);
  const financial=await workingFinancialState(scope,id),research=await iofResearchState(scope,id,user),enrichment=await import('./iof-enrichment-store.js'),state=await enrichment.enrichmentState(scope,id);
  if(!state.branches.length)fail('R4C_CANONICAL_SPINE_REQUIRED');
  const contextual=financialEnrichmentContext(saved.snapshot,financial,state.branches),c=config();assertNoResearchSecrets(contextual.context,c);
  await record(reservationId,{schemaVersion:'IOF-R4C-BUDGET-RESERVATION-R1',context:saved.snapshot.context,exportId:id,commandHash,requestId:body.requestId,principalId:user.principalId,reservedUsd:R4C_BUDGET.maxPerRunUsd,model:R4C_BUDGET.model,createdAt:nowIso()});
  const result=await saveIofResearch(scope,id,{...body,branchIds:research.branches.map(b=>b.branchId),request:{providerId:'OPENAI',objective:'Review this exact native P2P Spine and physical/financial assembly for source-backed scope gaps and potential cost increases or decreases. Do not fill unknown prices. Return concise object-level recommendations for human review.',maxCostUsd:R4C_BUDGET.maxPerRunUsd,maxTokens:160000,maxToolCalls:0,maxDurationMs:30000}},user,{config:c,contextual,acknowledgementText:FINANCIAL_AI_ACK});
  return {...result,budget:await budget()};
 });
}
export async function previewFinancialDecision(scope,id,body,user){
 authorize(user);const saved=await context(scope,id),state=await financialAiState(scope,id,user);
 if(!body||Object.keys(body).some(k=>!['expectedArtifactHash','runHash','findingId','decision','note','reviewedInput'].includes(k))||body.expectedArtifactHash!==saved.snapshot.artifactHash)fail('R4C_REVIEW_STALE_OR_INVALID',409);
 const run=state.runs.find(r=>r.runHash===body.runHash),finding=run?.findings.find(f=>f.findingId===body.findingId);
 if(run&&run.binding.packageRevisionHash!==saved.snapshot.iofPackage.packageRevisionHash)fail('R4C_REOPEN_ORIGINAL_FINDING_PACKAGE_FOR_REVIEW');
 if(!finding||run.status!=='COMPLETE'||!['REJECT','ACCEPT_EVIDENCE','ACCEPT_ADJUSTMENT'].includes(body.decision)||typeof body.note!=='string'||!body.note.trim()||body.note.length>3000)fail('R4C_EXACT_FINDING_AND_HUMAN_REASON_REQUIRED');
 const before=await workingFinancialState(scope,id);let after=before.budget,input=null;
 if(body.decision==='ACCEPT_ADJUSTMENT'){
  if(!before.financialChangesAllowed||!body.reviewedInput||!body.reviewedInput.reason?.trim())fail('R4C_HUMAN_COST_INPUT_OR_OPEN_SOURCE_REQUIRED');
  input=structuredClone(body.reviewedInput);
  // This workflow can change preliminary classifications/restoration or existing
  // V4 selections, through the native engine. Geometry and native quantities are
  // never editable here. Existing engine validation remains controlling.
  const template=(await offlineCalibrationState(scope,id)).input;
  if(input.schemaVersion!==template.schemaVersion||input.routes.length!==template.routes.length||input.routes.some(r=>!template.routes.some(t=>t.routeId===r.routeId&&t.networkClass===r.networkClass&&t.assumedRouteFeet===r.assumedRouteFeet)))fail('R4C_NATIVE_SCOPE_CHANGE_DENIED');
  for(const r of input.routes){const old=template.routes.find(t=>t.routeId===r.routeId);if(r.restorationRate!==old.restorationRate&&(!r.restorationPriceSource?.trim()||r.restorationPriceSource===old.restorationPriceSource))fail('R4C_NEW_COST_SOURCE_REFERENCE_REQUIRED');}
  input.reason=body.note+' | R4C finding '+finding.findingId+' | '+input.reason;
  after=preliminaryBudget(saved.snapshot,await previewOfflineExport(scope,id,input,{exactWorkPackageEndpoints:true}));
 }else if(body.reviewedInput!==null&&body.reviewedInput!==undefined)fail('R4C_NONFINANCIAL_DECISION_INPUT_DENIED');
 const value={exportId:id,artifactHash:saved.snapshot.artifactHash,runHash:run.runHash,findingId:finding.findingId,decision:body.decision,note:body.note,input,before:before.budget,after,variance:estimateVariance(before.budget,after)};
 return {...value,previewHash:hash(value),acknowledgementText:FINANCIAL_REVIEW_ACK};
}
export async function saveFinancialDecision(scope,id,body,user){
 if(!body||Object.keys(body).some(k=>!['review','expectedPreviewHash','acknowledgementText','requestId'].includes(k))||body.acknowledgementText!==FINANCIAL_REVIEW_ACK||!/^[A-Za-z0-9_-]{8,128}$/.test(body.requestId||''))fail('R4C_HUMAN_DECISION_ACK_REQUIRED');
 const preview=await previewFinancialDecision(scope,id,body.review,user);if(preview.previewHash!==body.expectedPreviewHash)fail('R4C_COMPARISON_CHANGED',409);
 const decisionId='IOF-R4C-DECISION-DEMO-'+hash({exportId:id,runHash:preview.runHash,findingId:preview.findingId});
 return lock(decisionId,async()=>{
  const commandHash=hash(body),prior=await loadRecord(DIRS.runtimeEvidence,decisionId,options).catch(missing);
  if(prior){verify(prior);if(prior.payload.commandHash!==commandHash)fail('R4C_FINDING_ALREADY_DECIDED',409);return {decision:prior.payload,idempotent:true};}
  let revised=null;
  if(preview.input){const s=await offlineCalibrationState(scope,id);revised=await createOfflineCalibrationExport(scope,id,{expectedArtifactHash:preview.artifactHash,input:preview.input,acknowledgementText:s.acknowledgementText,requestId:body.requestId},user);}
  const saved=await context(scope,id),after=revised?(await workingFinancialState(scope,revised.exportId)).budget:preview.before,payload={schemaVersion:'IOF-R4C-HUMAN-DECISION-R1',context:saved.snapshot.context,decisionId,exportId:id,artifactHash:preview.artifactHash,runHash:preview.runHash,findingId:preview.findingId,decision:preview.decision,note:preview.note,commandHash,previewHash:preview.previewHash,before:preview.before,after,variance:estimateVariance(preview.before,after),resultExportId:revised?.exportId||id,resultPackageRevisionHash:revised?.snapshot.iofPackage.packageRevisionHash||saved.snapshot.iofPackage.packageRevisionHash,reviewedInput:preview.input,actor:{principalId:user.principalId,membershipId:user.membershipId,sessionId:user.sessionId},recordedAt:nowIso(),acknowledgementText:FINANCIAL_REVIEW_ACK,engineeringApproval:false,contractualAuthority:false,scopeVersionReleased:false};
  await record(decisionId,payload);return {decision:payload,revised,idempotent:false};
 });
}
