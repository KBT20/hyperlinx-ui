import {contentCanonicalHash as hash} from '../content/content-registry-authority.js';
import {createHash} from 'node:crypto';
import {assertLayer1InventoryBinding} from './layer1-inventory-objects.js';
import {createMeasuredSpine,coordinateAtMeasureOnSpine,stationLabelForMeasure} from '../generated/point-to-point-runtime.js';

export const ENRICHMENT_SCHEMA='IOF-BRANCH-ENRICHMENT-R1';
export const OFFLINE_FEATURE_SCHEMA='IOF-OFFLINE-FEATURE-EVIDENCE-V1';
export const ENRICHMENT_ACK='I record source-backed preliminary observations on these exact IOF branches. Review does not verify field conditions or approve engineering, pricing, disclosure or construction.';
export const ENRICHMENT_PROVIDERS=Object.freeze([
  {providerId:'OFFLINE',version:'IOF-OFFLINE-BRANCH-ADAPTER-R1',available:true,invokesNetwork:false},
  {providerId:'OPENAI',version:null,available:false,invokesNetwork:false,reason:'NOT_CONFIGURED; FUTURE_EVIDENCE_REQUIRES_NEW_REVISION'},
  {providerId:'L40S',version:null,available:false,invokesNetwork:false,reason:'NOT_CONFIGURED; FUTURE_EVIDENCE_REQUIRES_NEW_REVISION'},
]);
const fail=(code)=>{throw Object.assign(new Error(code),{code,status:422});};
const requiredText=(v,max=2000)=>{if(typeof v!=='string'||!v.trim()||v.length>max)fail('IOF_ENRICHMENT_TEXT_REQUIRED');return v.trim();};
const point=g=>g?.type==='Point'&&Array.isArray(g.coordinates)&&g.coordinates.length===2&&g.coordinates.every(Number.isFinite)&&Math.abs(g.coordinates[0])<=180&&Math.abs(g.coordinates[1])<=90;
const offsetFeet=(a,b)=>a[0]===b[0]&&a[1]===b[1]?0:createMeasuredSpine({packageId:'ENRICHMENT-OFFSET',geometry:[a,b]}).routeLengthFeet;

// Use the same existing measured-Spine implementation as native Layer-1 materialization.
// Identity includes immutable source/quantity revision, never just a display label.
export function enrichmentBranches(artifact,sources){
  const selected=new Set(artifact.iofPackage.viewData.engineering.map(e=>e.calculationHash).filter(Boolean));
  const branches=new Map();
  for(const {ref,record} of sources)for(const inventory of Object.values(record.layer1Inventories||{})){
    if(!selected.has(inventory.calculationHash))continue;
    assertLayer1InventoryBinding(inventory,{tenant_id:artifact.context.customerOrganizationId,account_id:artifact.context.accountId,opportunity_id:artifact.context.opportunityId});
    for(const run of inventory.runs||[]){
      const route=artifact.iofPackage.viewData.routes.find(r=>r.routeId===run.sourceRouteId);
      if(!route||hash(route.geometry)!==hash(run.geometry))fail('IOF_ENRICHMENT_NATIVE_ROUTE_BINDING_REQUIRED');
      const scope=inventory.scope;
      if(scope.account_id!==artifact.context.accountId||scope.opportunity_id!==artifact.context.opportunityId||scope.tenant_id!==artifact.context.customerOrganizationId)fail('IOF_ENRICHMENT_NATIVE_SCOPE_CONFLICT');
      const spine=createMeasuredSpine({packageId:run.runId,routeId:run.runId,geometry:run.geometry,sourceGeometryRef:run.sourceRouteId});
      if(!Number.isFinite(run.geometricRouteFeet)||run.geometricRouteFeet<=0)fail('IOF_ENRICHMENT_NATIVE_MEASURE_REQUIRED');
      const basis={productId:scope.product_id,networkClasses:run.networkClasses,sourceRevision:ref,inventoryRevisionId:scope.revision_id,inventoryHash:inventory.calculationHash,branchRole:run.branchRole,runId:run.runId,routeId:route.routeId,routeGeometryHash:hash(route.geometry),closed:run.closed,nativeRouteFeet:run.geometricRouteFeet,measuredGeometryFeet:spine.routeLengthFeet,stationMeasurePolicy:'NATIVE_RUN_PROPORTIONAL_GEOMETRY_ADDRESS_R1; SAME_AS_LAYER1_MATERIALIZATION',spineId:spine.spineId,spineRevisionHash:hash(spine),spine,geometry:structuredClone(run.geometry)};
      const branchId='IOF-BRANCH-'+hash(basis),existing=branches.get(branchId);
      if(!existing)branches.set(branchId,{branchId,...basis});
    }
  }
  return [...branches.values()].sort((a,b)=>a.branchId.localeCompare(b.branchId));
}

// Only explicit, tenant-resolved saved evidence is consumed. Names/LLM output do
// not classify features, prove crossings or grant verified engineering status.
export function offlineObservations(sources,branches=[]){
  const observations=[],issues=[];
  // Existing native special-condition points are usable evidence; linear or
  // unlocated conditions remain visible qualifications, never invented stations.
  for(const branch of branches){
    const record=sources.find(s=>hash(s.ref)===hash(branch.sourceRevision))?.record;
    const inventory=Object.values(record?.layer1Inventories||{}).find(i=>i.calculationHash===branch.inventoryHash);
    const run=inventory?.runs.find(r=>r.runId===branch.runId);
    for(const [index,condition] of (run?.specialConditions||[]).entries()){
      const sourceLocator=`layer1Inventory:${branch.inventoryHash}:run:${branch.runId}:specialConditions:${index}`;
      if(!point(condition.geometry)){issues.push({source:branch.sourceRevision,branchId:branch.branchId,sourceLocator,reason:'NATIVE_CONDITION_POINT_LOCATION_UNRESOLVED; NO_STATION_INVENTED'});continue;}
      const basis={sourceReference:branch.sourceRevision,source:{artifactId:branch.sourceRevision.id,sha256:branch.sourceRevision.hash,hashKind:'CANONICAL_RECORD_SHA256',revision:branch.inventoryRevisionId,locator:sourceLocator},sourceFeatureId:condition.evidenceId||condition.corridorEdgeId||sourceLocator,sourceLocator,sourceGeometry:structuredClone(condition.geometry),sourceDescription:null,sourceDescriptionHash:null,category:condition.conditionType||condition.type||'UNCLASSIFIED_CONDITION',observation:condition.description||condition.name||'Native source condition; engineering treatment unresolved',sourceConfidence:condition.confidence||'UNVERIFIED_NATIVE_SOURCE_CLAIM',verificationStatus:'UNVERIFIED_SOURCE_CLAIM',eligibleBranchIds:[branch.branchId]};
      observations.push({observationId:'IOF-OBSERVATION-'+hash(basis),...basis});
    }
  }
  for(const {ref,record} of sources){
    if(ref.kind!=='RUNTIME_EVIDENCE'||record.payload?.schemaVersion!==OFFLINE_FEATURE_SCHEMA)continue;
    const {source,features}=record.payload;
    if(!source?.artifactId||!/^[a-f0-9]{64}$/.test(source.sha256||'')||!source.revision||!source.locator||!Array.isArray(features)||features.length>1000)fail('IOF_ENRICHMENT_SOURCE_PROVENANCE_REQUIRED');
    const ids=new Set();
    for(const issue of record.payload.sourceIssues||[])issues.push({source:ref,...issue});
    for(const feature of features){
      requiredText(feature.sourceFeatureId);if(ids.has(feature.sourceFeatureId))fail('IOF_ENRICHMENT_DUPLICATE_SOURCE_FEATURE');ids.add(feature.sourceFeatureId);
      if(!point(feature.geometry)){issues.push({source:ref,sourceFeatureId:feature.sourceFeatureId,reason:'POINT_LOCATION_REQUIRED; NO_LINE_OR_POLYGON_TREATMENT_IN_R1'});continue;}
      if(feature.sourceDescription!==undefined&&(typeof feature.sourceDescription!=='string'||feature.sourceDescription.length>16384))fail('IOF_ENRICHMENT_SOURCE_DESCRIPTION_LIMIT');
      if(feature.sourceDescription!==undefined&&feature.sourceDescriptionHash!==createHash('sha256').update(feature.sourceDescription).digest('hex'))fail('IOF_ENRICHMENT_SOURCE_DESCRIPTION_HASH_CONFLICT');
      const basis={sourceReference:ref,source:structuredClone(source),sourceFeatureId:feature.sourceFeatureId,sourceLocator:requiredText(feature.sourceLocator),sourceGeometry:structuredClone(feature.geometry),sourceDescription:feature.sourceDescription??null,sourceDescriptionHash:feature.sourceDescriptionHash??null,category:requiredText(feature.category),observation:requiredText(feature.observation),sourceConfidence:requiredText(feature.confidence),verificationStatus:feature.simulated===true?'SIMULATED_NOT_FIELD_EVIDENCE':'UNVERIFIED_SOURCE_CLAIM'};
      observations.push({observationId:'IOF-OBSERVATION-'+hash(basis),...basis});
    }
  }
  return {observations:observations.sort((a,b)=>a.observationId.localeCompare(b.observationId)),issues};
}

// Project to each existing Spine segment and retain all equally close addresses.
// No rounding to station grids, nearest-station reassignment or hidden distance cutoff.
export function stationSourcePoint(branch,geometry,selectedSegmentId){
  if(!point(geometry))fail('IOF_ENRICHMENT_POINT_REQUIRED');
  const [lon,lat]=geometry.coordinates,cos=Math.cos(lat*Math.PI/180);
  const candidates=branch.spine.segments.map(segment=>{
    const a=segment.startCoordinate,b=segment.endCoordinate,dx=(b[0]-a[0])*cos,dy=b[1]-a[1],length=dx*dx+dy*dy;
    const t=length?Math.max(0,Math.min(1,((lon-a[0])*cos*dx+(lat-a[1])*dy)/length)):0;
    const coordinate=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];
    const measureFeet=segment.cumulativeStartFeet+t*(segment.cumulativeEndFeet-segment.cumulativeStartFeet);
    return {segmentId:segment.segmentId,measureFeet,coordinate,offsetFeet:offsetFeet(geometry.coordinates,coordinate)};
  }).sort((a,b)=>a.offsetFeet-b.offsetFeet||a.measureFeet-b.measureFeet);
  const minimum=candidates[0].offsetFeet,nearest=candidates.filter(v=>Math.abs(v.offsetFeet-minimum)<0.001);
  const chosen=selectedSegmentId?nearest.find(v=>v.segmentId===selectedSegmentId):nearest[0];
  if(!chosen)fail('IOF_ENRICHMENT_SEGMENT_NOT_NEAREST');
  const distinctMeasures=[...new Set(nearest.map(v=>v.measureFeet.toFixed(3)))];
  // Inverse of existing Layer-1 materialization's native-station→geometry measure
  // conversion. Preserve both operands; do not silently replace ledger footage.
  const scale=branch.nativeRouteFeet/branch.spine.routeLengthFeet;
  return {...chosen,geometryMeasureFeet:chosen.measureFeet,measureFeet:chosen.measureFeet*scale,stationLabel:stationLabelForMeasure(chosen.measureFeet*scale),spineCoordinate:coordinateAtMeasureOnSpine(branch.spine,chosen.measureFeet).coordinate,unitReconciliation:{nativeRouteFeet:branch.nativeRouteFeet,geometryRouteFeet:branch.spine.routeLengthFeet,nativeFeetPerGeometryFoot:scale,rule:'GEOMETRY_MEASURE_X_NATIVE_RUN_FEET_DIVIDED_BY_MEASURED_SPINE_FEET'},ambiguous:distinctMeasures.length>1,locationReviewRequired:distinctMeasures.length>1&&!selectedSegmentId,nearestAddresses:nearest.map(v=>({...v,geometryMeasureFeet:v.measureFeet,measureFeet:v.measureFeet*scale})),locationRelationship:'PROJECTED_SOURCE_POINT; NOT_VERIFIED_INTERSECTION',projectionVersion:'IOF-POINT-TO-NATIVE-SPINE-R1',canonicalUnit:'ROUTE_FEET'};
}

export function compileEnrichment({artifact,branches,observations,issues=[],input,reviewEvidence}){
  if(!input||typeof input!=='object'||Object.keys(input).some(k=>!['providerId','reason','selections'].includes(k)))fail('IOF_ENRICHMENT_REFERENCE_ONLY_INPUT');
  if(input.providerId!=='OFFLINE')fail('IOF_ENRICHMENT_PROVIDER_NOT_CONFIGURED');
  requiredText(input.reason);
  if(!Array.isArray(input.selections)||input.selections.length>200)fail('IOF_ENRICHMENT_SELECTION_LIMIT');
  const ids=new Set(),features=input.selections.map(selection=>{
    if(!selection||typeof selection!=='object')fail('IOF_ENRICHMENT_REFERENCE_ONLY_SELECTION');
    if(Object.keys(selection).some(k=>!['branchId','observationId','reviewStatus','reviewNote','segmentId'].includes(k)))fail('IOF_ENRICHMENT_REFERENCE_ONLY_SELECTION');
    const branch=branches.find(b=>b.branchId===selection.branchId),observation=observations.find(o=>o.observationId===selection.observationId);
    if(!branch||!observation)fail('IOF_ENRICHMENT_EXACT_BRANCH_AND_OBSERVATION_REQUIRED');
    if(observation.eligibleBranchIds&&!observation.eligibleBranchIds.includes(branch.branchId))fail('IOF_ENRICHMENT_SOURCE_BRANCH_CONFLICT');
    if(selection.reviewNote!==undefined&&(typeof selection.reviewNote!=='string'||selection.reviewNote.length>2000))fail('IOF_ENRICHMENT_REVIEW_NOTE_LIMIT');
    if(!['PENDING','REVIEWED_PRELIMINARY','REJECTED'].includes(selection.reviewStatus))fail('IOF_ENRICHMENT_PRELIMINARY_REVIEW_ONLY');
    if(selection.reviewStatus!=='PENDING')requiredText(selection.reviewNote);
    const featureId='IOF-STATIONED-FEATURE-'+hash({branchId:branch.branchId,observationId:observation.observationId});
    if(ids.has(featureId))fail('IOF_ENRICHMENT_DUPLICATE_BRANCH_FEATURE');ids.add(featureId);
    const station=stationSourcePoint(branch,observation.sourceGeometry,selection.segmentId);
    if(station.locationReviewRequired&&selection.reviewStatus==='REVIEWED_PRELIMINARY')fail('IOF_ENRICHMENT_AMBIGUOUS_STATION_REVIEW_REQUIRED');
    const rail=observation.category==='RAILROAD_CROSSING';
    const engineeringActions=(rail?['DETERMINE_RAIL_CROSSING_TREATMENT','DETERMINE_OWNER_AND_PERMIT_REQUIREMENTS']:['REVIEW_SOURCE_CLAIM_AND_ENGINEERING_TREATMENT']).map(requirement=>({actionId:'IOF-ENGINEERING-ACTION-'+hash({featureId,requirement}),requirement,status:'UNRESOLVED',createsPricedScope:false}));
    return {featureId,branchId:branch.branchId,productId:branch.productId,branchRole:branch.branchRole,routeId:branch.routeId,sourceRevision:branch.sourceRevision,routeGeometryHash:branch.routeGeometryHash,spineId:branch.spineId,spineRevisionHash:branch.spineRevisionHash,observation:structuredClone(observation),station,review:{status:selection.reviewStatus,note:selection.reviewNote?.trim()||'',...reviewEvidence},engineeringActions,engineeringAccepted:false,scopeQuantityCreated:false};
  }).sort((a,b)=>a.featureId.localeCompare(b.featureId));
  return {schemaVersion:ENRICHMENT_SCHEMA,context:structuredClone(artifact.context),provider:ENRICHMENT_PROVIDERS[0],input:structuredClone(input),branches:structuredClone(branches),features,issues,coverage:'SELECTED_SOURCE_POINTS_ONLY; NOT_A_COMPLETE_FEATURE_SURVEY',qualifications:['SOURCE_CLAIMS_UNVERIFIED','PROJECTION_DOES_NOT_VERIFY_A_CROSSING','TREATMENT_AND_COST_REQUIRE_FUTURE_REVIEW'],authority:{planningOnly:true,engineeringAccepted:false,commercialApproved:false,customerDisclosureApproved:false,scopeVersionCreated:false},reviewEvidence};
}
