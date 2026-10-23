import path from 'node:path';
import {mkdir,open,unlink} from 'node:fs/promises';
import {DATA_ROOT,DIRS,currentRepositoryAuthority,listRecords,loadRecord,persistRecord,prevalidateGovernedRecord,nowIso} from '../routes/_shared.js';
import {userHasPermission} from '../routes/auth.js';
import {contentCanonicalHash as hash} from '../content/content-registry-authority.js';
import {resolveIofSource,assertIofScope} from './iof-package-repository.js';
import {openIofExport,createIofExport} from './iof-package-outputs.js';
import {ENRICHMENT_SCHEMA,ENRICHMENT_ACK,ENRICHMENT_PROVIDERS,enrichmentBranches,offlineObservations,compileEnrichment} from './iof-enrichment.js';
import {RICH_SCHEMA,RICH_INPUT,richObservations,compileRichEnrichment} from './iof-rich-enrichment.js';
import {RICH_SOURCE_SCHEMA} from './iof-kmz-rich-parser.js';
import {SPATIAL_INTEGRATION_POLICY,enrichmentObjectBindings,integratedEnrichment} from './iof-spatial-integration.js';
const options={projectRepositoryAuthority:false,readOnly:true};
const fail=(code,status=409)=>{throw Object.assign(new Error(code),{code,status});};
const collect=(sources,branches,rich)=>{const old=offlineObservations(sources,branches),r=rich?richObservations(sources):{observations:[],issues:[]};return {observations:[...old.observations,...r.observations],issues:[...old.issues,...r.issues]};};
const compile=args=>args.input?.schemaVersion===RICH_INPUT?compileRichEnrichment(args):compileEnrichment(args);

async function context(scope,exportId){
  const saved=await openIofExport(scope,exportId),sources=[];
  for(const ref of saved.snapshot.iofPackage.sourceReferences)sources.push({ref,record:await resolveIofSource(scope,saved.snapshot.context.opportunityId,ref)});
  // Resolve candidate evidence through the existing scoped immutable evidence authority.
  // Payload shape alone cannot authorize reading another customer's record.
  for(const record of await listRecords(DIRS.runtimeEvidence,options)){
    if(!['IOF-OFFLINE-FEATURE-EVIDENCE-V1',RICH_SOURCE_SCHEMA].includes(record.payload?.schemaVersion))continue;
    try{assertIofScope(scope,record,saved.snapshot.context.opportunityId);}catch{continue;}
    const ref={kind:'RUNTIME_EVIDENCE',id:record.artifactId,hash:hash(record)};
    if(!sources.some(s=>s.ref.kind===ref.kind&&s.ref.id===ref.id))sources.push({ref,record:await resolveIofSource(scope,saved.snapshot.context.opportunityId,ref)});
  }
  const branches=enrichmentBranches(saved.snapshot,sources),{observations,issues}=collect(sources,branches,true);
  return {saved,branches,observations,issues,sources};
}

function selectedEvidence(c,input){
  const keys=new Set(c.saved.snapshot.iofPackage.sourceReferences.map(hash));
  for(const selection of Array.isArray(input?.selections)?input.selections:[]){
    const observation=c.observations.find(o=>o.observationId===selection?.observationId);
    if(observation)keys.add(hash(observation.sourceReference));
  }
  const sources=c.sources.filter(s=>keys.has(hash(s.ref)));
  return {...collect(sources,c.branches,input?.schemaVersion===RICH_INPUT),sources};
}

function extendedArtifact(base,reference){
  const p=structuredClone(base.iofPackage);delete p.packageRevisionHash;
  p.enrichmentRevision=reference;
  if(!p.sourceReferences.some(r=>hash(r)===hash(reference.evidenceReference)))p.sourceReferences.push(reference.evidenceReference);
  p.sourceReferences.sort((a,b)=>`${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`));
  // Keep R3's exact financial/view operands unchanged. This extension is explicitly
  // referenced evidence, not a rewritten calibration or new physical inventory.
  p.sections.evidence={...p.sections.evidence,state:'REFERENCED_UNVALIDATED',references:[...p.sections.evidence.references,{kind:'RUNTIME_EVIDENCE',recordId:reference.evidenceReference.id,revisionId:reference.evidenceReference.id,hash:reference.evidenceReference.hash}],accepted:false};
  const iofPackage={...p,packageRevisionHash:hash(p)},basis={schemaVersion:'IOF-PLANNER-ARTIFACT-V2',context:base.context,iofPackage,unresolvedItems:base.unresolvedItems,authority:base.authority};
  const artifactHash=hash(basis);
  return {...basis,plannerArtifactId:`PLANNER-ARTIFACT-${base.context.environment==='DEMO'?'DEMO-':''}${artifactHash}`,artifactHash,canonicalSerialization:JSON.stringify(basis),status:'READY_FOR_SUBMISSION',revision:2,immutable:true};
}

async function resolveEnrichment(scope,saved){
  const reference=saved.snapshot.iofPackage.enrichmentRevision;if(!reference)return null;
  if(![ENRICHMENT_SCHEMA,RICH_SCHEMA].includes(reference.schemaVersion))fail('IOF_ENRICHMENT_SCHEMA_CONFLICT');
  const record=await resolveIofSource(scope,saved.snapshot.context.opportunityId,reference.evidenceReference),payload=record.payload;
  const base=await openIofExport(scope,reference.baseExportId);
  if(base.snapshot.artifactHash!==reference.baseArtifactHash||payload.baseExportId!==reference.baseExportId||payload.baseArtifactHash!==reference.baseArtifactHash||payload.basePackageRevisionHash!==base.snapshot.iofPackage.packageRevisionHash||hash(payload.revision)!==reference.revisionHash)fail('IOF_ENRICHMENT_BASE_CONFLICT');
  const sources=[];
  for(const ref of payload.sourceReferences)sources.push({ref,record:await resolveIofSource(scope,base.snapshot.context.opportunityId,ref)});
  const branches=enrichmentBranches(base.snapshot,sources),{observations,issues}=collect(sources,branches,reference.schemaVersion===RICH_SCHEMA);
  const replay=compile({artifact:base.snapshot,branches,observations,issues,sources,input:payload.revision.input,reviewEvidence:payload.revision.reviewEvidence});
  if(hash(replay)!==reference.revisionHash)fail('IOF_ENRICHMENT_REPLAY_CONFLICT');
  if(reference.integrationPolicy){
    integratedEnrichment(saved.snapshot);
    if(payload.integrationPolicy!==reference.integrationPolicy)fail('IOF_SPATIAL_INTEGRATION_POLICY_CONFLICT');
    if(hash(reference.snapshot)!==hash(replay)||hash(enrichmentObjectBindings(base.snapshot,replay))!==hash(reference.objectBindings)||['routes','objects','engineering'].some(key=>hash(base.snapshot.iofPackage.viewData[key])!==hash(saved.snapshot.iofPackage.viewData[key])))fail('IOF_SPATIAL_SOURCE_OR_ENGINEERING_CHANGE_DENIED');
  }else if(hash(extendedArtifact(base.snapshot,reference))!==hash(saved.snapshot))fail('IOF_ENRICHMENT_REPLAY_CONFLICT');
  return payload.revision;
}

export async function validateIntegratedEnrichmentLineage(scope,artifact){
  if(artifact.iofPackage.enrichmentRevision?.integrationPolicy)await resolveEnrichment(scope,{snapshot:artifact});
}

export async function enrichmentState(scope,exportId){
  const c=await context(scope,exportId),revision=await resolveEnrichment(scope,c.saved);
  return {schemaVersion:ENRICHMENT_SCHEMA,supportedSchemas:[ENRICHMENT_SCHEMA,RICH_SCHEMA],exportId,artifactHash:c.saved.snapshot.artifactHash,branches:c.branches,observations:c.observations,issues:c.issues,revision,providers:ENRICHMENT_PROVIDERS,acknowledgementText:ENRICHMENT_ACK,limitations:['NATIVE_LAYER1_REVISION_REQUIRED','NO_CUSTOMER_DISCLOSURE_OR_APPROVAL','R2_LOCAL_GEOMETRY_VALIDITY_AND_RESOURCE_LIMITS']};
}

export async function previewEnrichment(scope,exportId,input){
  const c=await context(scope,exportId),selected=selectedEvidence(c,input);
  return compile({artifact:c.saved.snapshot,branches:c.branches,observations:selected.observations,issues:selected.issues,sources:selected.sources,input,reviewEvidence:{status:'UNSAVED_PREVIEW',principalId:null,membershipId:null,sessionId:null,recordedAt:null}});
}

export async function saveEnrichment(scope,exportId,body,user){
  if(currentRepositoryAuthority().authorityClass!=='DEMO')fail('IOF_ENRICHMENT_FIRST_CHECKPOINT_DEMO_ONLY',403);
  if(!user?.principalId||!user.membershipId||!user.sessionId||!userHasPermission(user,'proposal.manage'))fail('IOF_ENRICHMENT_REVIEW_PERMISSION_REQUIRED',403);
  if(Object.keys(body).some(k=>!['expectedArtifactHash','input','requestId','acknowledgementText','integrationPolicy'].includes(k))||body.acknowledgementText!==ENRICHMENT_ACK||!/^[A-Za-z0-9_-]{8,128}$/.test(body.requestId||''))fail('IOF_ENRICHMENT_ACK_AND_REQUEST_REQUIRED',422);
  if(body.integrationPolicy!==undefined&&body.integrationPolicy!==SPATIAL_INTEGRATION_POLICY)fail('IOF_SPATIAL_INTEGRATION_POLICY_UNSUPPORTED',422);
  if(!body.input||Object.keys(body.input).some(k=>!(body.input.schemaVersion===RICH_INPUT?['schemaVersion','providerId','reason','selections','relationshipPolicy']:['providerId','reason','selections']).includes(k)))fail('IOF_ENRICHMENT_REFERENCE_ONLY_INPUT',422);
  const c=await context(scope,exportId);await resolveEnrichment(scope,c.saved);
  if(c.saved.snapshot.artifactHash!==body.expectedArtifactHash)fail('IOF_ENRICHMENT_STALE_ARTIFACT');
  if(body.integrationPolicy&&c.saved.snapshot.iofPackage.commercialStrategy)fail('IOF_SPATIAL_OPEN_SOURCE_BEFORE_COMMERCIAL_STRATEGY',409);
  if(!c.branches.length)fail('IOF_ENRICHMENT_NATIVE_BRANCH_REQUIRED',422);
  const commandHash=hash({exportId,expectedArtifactHash:body.expectedArtifactHash,input:body.input,...(body.integrationPolicy?{integrationPolicy:body.integrationPolicy}:{})}),repository=currentRepositoryAuthority();
  const id=`IOF-ENRICHMENT-${repository.authorityClass==='DEMO'?'DEMO-':''}${hash({accountId:scope.subjectAccountId,customerOrganizationId:scope.customerOrganizationId,opportunityId:c.saved.snapshot.context.opportunityId,principalId:user.principalId,requestId:body.requestId})}`;
  const dir=path.join(repository.dataRoot,path.relative(DATA_ROOT,DIRS.runtimeEvidence));await mkdir(dir,{recursive:true});const lockPath=path.join(dir,id+'.lock');let lock;
  try{lock=await open(lockPath,'wx');}catch(e){if(e.code==='EEXIST')fail('IOF_ENRICHMENT_BUSY_RETRY');throw e;}
  try{
    let record=await loadRecord(DIRS.runtimeEvidence,id,options).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
    if(record&&record.payload.commandHash!==commandHash)fail('IOF_ENRICHMENT_RETRY_CONTENT_CONFLICT');
    if(!record){
      const reviewEvidence={principalId:user.principalId,membershipId:user.membershipId,sessionId:user.sessionId,recordedAt:nowIso(),requestId:body.requestId,acknowledgementText:ENRICHMENT_ACK};
      const selected=selectedEvidence(c,body.input);
      const revision=compile({artifact:c.saved.snapshot,branches:c.branches,observations:selected.observations,issues:selected.issues,sources:selected.sources,input:body.input,reviewEvidence});
      const payload={schemaVersion:revision.schemaVersion,context:c.saved.snapshot.context,baseExportId:exportId,baseArtifactHash:body.expectedArtifactHash,basePackageRevisionHash:c.saved.snapshot.iofPackage.packageRevisionHash,commandHash,sourceReferences:selected.sources.map(s=>s.ref),revision,...(body.integrationPolicy?{integrationPolicy:body.integrationPolicy}:{})};
      record=prevalidateGovernedRecord(id,{artifactId:id,revision:1,payload,hash:hash(payload),immutable:true});
      await persistRecord(DIRS.runtimeEvidence,id,record);
    }
    const reference={schemaVersion:record.payload.revision.schemaVersion,baseExportId:exportId,baseArtifactHash:body.expectedArtifactHash,evidenceReference:{kind:'RUNTIME_EVIDENCE',id,hash:hash(record)},revisionHash:hash(record.payload.revision)};
    if(body.integrationPolicy)Object.assign(reference,{integrationPolicy:body.integrationPolicy,snapshot:record.payload.revision,objectBindings:enrichmentObjectBindings(c.saved.snapshot,record.payload.revision)});
    const artifact=extendedArtifact(c.saved.snapshot,reference),result=await createIofExport(scope,artifact);
    await resolveEnrichment(scope,result.record);
    return {...result.record,idempotent:result.idempotent};
  }finally{await lock.close();await unlink(lockPath);}
}
