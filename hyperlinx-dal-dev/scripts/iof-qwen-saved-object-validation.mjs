// Executive-authorized grounding correction. Offline only; no inference or business writes.
import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv from 'ajv';
import {researchError} from '../server/network-planning/iof-research-http.js';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {contentCanonicalHash as canonicalHash} from '../server/content/content-registry-authority.js';
import {verifyIofSource} from '../server/network-planning/iof-package-repository.js';
import {inferResearch} from '../server/network-planning/iof-research-provider.js';
import {FINANCIAL_AI_SCHEMA,validateFinancialFindings} from '../server/network-planning/iof-financial-enrichment-contract.js';
import {ACTIVE_LAYER1_CONSTRUCTION_DOCTRINE} from '../server/network-planning/layer1-product-doctrine.js';
const root=path.resolve(import.meta.dirname,'../..');
const rel='docs/checkpoints/iof-l40s-qwen-grounding-correction-implementation-20261020/';
const design='docs/checkpoints/iof-l40s-qwen-grounding-correction-design-20261020/';
const successful='docs/checkpoints/iof-l40s-qwen-second-controlled-inference-20261020/';
const lineage='docs/checkpoints/iof-l40s-qwen-first-live-inference-20261020/';
const previous='docs/checkpoints/iof-l40s-qwen-source-context-20261020/';
const discovery='docs/checkpoints/iof-l40s-qwen-integration-discovery/';
const script='hyperlinx-dal-dev/scripts/iof-qwen-saved-object-validation.mjs';
const read=p=>fs.readFile(path.join(root,p));
const get=async p=>JSON.parse(await read(p));
const sha=b=>createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'});
const write=(name,value)=>fs.writeFile(path.join(root,rel,name),typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});
async function walk(dir){const rows=[];for(const e of await fs.readdir(path.join(root,dir),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())rows.push(...await walk(p));else rows.push(p);}return rows;}
async function preserve(b,{handoff=false}={}){
 assert.equal(git('branch','--show-current').trim(),b.branch);assert.equal(git('rev-parse','HEAD').trim(),b.head);
 for(const[p,h]of Object.entries(b.pins)){if(handoff&&p==='docs/handoffs/CURRENT.md')continue;assert.equal(sha(await read(p)),h,p);}
 const actual={};for(const dir of b.businessRoots)for(const p of await walk(dir))actual[p]=sha(await read(p));
 const drift={changedOrDeleted:Object.keys(b.business).filter(p=>actual[p]!==b.business[p]),added:Object.keys(actual).filter(p=>!Object.hasOwn(b.business,p))};
 assert.ok(!drift.changedOrDeleted.length&&!drift.added.length,'BUSINESS_DRIFT '+JSON.stringify(drift));
 return {protectedPins:Object.keys(b.pins).length,originalBusinessFiles:225,separateAuthenticationActivities:2,totalBusinessFiles:Object.keys(actual).length,drift};
}
function validateSpine(branch,selection,inventoryHash){
 const w=selection.workContext;
 assert.ok(branch?.spine&&Array.isArray(branch.spine.segments)&&branch.spine.segments.length>0,'COMPLETE_SPINE_REQUIRED');
 assert.equal(branch.spineId,w.spineId,'SPINE_ID');assert.equal(branch.spine.spineId,w.spineId,'FULL_SPINE_ID');
 assert.equal(branch.spineRevisionHash,w.spineRevisionHash,'SPINE_REFERENCE_HASH');assert.equal(canonicalHash(branch.spine),w.spineRevisionHash,'FULL_SPINE_CONTENT_HASH');
 assert.equal(branch.routeId,w.routeId);assert.equal(branch.routeGeometryHash,w.geometryHash);assert.equal(canonicalHash(branch.geometry),w.geometryHash);
 assert.equal(branch.inventoryRevisionId,selection.object.inventoryScope.revision_id);assert.equal(branch.inventoryHash,inventoryHash);
 assert.deepEqual(branch.sourceRevision,selection.object.sources[0]);
 const {branchId,...basis}=branch;assert.equal(branchId,'IOF-BRANCH-'+canonicalHash(basis),'BRANCH_BINDING_HASH');
 assert.equal(branch.spine.segments.length,128,'SEGMENT_COUNT');
}
function validateConstruction(state,branch,saved,selection){
 const d=state.draft,w=selection.workContext,pkg=saved.snapshot.iofPackage;
 assert.equal(state.exportId,selection.sourceSnapshot.exportId);assert.equal(state.artifactHash,selection.sourceSnapshot.artifactHash);
 assert.equal(d.baseArtifactHash,selection.sourceSnapshot.artifactHash);assert.equal(d.basePackageRevisionHash,selection.sourceSnapshot.packageRevisionHash);
 const {draftHash,...draftBasis}=d;assert.equal(canonicalHash(draftBasis),draftHash,'FULL_DRAFT_HASH');
 assert.equal(d.engineeringApproved,false);assert.equal(d.constructionAuthorized,false);assert.equal(state.admitted,null);
 assert.equal(d.financialHash,canonicalHash(pkg.viewData.financialLines),'FINANCIAL_SOURCE_HASH_UNCHANGED');
 const expected=new Map(pkg.constructionAssemblyRevision.snapshot.assemblyBasis.quantityLedger.flatMap(l=>l.workRefs).map(r=>[r.workId,r]));
 assert.equal(expected.size,128);assert.equal(d.work.length,128);assert.equal(new Set(d.work.map(r=>r.workId)).size,128);
 for(const actual of d.work){const ref=expected.get(actual.workId);assert.ok(ref,'ORIGINAL_WORK_ID');for(const key of ['fromFeet','toFeet','geometryHash','spineId','spineRevisionHash','inventoryHash'])assert.equal(actual[key],ref[key],key);assert.deepEqual(actual.engineeringSource,ref.engineeringSource);assert.equal(actual.decision,'DEFER');assert.equal(actual.method,null);assert.equal(actual.methodEvidence,null);assert.equal(actual.conditionClassification,null);assert.equal(actual.constructionAccepted,false);assert.equal(actual.requiredMethod,'HDD');assert.ok(branch.spine.segments.some(s=>s.segmentId===actual.segmentId));}
 const work=d.work.find(r=>r.workId===w.workId);assert.ok(work);assert.equal(work.fromFeet,w.fromFeet);assert.equal(work.toFeet,w.toFeet);assert.equal(work.decision,w.decision);assert.equal(work.method,w.method);assert.ok(work.physicalObjectIds.includes(selection.object.physicalObjectId));assert.ok(work.fromFeet<=1000&&work.toFeet>=1000);
 const {bindingHash,...doctrineBasis}=ACTIVE_LAYER1_CONSTRUCTION_DOCTRINE;assert.equal(canonicalHash(doctrineBasis),bindingHash);
 const pinnedDoctrine=pkg.constructionAssemblyRevision.snapshot.assemblyBasis.authorities.construction;
 assert.equal(ACTIVE_LAYER1_CONSTRUCTION_DOCTRINE.bindingVersion,pinnedDoctrine.version);assert.equal(bindingHash,pinnedDoctrine.hash);
 assert.equal(state.constructionContexts.length,128);
 for(const context of state.constructionContexts){const {contextHash,...contextBasis}=context;assert.equal(canonicalHash(contextBasis),contextHash);assert.equal(context.engineeringApproved,false);assert.equal(context.constructionAuthorized,false);assert.equal(context.financialEffect,null);assert.equal(context.doctrineReference.hash,bindingHash);assert.equal(context.doctrineReference.version,pinnedDoctrine.version);for(const interval of context.intervals){assert.equal(interval.spineRevisionHash,w.spineRevisionHash);assert.equal(interval.requirement.ruleReference.hash,bindingHash);assert.equal(interval.requirement.ruleReference.version,pinnedDoctrine.version);const rule=ACTIVE_LAYER1_CONSTRUCTION_DOCTRINE.constructionRules.find(r=>r.ruleId===interval.requirement.ruleReference.ruleId);assert.ok(rule);assert.equal(interval.requirement.requiredMethod,rule.requiredMethod);assert.equal(interval.requirement.constructionAccepted,false);assert.equal(interval.profile.engineeringApproved,false);assert.equal(interval.profile.requiresEngineeringReview,true);assert.equal(interval.profile.conditionClassification,null);}}
 const context=state.constructionContexts.find(r=>r.parentWorkId===work.workId);assert.ok(context);assert.ok(context.intervals.some(i=>i.fromFeet<=1000&&i.toFeet>=1000));
 return {work,context,decisionCount:128,workIdentityHash:canonicalHash(d.work.map(r=>({workId:r.workId,decision:r.decision,method:r.method,conditionClassification:r.conditionClassification,fromFeet:r.fromFeet,toFeet:r.toFeet,spineRevisionHash:r.spineRevisionHash}))),doctrine:{version:pinnedDoctrine.version,hash:bindingHash,canonicalGovernedSource:'server/network-planning/layer1-product-doctrine.js',fullPolicyContentHashVerified:true,apiDoctrineProjectionVerified:true},authority:{engineeringApproved:false,constructionAuthorized:false,acceptedWorkCount:0,reviewedMethodCount:0,financialEffect:null}};
}
function attemptSchema(context){
 // Match the existing contract's documented JSON-copy method. structuredClone
 // retains shared leaves and corrupted the historical harness schema enums.
 const schema=JSON.parse(JSON.stringify(FINANCIAL_AI_SCHEMA)),p=schema.properties.findings.items.properties;
 p.objectId.enum=[context.objectId];p.sourceIds.items.enum=context.evidence.map(e=>e.sourceId);p.sourceIds.minItems=1;p.sourceIds.maxItems=12;p.humanReviewRequirements.minItems=1;p.humanReviewRequirements.maxItems=10;p.assumptions.maxItems=10;p.costImpactLowUsd={type:'null'};p.costImpactHighUsd={type:'null'};p.scopeImpact={type:'string',const:'UNRESOLVED'};schema.properties.findings.maxItems=4;schema.properties.qualifications.maxItems=30;
 assert.deepEqual(p.objectId.enum,[context.objectId]);assert.equal(p.text.enum,undefined);assert.equal(schema.properties.qualifications.items.enum,undefined);assert.equal(p.humanReviewRequirements.items.enum,undefined);
 return schema;
}

async function systemPrompt(){
 // Approved instruction successor; READ_CONTEXT and shared schemas stay intact.
 return (await read(design+'PROPOSED_SYSTEM_PROMPT.txt')).toString().replace(
  'Both cost impact fields MUST be null.',
  'No cost authority is supplied; costs cannot be estimated. Both cost impact fields MUST be null.');
}
function sourceQualifications(context){
 const ref=id=>context.references.find(r=>r.sourceId===id);
 const work=ref('WORK')?.value,doctrine=ref('DOCTRINE')?.value;
 assert.equal(work?.decision,'DEFER');assert.equal(work.method,null);assert.equal(work.requiredMethod,'HDD');
 assert.equal(work.conditionClassification,null);assert.equal(doctrine?.profile.engineeringApproved,false);
 assert.equal(doctrine.profile.requiresEngineeringReview,true);assert.equal(context.authority.costAssignment,false);
 assert.ok(context.unavailable.includes('NO_INTEGRATED_FIELD_VERIFICATION'));
 assert.ok(context.unavailable.includes('NO_APPROVED_GEOLOGY_OR_REVIEWED_METHOD'));
 assert.ok(context.unavailable.includes('NO_ENGINEERING_RELEASE_OR_COST_AUTHORITY'));
 const workPath='/references/'+context.references.findIndex(r=>r.sourceId==='WORK')+'/value',doctrinePath='/references/'+context.references.findIndex(r=>r.sourceId==='DOCTRINE')+'/value';
 const rows=[
  ['DEFER is a valid unresolved Engineering decision. Missing review does not invalidate DEFER.',['WORK'],[workPath+'/decision',workPath+'/method']],
  ['Required HDD is not an approved or reviewed construction method; approval remains absent.',['WORK','DOCTRINE'],[workPath+'/requiredMethod',doctrinePath+'/profile/engineeringApproved']],
  ['Scope impact is UNRESOLVED; no source-supported assessed impact is supplied.',['WORK','DOCTRINE'],[workPath+'/method',doctrinePath+'/requirement/engineeringFeasibility']],
  ['Geology is unverified and field verification is unavailable. Planning evidence is not Engineering approval.',['WORK','DOCTRINE'],[workPath+'/conditionClassification',doctrinePath+'/profile/engineeringApproved','/unavailable']],
  ['No cost authority is supplied. Monetary impacts remain null; this advisory proof assigns no price.',['WORK','DOCTRINE'],['/authority/costAssignment','/unavailable']]
 ];
 return rows.map(([text,sourceIds,contentPaths])=>({text,sourceIds,contentPaths,contextHash:canonicalHash(context),sourceBindings:sourceIds.map(id=>({sourceId:id,excerptHash:ref(id).excerptHash})),verification:'CPU_SOURCE_BOUND_DISCLOSURE_NOT_MODEL_OUTPUT',authority:'NON_AUTHORITATIVE_NO_STATE_TRANSITION'}));
}
function candidateEnvelope(value,context,rawResponseHash,{rejections=[]}={}){
 const schema=attemptSchema(context),validate=new Ajv({allErrors:true}).compile(schema);
 const qualifications=sourceQualifications(context),contextHash=canonicalHash(context);
 assert.match(rawResponseHash,/^[a-f0-9]{64}$/);
 // Negative source-review dispositions can quarantine whole candidates only.
 // There is deliberately no positive/automatic acceptance command or registry.
 for(const rejection of rejections){
  assert.equal(rejection.rawResponseHash,rawResponseHash,'REVIEW_RESPONSE_BINDING');
  assert.equal(rejection.contextHash,contextHash,'REVIEW_CONTEXT_BINDING');
  assert.ok(value?.findings?.some(f=>canonicalHash(f)===rejection.candidateHash),'REVIEW_CANDIDATE_BINDING');
  assert.ok(Array.isArray(rejection.unsupportedAssertions)&&rejection.unsupportedAssertions.length,'REJECTION_REQUIRES_ASSERTION');
  assert.ok(rejection.unsupportedAssertions.every(a=>typeof a.text==='string'&&a.text.trim()&&typeof a.reason==='string'&&a.reason.trim()),'REJECTION_REQUIRES_REASON');
 }
 const wholeShapeOk=validate(value),wholeErrors=structuredClone(validate.errors||[]);
 const rootErrors=wholeErrors.filter(e=>!/^\.findings\[\d+\]/.test(e.dataPath));
 const candidates=(Array.isArray(value?.findings)?value.findings:[]).map((finding,index)=>{
  const shapeOk=validate({findings:[finding],qualifications:value.qualifications});
  const errors=structuredClone(validate.errors||[]);let objectValidation='NOT_RUN';
  if(shapeOk&&!rootErrors.length){try{validateFinancialFindings({findings:[finding],qualifications:value.qualifications},context.evidence,[context.references.find(r=>r.sourceId==='OBJECT').value]);objectValidation='PASS';}catch(e){objectValidation=e.code||'FAIL';}}
  const rejection=rejections.find(r=>r.candidateHash===canonicalHash(finding));
  const rejected=!shapeOk||rootErrors.length||objectValidation!=='PASS'||Boolean(rejection);
  return {index,candidateHash:canonicalHash(finding),candidate:finding,disposition:rejected?'REJECTED_ENTIRE_FINDING':'PENDING_MATERIAL_ASSERTION_REVIEW',schema:shapeOk&&!rootErrors.length?'PASS':'FAIL',schemaErrors:[...rootErrors,...errors],objectValidation,unsupportedAssertions:rejection?.unsupportedAssertions||[],acceptance:'NOT_ACCEPTED',businessAuthority:false};
 });
 return {schemaVersion:'IOF-STANDALONE-CANDIDATE-REVIEW-V1',rawResponseHash,contextHash,objectId:context.objectId,schemaValidation:wholeShapeOk?'PASS':'FAIL',schemaErrors:wholeErrors,modelOutput:value,modelQualifications:value?.qualifications??null,deterministicQualifications:qualifications,candidates,acceptedFindings:[],rejectedFindingCount:candidates.filter(c=>c.disposition==='REJECTED_ENTIRE_FINDING').length,pendingFindingCount:candidates.filter(c=>c.disposition==='PENDING_MATERIAL_ASSERTION_REVIEW').length,semanticValidation:'NOT_AUTOMATICALLY_PROVEN',authority:{nonAuthoritative:true,humanReviewRequired:true,businessWrites:false,engineeringApproval:false,mutatesSpine:false,costAssignment:false},result:wholeShapeOk&&candidates.some(c=>c.disposition==='PENDING_MATERIAL_ASSERTION_REVIEW')?'PARTIAL':'FAIL'};
}
async function captureAndEvaluate(name,bytes,context,review){
 // Exact bytes are archived exclusively before JSON/schema/object validation.
 await write(name+'.RAW_RESPONSE.json',bytes);
 const rawResponseHash=sha(bytes);let raw;
 try{raw=JSON.parse(bytes.toString());}catch{const envelope={result:'FAIL',failure:'RAW_RESPONSE_INVALID_JSON',rawResponseHash,deterministicQualifications:sourceQualifications(context),acceptedFindings:[]};await write(name+'.ENVELOPE.json',envelope);return envelope;}
 let value;try{value=JSON.parse(raw.choices?.[0]?.message?.content);}catch{const envelope={result:'FAIL',failure:'MODEL_CONTENT_INVALID_JSON',rawResponseHash,deterministicQualifications:sourceQualifications(context),acceptedFindings:[]};await write(name+'.ENVELOPE.json',envelope);return envelope;}
 const envelope=candidateEnvelope(value,context,rawResponseHash,review);
 await write(name+'.CANDIDATES.json',value);await write(name+'.ENVELOPE.json',envelope);return envelope;
}
async function verifiedContext(){
 const context=await get(previous+'READ_CONTEXT.json'),coverage=await get(previous+'COVERAGE.json'),selection=await get(discovery+'OBJECT_SELECTION.json');
 assert.equal(canonicalHash(context),coverage.contextHash);assert.equal(context.objectId,selection.object.physicalObjectId);
 assert.equal(context.packageRevisionHash,selection.sourceSnapshot.packageRevisionHash);assert.equal(context.artifactHash,selection.sourceSnapshot.artifactHash);
 for(const e of context.evidence){assert.equal(sha(await read(e.responseFile)),e.responseHash);const ref=context.references.find(r=>r.sourceId===e.sourceId);assert.equal(canonicalHash(ref.value),e.sha256);assert.equal(ref.excerptHash,e.sha256);}
 const saved=await get('docs/checkpoints/iof-l40s-qwen-harness-correction-20261020/AUTHENTICATED_EXPORT.json'),enrichment=await get(previous+'ENRICHMENT_RESPONSE.json'),construction=await get(previous+'CONSTRUCTION_RESPONSE.json');verifyIofSource('ARTIFACT',saved.snapshot);
 const branch=enrichment.branches.find(b=>b.spineId===selection.workContext.spineId),inventory=saved.snapshot.iofPackage.viewData.engineering.find(e=>e.inventoryRevision===selection.object.inventoryScope.revision_id);
 validateSpine(branch,selection,inventory.calculationHash);const proof=validateConstruction(construction,branch,saved,selection);
 assert.deepEqual(context.references.find(r=>r.sourceId==='OBJECT').value,saved.snapshot.iofPackage.viewData.objects.find(o=>o.physicalObjectId===context.objectId));
 sourceQualifications(context);return {context,proof,contextByteHash:sha(await read(previous+'READ_CONTEXT.json'))};
}
async function selfTests(label='SELF_TEST'){
 assert.match(label,/^[A-Z0-9_]+$/);const testPrefix=label==='SELF_TEST'?'':label+'_';
 const {context,proof}=await verifiedContext(),actual=await get(successful+'FINDINGS.json'),raw=await read(successful+'RAW_RESPONSE.json'),rawHash=sha(raw),tests=[];
 const run=async(name,f)=>{await f();tests.push({name,result:'PASS'});};
 const schema=attemptSchema(context),valid=new Ajv({allErrors:true}).compile(schema);
 const fixture=()=>{const x=JSON.parse(JSON.stringify(actual));x.findings[0].text='DEFER is valid while unresolved. Required HDD is not approved HDD; Engineering review remains required.';x.findings[0].scopeImpact='UNRESOLVED';x.findings[0].assumptions=[];return x;};
 const reject=(value,text)=>({rejections:[{rawResponseHash:rawHash,contextHash:canonicalHash(context),candidateHash:canonicalHash(value.findings[0]),unsupportedAssertions:[{text,reason:'Isolated fixture: not supported by pinned WORK/DOCTRINE.'}]}]});
 await run('FULL_SPINE_DOCTRINE_ALL_128_DEFER_REVALIDATED',()=>assert.equal(proof.decisionCount,128));
 await run('SCOPE_SCHEMA_EQUALS_APPROVED_DESIGN',async()=>assert.deepEqual(schema,await get(design+'PROPOSED_RESPONSE_SCHEMA.json')));
 await run('SUPPORTED_HDD_DEFER_STAYS_PENDING',()=>{const e=candidateEnvelope(fixture(),context,rawHash);assert.equal(e.pendingFindingCount,1);assert.equal(e.acceptedFindings.length,0);});
 await run('ACTUAL_MODERATE_REJECTS_WHOLE_FINDING',()=>{const e=candidateEnvelope(actual,context,rawHash);assert.equal(e.rejectedFindingCount,1);assert.deepEqual(e.candidates[0].candidate,actual.findings[0]);});
 await run('DEFER_VALIDITY_PROSE_REQUIRES_REVIEW_NOT_SCHEMA_ACCEPTANCE',()=>{const x=fixture();x.findings[0].text=actual.findings[0].text;const e=candidateEnvelope(x,context,rawHash);assert.equal(e.pendingFindingCount,1);assert.equal(e.acceptedFindings.length,0);});
 await run('UNSUPPORTED_DEFER_ASSERTION_REJECTS_ENTIRE_FINDING',()=>{const x=fixture();x.findings[0].text=actual.findings[0].text;const e=candidateEnvelope(x,context,rawHash,reject(x,'DEFER validity speculation'));assert.equal(e.rejectedFindingCount,1);assert.deepEqual(e.candidates[0].candidate,x.findings[0]);assert.equal(e.acceptedFindings.length,0);});
 await run('ONE_BAD_ASSERTION_REJECTS_SUPPORTED_FRAGMENTS_TOO',()=>{const x=fixture();const e=candidateEnvelope(x,context,rawHash,reject(x,'One unsupported material assertion'));assert.equal(e.candidates[0].disposition,'REJECTED_ENTIRE_FINDING');assert.equal(e.pendingFindingCount,0);});
 await run('MIXED_BATCH_REJECTS_ONLY_AFFECTED_CANDIDATE_OTHERS_PENDING',()=>{const x=fixture();x.findings.push({...x.findings[0],text:'Distinct advisory candidate for Engineering review.'});const e=candidateEnvelope(x,context,rawHash,reject(x,'Unsupported first candidate'));assert.equal(e.rejectedFindingCount,1);assert.equal(e.pendingFindingCount,1);assert.deepEqual(e.acceptedFindings,[]);});
 for(const [name,mutate]of [['WRONG_OBJECT_REJECTED',x=>x.findings[0].objectId='invented'],['UNKNOWN_SOURCE_REJECTED',x=>x.findings[0].sourceIds=['invented']],['FINANCIAL_AMOUNT_REJECTED',x=>x.findings[0].costImpactLowUsd=18],['NULL_IMPACT_REJECTED',x=>x.findings[0].scopeImpact=null]])await run(name,()=>{const x=fixture();mutate(x);assert.equal(valid(x),false);assert.equal(candidateEnvelope(x,context,rawHash).rejectedFindingCount,1);});
 await run('MISSING_GEOLOGY_FIELD_AND_COST_DISCLOSURES_ADDED_OUTSIDE_OUTPUT',()=>{const x=fixture(),before=JSON.stringify(x),e=candidateEnvelope(x,context,rawHash);assert.equal(JSON.stringify(x),before);assert.equal(e.modelQualifications.length,0);assert.equal(e.deterministicQualifications.length,5);assert.ok(e.deterministicQualifications.some(q=>q.text.includes('Geology is unverified')));assert.ok(e.deterministicQualifications.some(q=>q.text.includes('No cost authority')));});
 await run('QUALIFICATIONS_TIED_TO_EXACT_CONTEXT_AND_EXCERPTS',()=>{for(const q of sourceQualifications(context)){assert.equal(q.contextHash,canonicalHash(context));for(const b of q.sourceBindings)assert.equal(b.excerptHash,context.references.find(r=>r.sourceId===b.sourceId).excerptHash);}});
 await run('DISCLOSURE_CONTENT_POINTERS_RESOLVE_IN_PINNED_CONTEXT',()=>{for(const q of sourceQualifications(context))for(const pointer of q.contentPaths){const value=pointer.slice(1).split('/').reduce((node,key)=>node?.[key],context);assert.notEqual(value,undefined,pointer);}});
 await run('CHANGED_AUTHORITY_FAILS_CLOSED',()=>{const x=JSON.parse(JSON.stringify(context));x.authority.costAssignment=true;assert.throws(()=>sourceQualifications(x));});
 for(const field of ['rawResponseHash','contextHash','candidateHash'])await run('TAMPERED_REVIEW_'+field.toUpperCase()+'_REJECTED',()=>{const x=fixture(),r=reject(x,'Invalid assertion');r.rejections[0][field]='0'.repeat(64);assert.throws(()=>candidateEnvelope(x,context,rawHash,r));});
 await run('NO_ACCEPT_ROUTE_FROM_REJECTION_METADATA',()=>{const e=candidateEnvelope(fixture(),context,rawHash,{accept:true});assert.deepEqual(e.acceptedFindings,[]);assert.equal(e.pendingFindingCount,1);});
 await run('FABRICATED_GEOLOGY_NEVER_AUTOMATICALLY_ACCEPTED',()=>{const x=fixture();x.findings[0].text='Verified rock geology and approved HDD.';const e=candidateEnvelope(x,context,rawHash);assert.equal(e.pendingFindingCount,1);assert.deepEqual(e.acceptedFindings,[]);});
 await run('PROMPT_CONTAINS_ALL_APPROVED_STATE_AND_DISCLOSURE_RULES',async()=>{const p=await systemPrompt();for(const t of ['DEFER is a valid unresolved Engineering decision','Missing review does not invalidate DEFER','A required method is not an approved method','scopeImpact MUST be UNRESOLVED','Missing geology and field verification must be disclosed','No cost authority is supplied'])assert.ok(p.includes(t));});
 await run('RAW_ARCHIVED_BEFORE_INVALID_JSON_VALIDATION',async()=>{const bytes=Buffer.from('Isolated invalid JSON fixture, never live output'),name=testPrefix+'FIXTURE_INVALID_RAW';const e=await captureAndEvaluate(name,bytes,context);assert.equal(e.result,'FAIL');assert.equal(e.deterministicQualifications.length,5);assert.deepEqual(await read(rel+name+'.RAW_RESPONSE.json'),bytes);});
 await run('RAW_ARCHIVED_BEFORE_INVALID_MODEL_CONTENT_VALIDATION',async()=>{const bytes=Buffer.from(JSON.stringify({choices:[{message:{content:'isolated invalid JSON'}}]})),name=testPrefix+'FIXTURE_INVALID_CONTENT';const e=await captureAndEvaluate(name,bytes,context);assert.equal(e.failure,'MODEL_CONTENT_INVALID_JSON');assert.deepEqual(await read(rel+name+'.RAW_RESPONSE.json'),bytes);});
 await run('PRIOR_SUCCESSFUL_RAW_RESPONSE_BYTES_UNCHANGED',async()=>assert.equal(sha(await read(successful+'RAW_RESPONSE.json')),rawHash));
 await run('LIVE_MODE_REFUSED_WITHOUT_NETWORK',()=>{let failure;try{execFileSync(process.execPath,[path.join(root,script),'--live'],{cwd:root,stdio:'pipe'});}catch(e){failure=e;}assert.ok(failure);assert.match(failure.stderr.toString(),/RESEARCH_OFFLINE_ONLY_NO_LIVE_AUTHORIZATION/);});
 await run('TRANSIENT_FAILURE_NOT_RETRIED',async()=>{let wire=0;await assert.rejects(inferResearch({endpoint:'http://fixture.invalid/v1',model:'fixture',providerId:'L40S',tokenParameter:'max_tokens'},[],[],{onAttempt:(_p,attempt)=>assert.equal(attempt,0),http:async()=>{wire++;throw researchError('RESEARCH_SINGLE_ATTEMPT_HTTP_503');}}),{code:'RESEARCH_SINGLE_ATTEMPT_HTTP_503'});assert.equal(wire,1);});
 await write(label+'.json',{result:'PASS',isolatedFixtures:true,networkRequests:0,syntheticResponseUsedAsLiveEvidence:false,tests});return tests.length;
}

const mode=process.argv[2]||'--offline';
// Consumed historical authorizations cannot unlock a successor inference.
if(!['--offline','--self-test','--verify'].includes(mode))throw researchError('RESEARCH_OFFLINE_ONLY_NO_LIVE_AUTHORIZATION');
const baseline=await get(rel+'BASELINE.json');
if(mode==='--verify'){
 const f=await get(rel+'FINAL_STATE.json'),pins={...baseline.pins};delete pins[script];const p=await preserve({...baseline,pins},{handoff:true});
 assert.equal(sha(await read(script)),f.scriptHash);assert.equal(sha(await read('docs/handoffs/CURRENT.md')),f.currentHash);
 assert.equal(sha(await read(rel+'VALIDATION_SCRIPT.preimage.txt')),baseline.pins[script]);
 for(const [file,hash]of Object.entries(f.artifacts))assert.equal(sha(await read(file)),hash,file);
 assert.equal(f.newInferenceRequests,0);assert.equal(f.businessWrites,0);console.log(JSON.stringify({...p,preservation:'PASS',implementation:f.status,inferenceRequests:0}));
}else{
 // Only this approved script successor may differ from the entry baseline.
 const pins={...baseline.pins};delete pins[script];await preserve({...baseline,pins});
 if(mode==='--self-test'){console.log(JSON.stringify({result:'PASS',tests:await selfTests(process.argv[3]),networkRequests:0}));}
 else{
  const replay=process.argv[3]||'HISTORICAL_REPLAY';assert.match(replay,/^[A-Z0-9_]+$/);const prefix=replay==='HISTORICAL_REPLAY'?'':replay+'_';
  const {context,proof,contextByteHash}=await verifiedContext(),bytes=await read(successful+'RAW_RESPONSE.json');
  const envelope=await captureAndEvaluate(replay,bytes,context);
  await write(prefix+'RESPONSE_SCHEMA.json',attemptSchema(context));await write(prefix+'SYSTEM_PROMPT.txt',await systemPrompt());
  await write(prefix+'EXECUTION.json',{mode:'OFFLINE_HISTORICAL_RESPONSE_REVALIDATION',result:envelope.result,completionRequests:0,modelListRequests:0,metricsRequests:0,openaiRequests:0,businessWrites:0,contextHash:canonicalHash(context),contextByteHash,rawResponseHash:sha(bytes),decisionCount:proof.decisionCount,doctrine:proof.doctrine,candidateDispositions:envelope.candidates.map(c=>c.disposition),acceptedFindings:[],semanticValidation:'NOT_AUTOMATICALLY_PROVEN',preservation:await preserve({...baseline,pins})});
  console.log(JSON.stringify({offlineReplay:'PASS',historicalCandidate:envelope.result,rejected:envelope.rejectedFindingCount,accepted:0,inferenceRequests:0}));
 }
}
