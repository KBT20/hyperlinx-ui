import path from 'node:path';
import {mkdir,open,unlink} from 'node:fs/promises';
import {DIRS,DATA_ROOT,currentRepositoryAuthority,prevalidateGovernedRecord,persistRecord,loadRecord,listRecords} from '../routes/_shared.js';
import {userHasPermission} from '../routes/auth.js';
import {contentCanonicalHash as hash} from '../content/content-registry-authority.js';
import {assertIofScope} from './iof-package-repository.js';
import {enrichmentState} from './iof-enrichment-store.js';
import {researchConfiguration,providerStatus,checkResearchProvider,assertNoResearchSecrets} from './iof-research-provider.js';
import {executeResearch,validateResearchRequest,RESEARCH_ACK,BLACKWELL_OBJECTIVE} from './iof-research.js';
import {researchError as error} from './iof-research-http.js';
const options={projectRepositoryAuthority:false,readOnly:true};
const missing=e=>{if(e.code==='ENOENT')return null;throw e;};
function authorize(user){if(!user?.principalId||!user.membershipId||!user.sessionId||!userHasPermission(user,'proposal.manage'))throw error('RESEARCH_OPERATOR_PERMISSION_REQUIRED',403);}
function demo(){if(currentRepositoryAuthority().authorityClass!=='DEMO')throw error('RESEARCH_CHECKPOINT_DEMO_ONLY',403);}
async function records(scope,state){
  const result=[];for(const r of await listRecords(DIRS.runtimeEvidence,options)){
    if(r.payload?.schemaVersion!=='IOF-RESEARCH-RESULT-R1')continue;
    try{assertIofScope(scope,r,state.researchContext.opportunityId);}catch{continue;}
    if(r.payload.run.binding.exportId!==state.exportId||r.payload.run.binding.artifactHash!==state.artifactHash)continue;
    const run=r.payload.run,basis={...run};delete basis.runHash;delete basis.immutable;
    if(hash(r.payload)!==r.hash||hash(basis)!==run.runHash)throw error('RESEARCH_SAVED_HASH_CONFLICT',409);
    result.push(run);
  }return result;
}
async function context(scope,exportId){
  const state=await enrichmentState(scope,exportId);
  // Derive context through the already validated export, not browser identities.
  const {openIofExport}=await import('./iof-package-outputs.js');
  const saved=await openIofExport(scope,exportId);return {...state,researchContext:saved.snapshot.context,packageRevisionHash:saved.snapshot.iofPackage.packageRevisionHash};
}
export async function iofResearchState(scope,exportId,user){
  authorize(user);const state=await context(scope,exportId),config=researchConfiguration();
  return {exportId,artifactHash:state.artifactHash,providers:providerStatus(config),search:{provider:'BRAVE',configured:Boolean(config.search.apiKey&&config.search.enabled),costAuthority:config.search.usdPerCall!==null&&Boolean(config.search.priceRevision)},publicDomains:config.domains,branches:state.branches.map(b=>({branchId:b.branchId,routeId:b.routeId,spineRevisionHash:b.spineRevisionHash,productId:b.productId})),runs:await records(scope,state),acknowledgementText:RESEARCH_ACK,sampleObjective:BLACKWELL_OBJECTIVE,limits:{maxTokens:24000,maxToolCalls:6,maxDurationMs:30000,maxCostUsd:0.1},liveAuthorization:config.liveAuthorized};
}
export async function iofResearchReadiness(scope,exportId,body,user){
  authorize(user);demo();await context(scope,exportId);const config=researchConfiguration(),p=config.providers.find(p=>p.providerId===body?.providerId);
  if(!body||Object.keys(body).some(k=>!['providerId','acknowledgementText'].includes(k))||body.acknowledgementText!==RESEARCH_ACK||!p)throw error('RESEARCH_READINESS_REQUEST_INVALID');
  if(!config.liveAuthorized||!p.enabled)throw error('RESEARCH_LIVE_NOT_AUTHORIZED',403);
  return checkResearchProvider(p);
}
export async function saveIofResearch(scope,exportId,body,user,deps){
  authorize(user);demo();
  const acknowledgement=deps?.acknowledgementText||RESEARCH_ACK;
  if(!body||Object.keys(body).some(k=>!['requestId','expectedArtifactHash','branchIds','request','acknowledgementText'].includes(k))||body.acknowledgementText!==acknowledgement||!/^[A-Za-z0-9_-]{8,128}$/.test(body.requestId||''))throw error('RESEARCH_ACK_AND_REQUEST_REQUIRED');
  validateResearchRequest(body.request,{contextual:Boolean(deps?.contextual)});const state=await context(scope,exportId);
  assertNoResearchSecrets(body,deps?.config||researchConfiguration());
  if(state.artifactHash!==body.expectedArtifactHash)throw error('RESEARCH_STALE_ARTIFACT',409);
  if(!Array.isArray(body.branchIds)||!body.branchIds.length||body.branchIds.length>20||new Set(body.branchIds).size!==body.branchIds.length||body.branchIds.some(id=>!state.branches.some(b=>b.branchId===id)))throw error('RESEARCH_EXACT_NATIVE_BRANCH_REQUIRED');
  const binding={context:state.researchContext,exportId,artifactHash:state.artifactHash,packageRevisionHash:state.packageRevisionHash,branches:state.branches.filter(b=>body.branchIds.includes(b.branchId)).map(b=>({branchId:b.branchId,productId:b.productId,routeId:b.routeId,spineId:b.spineId,spineRevisionHash:b.spineRevisionHash,sourceRevision:b.sourceRevision,inventoryRevisionId:b.inventoryRevisionId,inventoryHash:b.inventoryHash}))};
  if(deps?.contextual)binding.financialContextHash=hash(deps.contextual.context);
  const commandHash=hash({binding,request:body.request}),repository=currentRepositoryAuthority(),id='IOF-RESEARCH-DEMO-'+hash({context:binding.context,principalId:user.principalId,requestId:body.requestId}),resultId=id+'-RESULT';
  const dir=path.join(repository.dataRoot,path.relative(DATA_ROOT,DIRS.runtimeEvidence));await mkdir(dir,{recursive:true});const lockPath=path.join(dir,id+'.lock');let lock;
  try{lock=await open(lockPath,'wx');}catch(e){if(e.code==='EEXIST')throw error('RESEARCH_BUSY_RETRY',409);throw e;}
  try{
    const existing=await loadRecord(DIRS.runtimeEvidence,resultId,options).catch(missing);
    if(existing){assertIofScope(scope,existing,binding.context.opportunityId);if(existing.payload.commandHash!==commandHash)throw error('RESEARCH_RETRY_CONTENT_CONFLICT',409);const matched=(await records(scope,state)).find(r=>r.runId===existing.payload.run.runId);if(!matched)throw error('RESEARCH_SAVED_HASH_CONFLICT',409);return {run:matched,idempotent:true};}
    const started=await loadRecord(DIRS.runtimeEvidence,id,options).catch(missing);
    if(started)throw error(started.payload.commandHash!==commandHash?'RESEARCH_RETRY_CONTENT_CONFLICT':'RESEARCH_INTERRUPTED_REQUIRES_OPERATOR_REVIEW',409);
    const actor={principalId:user.principalId,membershipId:user.membershipId,sessionId:user.sessionId,requestId:body.requestId,acknowledgementText:acknowledgement};
    // Reserve before any paid operation. A crash is never automatically retried
    // and charged again; its immutable marker remains for operator review.
    const reservation={schemaVersion:'IOF-RESEARCH-REQUEST-R1',context:binding.context,commandHash,binding,request:body.request,actor};
    await persistRecord(DIRS.runtimeEvidence,id,prevalidateGovernedRecord(id,{artifactId:id,revision:1,payload:reservation,hash:hash(reservation),immutable:true}));
    let run;try{run=await executeResearch(body.request,binding,actor,deps);}catch(e){
      const code=e.code?.startsWith('RESEARCH_')?e.code:'RESEARCH_EXECUTION_FAILED';
      const basis={schemaVersion:'IOF-RESEARCH-RUN-R1',runId:id+'-UNAVAILABLE',binding,request:body.request,actor,status:'UNAVAILABLE',failure:code,providerId:body.request.providerId,model:null,findings:[],qualifications:['No inference or source verification is claimed.'],evidence:[],toolCalls:[],inferences:[],usage:{elapsedMs:0,reservedTokens:0,reservedCostUsd:0,networkRequests:0,actualTokens:null},authority:{nonAuthoritative:true,humanReviewRequired:true,mutatesSpine:false,engineeringApproval:false,pricingAuthority:false,customerDisclosure:false,scopeVersionAuthority:false}};run={...basis,runHash:hash(basis),immutable:true};
    }
    const payload={schemaVersion:'IOF-RESEARCH-RESULT-R1',context:binding.context,commandHash,run};
    await persistRecord(DIRS.runtimeEvidence,resultId,prevalidateGovernedRecord(resultId,{artifactId:resultId,revision:1,payload,hash:hash(payload),immutable:true}));return {run,idempotent:false};
  }finally{await lock.close();await unlink(lockPath);}
}
