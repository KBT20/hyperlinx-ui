import { DIRS, listRecords, loadRecord, currentRepositoryAuthority } from '../routes/_shared.js';
import { contentCanonicalHash as hash } from '../content/content-registry-authority.js';
import { buildPhysicalSolutionManifests } from './physical-solution-manifest-authority.js';
import { assertLayer1InventoryBinding } from './layer1-inventory-objects.js';
import { iofProductCoverage } from './iof-product-coverage.js';
import { IOF_PACKAGE_DOMAINS } from './planner-artifact-iof-package.js';
import { LAYER1_PLANNER_DOCTRINE } from './layer1-product-doctrine.js';
const options={projectRepositoryAuthority:false,readOnly:true};
const fail=(code,status=409)=>{throw Object.assign(new Error(code),{code,status});};
export const IOF_SOURCES={ARTIFACT:DIRS.plannerArtifacts,PRODUCT_PLAN:DIRS.customerProductPlanRevisions,NETWORK_REVISION:DIRS.networkPlanRevisions,PORTFOLIO_REVISION:DIRS.portfolioPlanningRevisions,COMMERCIAL_REVISION:DIRS.commercialRevisions,RUNTIME_EVIDENCE:DIRS.runtimeEvidence};
const idFor=(kind,r)=>kind==='ARTIFACT'?r.plannerArtifactId:kind==='PRODUCT_PLAN'?r.productPlanRevisionId:kind==='NETWORK_REVISION'?r.planRevisionId:kind==='COMMERCIAL_REVISION'?r.commercialRevisionId||r.revisionId:kind==='RUNTIME_EVIDENCE'?r.artifactId:r.portfolioPlanningRevisionId;
const digestFor=(kind,r)=>kind==='ARTIFACT'?r.artifactHash:kind==='PORTFOLIO_REVISION'?r.portfolioRevisionHash:['COMMERCIAL_REVISION','RUNTIME_EVIDENCE'].includes(kind)?hash(r):r.planRevisionHash;
const contextFor=r=>r.context||r.payload?.context||r.payload||r;
export function assertIofScope(scope,r,opportunityId){
  const c=contextFor(r),account=c.accountId||c.customerAccountId,opportunity=c.opportunityId||c.customerPlanningOpportunityId;
  if(!scope?.subjectAccountId||!scope.customerId||!scope.customerOrganizationId||account!==scope.subjectAccountId||c.customerOrganizationId!==scope.customerOrganizationId||c.customerId!==scope.customerId||!opportunity||opportunity!==opportunityId)fail('IOF_RESOURCE_NOT_FOUND',404);
  const lineage=JSON.stringify([c,r.sourceLineage||[],r.normalizedInputReferences||[],r.planningIntent||{},r.siteSet||{},r.exactInputs||{}]);
  if(/fluidstack/i.test(lineage))fail('IOF_LEGACY_PROJECT_EXCLUDED',422);
}
export function verifyIofSource(kind,r){
  if(!r||!idFor(kind,r)||!/^[a-f0-9]{64}$/.test(digestFor(kind,r)||''))fail('IOF_REVISION_IDENTITY_REQUIRED');
  if(kind==='RUNTIME_EVIDENCE'){
    if(!r.revision||!r.payload||r.hash!==hash(r.payload))fail('IOF_EVIDENCE_REVISION_HASH_CONFLICT');
  }else if(kind==='COMMERCIAL_REVISION'){
    // Commercial Revision is a reference-only record, not a financial operand store.
    // Bind its full content hash plus recorded engine revision hash; do not certify
    // its projected economics without the separate accepted replay authority.
    if(!r.revisionHash||!r.referenceOnly||!r.repositoryTruthImmutable)fail('IOF_COMMERCIAL_REFERENCE_INTEGRITY_REQUIRED');
  }else if(kind==='ARTIFACT'){
    if(!['CIP-116-PLANNER-ARTIFACT-V1','CIP-P05-PORTFOLIO-PLANNER-ARTIFACT-V1','IOF-PLANNER-ARTIFACT-V2'].includes(r.schemaVersion))fail('IOF_ARTIFACT_SCHEMA_UNSUPPORTED',422);
    if(r.canonicalSerialization){
      let basis;try{basis=JSON.parse(r.canonicalSerialization);}catch{fail('IOF_ARTIFACT_CANONICAL_INVALID');}
      if(hash(basis)!==r.artifactHash||Object.keys(basis).some(k=>hash(basis[k])!==hash(r[k])))fail('IOF_ARTIFACT_HASH_CONFLICT');
    }else if(r.schemaVersion==='CIP-P05-PORTFOLIO-PLANNER-ARTIFACT-V1'){
      const {plannerArtifactId,artifactHash,submittedArtifactHash,...basis}=r;
      if(hash({...basis,submissionEvidence:{...basis.submissionEvidence,submittedAt:null}})!==artifactHash)fail('IOF_ARTIFACT_HASH_CONFLICT');
    }else fail('IOF_ARTIFACT_SCHEMA_UNSUPPORTED',422);
    if(r.status==='SUBMITTED_TO_COMMERCIAL_PLANNING'&&hash({plannerArtifactId:r.plannerArtifactId,artifactHash:r.artifactHash,submissionEvidence:r.submissionEvidence})!==r.submittedArtifactHash)fail('IOF_SUBMISSION_HASH_CONFLICT');
    if(r.iofPackage){const {packageRevisionHash,...basis}=r.iofPackage;if(hash(basis)!==packageRevisionHash)fail('IOF_PACKAGE_HASH_CONFLICT');}
  }else{
    const basis={...r};delete basis[kind==='PORTFOLIO_REVISION'?'portfolioRevisionHash':'planRevisionHash'];
    if(kind==='PRODUCT_PLAN')delete basis.productPlanRevisionId;
    if(hash(basis)!==digestFor(kind,r)||r.immutable!==true)fail('IOF_REVISION_HASH_CONFLICT');
  }
  return r;
}
async function assertSourceScope(scope,kind,record,opportunityId){
  if(kind==='COMMERCIAL_REVISION'){
    const planning=await loadRecord(DIRS.plannerVnextOpportunities,opportunityId,options);
    if(planning.plannerAccountId!==scope.subjectAccountId||!planning.canonicalOpportunityId||record.opportunityId!==planning.canonicalOpportunityId)fail('IOF_RESOURCE_NOT_FOUND',404);
    const canonical=await loadRecord(DIRS.commercialOpportunities,record.opportunityId,options),account=await loadRecord(DIRS.accounts,canonical.accountId,options);
    if(canonical.customerId!==scope.customerId||account.customerId!==scope.customerId||account.customerOrganizationId!==scope.customerOrganizationId||canonical.planningPromotionLineage?.planningAccountId!==scope.subjectAccountId||canonical.planningPromotionLineage?.planningOpportunityId!==opportunityId)fail('IOF_RESOURCE_NOT_FOUND',404);
    return;
  }
  if(kind!=='PORTFOLIO_REVISION'||record.customerOrganizationId)return assertIofScope(scope,record,opportunityId);
  // Historical portfolio schema omits tenant. Prove it through its exact persisted
  // source network revision, never fill it from the requesting actor alone.
  if(record.accountId!==scope.subjectAccountId||record.customerId!==scope.customerId||record.opportunityId!==opportunityId||!record.sourceNetworkPlanRevisionId)fail('IOF_RESOURCE_NOT_FOUND',404);
  const parent=await loadRecord(DIRS.networkPlanRevisions,record.sourceNetworkPlanRevisionId,options);
  assertIofScope(scope,parent,opportunityId);verifyIofSource('NETWORK_REVISION',parent);
  if(parent.planRevisionHash!==record.sourceNetworkPlanRevisionHash)fail('IOF_PORTFOLIO_PARENT_HASH_CONFLICT');
}
export async function resolveIofSource(scope,opportunityId,ref){
  if(!ref||!Object.hasOwn(IOF_SOURCES,ref.kind)||typeof ref.id!=='string'||!ref.id||!/^[a-f0-9]{64}$/.test(ref.hash||''))fail('IOF_EXACT_SOURCE_REQUIRED',422);
  const record=await loadRecord(IOF_SOURCES[ref.kind],ref.id,options).catch(e=>{if(e.code==='ENOENT')fail('IOF_RESOURCE_NOT_FOUND',404);throw e;});
  await assertSourceScope(scope,ref.kind,record,opportunityId);verifyIofSource(ref.kind,record);
  if(idFor(ref.kind,record)!==ref.id||digestFor(ref.kind,record)!==ref.hash)fail('IOF_STALE_SOURCE_HASH');
  return record;
}
export async function iofDirectory(scope,opportunityId){
  if(!opportunityId)fail('IOF_OPPORTUNITY_REQUIRED',422);
  const sources=[],exceptions=[],coverage=iofProductCoverage(await listRecords(DIRS.products,options));
  const supported=new Set([...coverage.planner.map(p=>p.productId),...coverage.commercial.filter(p=>p.doctrine).map(p=>p.productId)]);
  for(const [kind,dir] of Object.entries(IOF_SOURCES))for(const r of await listRecords(dir,options)){
    try{await assertSourceScope(scope,kind,r,opportunityId);}catch{continue;}
    try{verifyIofSource(kind,r);if(!['COMMERCIAL_REVISION','RUNTIME_EVIDENCE'].includes(kind)&&!supported.has(contextFor(r).productId))fail('IOF_PRODUCT_DOCTRINE_UNSUPPORTED',422);sources.push({kind,id:idFor(kind,r),hash:digestFor(kind,r),productId:contextFor(r).productId,createdAt:r.recordedAt||r.submittedAt||null});}
    catch(e){exceptions.push({kind,id:idFor(kind,r),error:e.code||e.message});}
  }
  return {sources,exceptions,coverage};
}
function addExact(map,key,value,source){
  if(!key)fail('IOF_OBJECT_ID_REQUIRED');
  const existing=map.get(key),fingerprint=hash(value);
  if(existing&&existing.valueHash!==fingerprint)fail('IOF_SHARED_ID_CONFLICT');
  if(existing){if(!existing.sources.some(s=>hash(s)===hash(source)))existing.sources.push(source);}
  else map.set(key,{...structuredClone(value),valueHash:fingerprint,sources:[source]});
}
export async function assembleIofSnapshot(scope,opportunityId,references){
  if(!Array.isArray(references)||!references.length||references.length>40)fail('IOF_SOURCES_REQUIRED',422);
  if(references.some(r=>!r||typeof r!=='object'||!Object.hasOwn(IOF_SOURCES,r.kind)||typeof r.id!=='string'||!r.id||!/^[a-f0-9]{64}$/.test(r.hash||'')))fail('IOF_EXACT_SOURCE_REQUIRED',422);
  const refs=[...new Map(references.map(r=>[`${r.kind}:${r.id}`,r])).values()];
  if(references.some(r=>references.some(s=>s.kind===r.kind&&s.id===r.id&&s.hash!==r.hash)))fail('IOF_SOURCE_HASH_CONFLICT');
  if(references.some(r=>Object.keys(r).some(k=>!['kind','id','hash'].includes(k))))fail('IOF_REFERENCE_ONLY_REQUEST',422);
  const resolved=new Map();
  for(let i=0;i<refs.length;i++){
    if(refs.length>40)fail('IOF_REFERENCE_LIMIT',422);
    const ref=refs[i],r=await resolveIofSource(scope,opportunityId,ref);resolved.set(`${ref.kind}:${ref.id}`,r);
    if(ref.kind==='PORTFOLIO_REVISION'){
      const id=r.sourceNetworkPlanRevisionId,expected=r.sourceNetworkPlanRevisionHash,prior=refs.find(s=>s.kind==='NETWORK_REVISION'&&s.id===id);
      if(prior&&prior.hash!==expected)fail('IOF_SOURCE_HASH_CONFLICT');
      if(!prior)refs.push({kind:'NETWORK_REVISION',id,hash:expected});
    }
    if(ref.kind==='ARTIFACT')for(const [kind,id,expected] of [['NETWORK_REVISION',r.context.networkPlanRevisionId,r.context.networkPlanRevisionHash],['PORTFOLIO_REVISION',r.context.portfolioPlanningRevisionId,r.context.portfolioPlanningRevisionHash],...(r.iofPackage?.sourceReferences||[]).map(s=>[s.kind,s.id,s.hash])]){
      if(!id)continue;const prior=refs.find(s=>s.kind===kind&&s.id===id);
      if(prior&&prior.hash!==expected)fail('IOF_SOURCE_HASH_CONFLICT');
      if(!prior)refs.push({kind,id,hash:expected});
    }
  }
  refs.sort((a,b)=>`${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`));
  const records=refs.map(ref=>resolved.get(`${ref.kind}:${ref.id}`));
  const portfolioSelections=new Map();
  for(const r of records.filter(r=>r.portfolioPlanningRevisionId)){
    const selected=(r.sites||[]).map(s=>s.routes?.find(route=>route.routeId===s.decision?.selectedRouteId)).filter(Boolean),ids=new Set(selected.flatMap(route=>[route.routeId,route.routeRevisionId].filter(Boolean)));
    const prior=portfolioSelections.get(r.sourceNetworkPlanRevisionId);
    if(prior&&hash([...prior].sort())!==hash([...ids].sort()))fail('IOF_SELECTION_CONTEXT_CONFLICT');
    portfolioSelections.set(r.sourceNetworkPlanRevisionId,ids);
  }
  const products=await listRecords(DIRS.products,options),coverage=iofProductCoverage(products),supported=new Set([...coverage.planner.map(p=>p.productId),...coverage.commercial.filter(p=>p.doctrine).map(p=>p.productId)]);
  const objects=new Map(),routes=new Map(),financial=new Map(),engineering=[],evidence=[],construction=[],financialRecords=[],issues=[];
  const selectedProducts=new Set();
  for(let index=0;index<records.length;index++){
    const r=records[index],ref=refs[index],c=contextFor(r),productId=c.productId;
    if(ref.kind==='RUNTIME_EVIDENCE'){evidence.push({artifactId:r.artifactId,revision:r.revision,payloadHash:r.hash,value:r.payload,source:ref,authority:'SCOPED_PERSISTED_EVIDENCE_REVISION_NOT_AUTOMATIC_ACCEPTANCE'});continue;}
    if(ref.kind==='COMMERCIAL_REVISION'){
      financialRecords.push({commercialRevisionId:idFor(ref.kind,r),recordedRevisionHash:r.revisionHash,fullContentHash:ref.hash,estimateId:r.estimateId||null,commercialWorkbookId:r.commercialWorkbookId||r.workbookId||null,productDoctrineId:r.productDoctrineId||null,repositoryHash:r.repositoryHash||null,authority:'REFERENCE_ONLY_ECONOMICS_REPLAY_NOT_VALIDATED',source:ref});
      issues.push('COMMERCIAL_REVISION_HAS_NO_FINANCIAL_LINE_OPERANDS');continue;
    }
    for(const id of c.productIds||[productId]){if(!supported.has(id))fail('IOF_PRODUCT_DOCTRINE_UNSUPPORTED',422);selectedProducts.add(id);}
    const doctrine=coverage.planner.find(p=>p.productId===productId)?.doctrine||coverage.commercial.find(p=>p.productId===productId)?.doctrine;
    if(['productDoctrineHash','productDoctrineId','productDoctrineVersion'].some(key=>c[key]&&c[key]!==doctrine?.[key]))fail('IOF_PRODUCT_DOCTRINE_HASH_CONFLICT');
    if(r.productCapabilityVersion&&r.productCapabilityVersion!==doctrine?.productDoctrineVersion)fail('IOF_PRODUCT_CAPABILITY_VERSION_UNSUPPORTED');
    const networkClass=c.networkClass||r.protectedPlan?.input?.networkClass;
    engineering.push({productId,doctrine,...(networkClass?{networkClass}:{}),layer1Doctrine:r.doctrineResolution||LAYER1_PLANNER_DOCTRINE,doctrineSource:'server/network-planning/layer1-product-doctrine.js; accepted product admission binding',source:ref});
    if(ref.kind==='ARTIFACT'&&r.iofPackage?.viewData){
      // Reuse exact snapshot values when combining existing packages, not their totals.
      for(const object of r.iofPackage.viewData.objects){const {sources,valueHash,...value}=object;addExact(objects,object.physicalObjectId,value,ref);}
      for(const route of r.iofPackage.viewData.routes){const {sources,valueHash,...value}=route;addExact(routes,route.routeId,value,ref);}
      for(const line of r.iofPackage.viewData.financialLines){const {sources,valueHash,...value}=line;addExact(financial,line.lineId,value,ref);}
      engineering.push(...r.iofPackage.viewData.engineering);construction.push(...r.iofPackage.viewData.construction);
      financialRecords.push(...(r.iofPackage.viewData.financialRecords||[]));evidence.push(...r.iofPackage.viewData.evidence);issues.push(...r.iofPackage.unresolvedItems);continue;
    }
    const selectedRouteIds=ref.kind==='PORTFOLIO_REVISION'?new Set((r.sites||[]).map(s=>s.decision?.selectedRouteId).filter(Boolean)):ref.kind==='PRODUCT_PLAN'?new Set([r.customerSelection?.candidateId]):ref.kind==='NETWORK_REVISION'?(portfolioSelections.get(r.planRevisionId)||new Set((r.scenarios||[]).filter(s=>s.siteRevisionId===r.selectedSolution?.siteRevisionId&&s.candidateId===r.selectedSolution?.candidateId).map(s=>s.routeId||s.routeRevisionId))):null;
    const inventories=Object.entries(r.layer1Inventories||{}).filter(([id])=>!selectedRouteIds||selectedRouteIds.has(id)).map(([,inventory])=>inventory);
    for(const inventory of inventories){
      assertLayer1InventoryBinding(inventory,{tenant_id:scope.customerOrganizationId,account_id:scope.subjectAccountId,opportunity_id:opportunityId});
      for(const object of inventory.physicalObjects||[]){
        if(object.physicalObjectHash){const {physicalObjectHash,...basis}=object;if(hash(basis)!==physicalObjectHash)fail('IOF_PHYSICAL_OBJECT_HASH_CONFLICT');}
        if(ref.kind!=='PRODUCT_PLAN')addExact(objects,object.physicalObjectId,object,ref);
      }
      engineering.push({inventoryRevision:inventory.scope.revision_id,calculationHash:inventory.calculationHash,totals:inventory.totals,source:ref});
    }
    if(ref.kind==='PRODUCT_PLAN'){
      if(!r.customerSelection?.candidateId)issues.push('PRODUCT_PLAN_SELECTION_MISSING');
      const selected=buildPhysicalSolutionManifests(r).filter(m=>m.humanSelection.isThisCandidate);
      for(const m of selected){
        engineering.push({manifestId:m.manifestId,manifestHash:m.manifestHash,planBinding:m.planBinding,physicalQuantities:m.summary.physicalQuantities,branches:m.branches.map(b=>({branchRole:b.branchRole,physicalGraphId:b.physicalGraphId,physicalGraphHash:b.physicalGraphHash,stationing:b.stationing||null,relationships:b.relationships||[]})),source:ref});
        // Use only selected physical objects; inventory arrays may include alternatives.
        for(const branch of m.branches){
          for(const object of branch.objects||[])addExact(objects,object.physicalObjectId,object,ref);
          const geometry=branch.geometry||branch.routeGeometry||branch.ringGeometry,routeId=branch.routeRevisionId||branch.ringCandidateId;
          if(geometry&&routeId)addExact(routes,routeId,{routeId,geometry,geometryHash:hash(geometry),routeFeet:branch.physicalLength?.feet??branch.circumference?.feet??null,routeMiles:branch.physicalLength?.miles??branch.circumference?.miles??null},ref);
        }
      }
    }
    const selectedIds=new Set();
    if(ref.kind==='PORTFOLIO_REVISION')for(const site of r.sites||[])if(site.decision?.selectedRouteId)selectedIds.add(site.decision.selectedRouteId);
    const scenarios=ref.kind==='PORTFOLIO_REVISION'?(r.sites||[]).flatMap(s=>s.routes||[]).filter(s=>selectedIds.has(s.routeId)):(r.scenarios||[]).filter(s=>!selectedRouteIds||selectedRouteIds.has(s.routeId||s.routeRevisionId));
    for(const route of scenarios){
      const routeId=route.routeId||route.routeRevisionId;
      if(!routeId||!route.geometry)continue;
      if(hash(route.geometry)!==route.geometryHash)fail('IOF_ROUTE_GEOMETRY_HASH_CONFLICT');
      addExact(routes,routeId,{routeId,geometry:route.geometry,geometryHash:route.geometryHash,routeFeet:route.routeFeet??null,routeMiles:route.routeMiles??null},ref);
      construction.push({routeId,forecast:route.forecast||null,placementCalibration:route.placementCalibration||null,source:ref});
      for(const line of route.cost?.lineItems||[]){
        const lineId=line.lineId||(route.cost.costId&&line.component?`${route.cost.costId}:${line.component}`:null),currency=line.currency||route.cost.currency;
        const rateReference=line.rateReference||(line.rateSetVersion?{rateSetVersion:line.rateSetVersion,rateStatus:line.rateStatus||'UNRESOLVED'}:null);
        if(!lineId||!Number.isFinite(line.quantity)||!Number.isFinite(line.unitCost)||typeof currency!=='string'||! /^[A-Z]{3}$/.test(currency)||!rateReference){issues.push('FINANCIAL_LINE_OPERANDS_OR_RATE_REFERENCE_MISSING');continue;}
        if(line.rateStatus&&line.rateStatus!=='APPROVED')issues.push('FINANCIAL_RATE_NOT_APPROVED');
        if(!line.unit)issues.push('FINANCIAL_QUANTITY_UNIT_MISSING');
        addExact(financial,lineId,{lineId,description:line.description||line.component||lineId,quantity:line.quantity,unit:line.unit||null,unitCost:line.unitCost,currency,rateReference,calculationReference:{costId:route.cost.costId||null,quantityId:route.cost.quantityId||null,rateSetVersion:route.cost.rateSetVersion||line.rateSetVersion||null},reportedTotal:line.total??line.extendedCost??null},ref);
      }
    }
    if(r.selectedSolution?.physicalAccessRoute?.geometry){
      const route=r.selectedSolution.physicalAccessRoute,routeId=route.routeRevisionId;
      if(!routeId||!route.geometryHash||hash(route.geometry)!==route.geometryHash)fail('IOF_ARTIFACT_ROUTE_BINDING_MISSING');
      addExact(routes,routeId,{routeId,geometry:route.geometry,geometryHash:route.geometryHash,routeFeet:route.feet??null,routeMiles:route.miles??null},ref);
    }
    if(r.preliminaryCommercialInputs)evidence.push({type:'PRELIMINARY_FINANCIAL_INPUTS_NOT_GOVERNED_ESTIMATE',value:r.preliminaryCommercialInputs,source:ref});
    for(const value of [...(r.sourceLineage||[]),...(r.universeReferences||[])])evidence.push({value,source:ref,authority:'PERSISTED_SOURCE_REFERENCE_ORIGINAL_BYTES_AND_RIGHTS_NOT_REVALIDATED'});
    if(r.sourceLineage?.length||r.universeReferences?.length)issues.push('ORIGINAL_CONTENT_BYTES_AND_CURRENT_CONTENT_GRANTS_NOT_REVALIDATED');
    issues.push(...(r.unresolvedItems||r.unresolvedEvidence||[]));
  }
  if(!selectedProducts.size)fail('IOF_SUPPORTED_PRODUCT_SOURCE_REQUIRED',422);
  const viewData={engineering,routes:[...routes.values()].sort((a,b)=>a.routeId.localeCompare(b.routeId)),objects:[...objects.values()].sort((a,b)=>a.physicalObjectId.localeCompare(b.physicalObjectId)),financialLines:[...financial.values()].sort((a,b)=>a.lineId.localeCompare(b.lineId)),financialRecords,construction,evidence};
  if(!objects.size)issues.push('AUTHORITATIVE_SELECTED_PHYSICAL_OBJECTS_MISSING');
  if(!routes.size)issues.push('AUTHORITATIVE_SELECTED_GEOMETRY_MISSING');
  if(!financial.size)issues.push('FORMULA_READY_FINANCIAL_LINES_MISSING');
  const productIds=[...selectedProducts].sort(),primary=coverage.planner.find(p=>p.productId===productIds[0])?.doctrine||coverage.commercial.find(p=>p.productId===productIds[0])?.doctrine;
  const context={environment:currentRepositoryAuthority().authorityClass,accountId:scope.subjectAccountId,customerId:scope.customerId,customerOrganizationId:scope.customerOrganizationId,opportunityId,productId:productIds[0],productIds,...primary};
  const dataByDomain={engineering:engineering,spatial:viewData.routes,inventory:viewData.objects,financial:[...viewData.financialLines,...financialRecords],construction,evidence,deliverables:[]};
  const packageBasis={schemaVersion:'IOF-DATA-PACKAGE-V2',context,sourceReferences:refs,viewData,sections:Object.fromEntries(IOF_PACKAGE_DOMAINS.map(domain=>[domain,{state:dataByDomain[domain].length?'REFERENCED_UNVALIDATED':'UNRESOLVED',references:refs.map(r=>({kind:r.kind,recordId:r.id,revisionId:r.id,hash:r.hash})),unresolved:dataByDomain[domain].length?[]:[`AUTHORITATIVE_${domain.toUpperCase()}_DATA_MISSING`],accepted:false}])),unresolvedItems:[...new Set(issues)].sort(),deduplication:{basis:'EXACT_PHYSICAL_OBJECT_ID_AND_VALUE_HASH',sharedObjects:[...objects.values()].filter(o=>o.sources.length>1).map(o=>o.physicalObjectId),geometryOverlapDoesNotProveSharedInfrastructure:true},outputs:['ENGINEERING_PDF','FORMULA_XLSX','SPATIAL_KMZ'].map(format=>({format,state:'NOT_GENERATED',outputHash:null})),authority:{planningOnly:true,engineeringAccepted:false,commercialApproved:false,inventoryCreated:false,estimateCreated:false,constructionAuthorized:false,scopeVersionCreated:false}};
  const iofPackage={...packageBasis,packageRevisionHash:hash(packageBasis)};
  const basis={schemaVersion:'IOF-PLANNER-ARTIFACT-V2',context,iofPackage,unresolvedItems:iofPackage.unresolvedItems,authority:{planningOnly:true,scopeVersion:false,engineering:false,commercialEstimate:false}};
  const artifactHash=hash(basis),artifact={...basis,plannerArtifactId:`PLANNER-ARTIFACT-${context.environment==='DEMO'?'DEMO-':''}${artifactHash}`,artifactHash,canonicalSerialization:JSON.stringify(basis),status:'READY_FOR_SUBMISSION',revision:1,immutable:true};
  return artifact;
}
