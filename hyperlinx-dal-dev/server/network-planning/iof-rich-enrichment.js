import {createHash} from 'node:crypto';
import {contentCanonicalHash as hash} from '../content/content-registry-authority.js';
import {RICH_SOURCE_SCHEMA} from './iof-kmz-rich-parser.js';
import {relateSpatialGeometry,relateSourceInterval} from './iof-spatial-relationships.js';
export const RICH_SCHEMA='IOF-BRANCH-ENRICHMENT-R2',RICH_INPUT='IOF-RICH-ENRICHMENT-INPUT-R2';
const sha=s=>createHash('sha256').update(s).digest('hex');
const fail=c=>{throw Object.assign(Error(c),{status:422});};
export function richObservations(sources){
  const observations=[],issues=[];
  for(const {ref,record} of sources){
    const p=record.payload;if(ref.kind!=='RUNTIME_EVIDENCE'||p?.schemaVersion!==RICH_SOURCE_SCHEMA)continue;
    if(!p.source?.artifactId||!/^[a-f0-9]{64}$/.test(p.source.sha256)||p.source.parserVersion!=='IOF-RICH-KMZ-R2'||!p.source.revision||!Array.isArray(p.features)||p.features.length>10000||p.summary?.accountedFeatures!==p.features.length)fail('RICH_SOURCE_REGISTER_REQUIRED');
    const ids=new Set();for(const f of p.features){
      if(!f.sourceFeatureId||ids.has(f.sourceFeatureId)||sha(f.rawXml)!==f.rawXmlSha256)fail('RICH_SOURCE_FEATURE_INTEGRITY');ids.add(f.sourceFeatureId);
      const basis={sourceReference:ref,source:p.source,sourceFeatureId:f.sourceFeatureId,sourceLocator:f.sourceLocator,sourceGeometry:f.originalGeometry,sourceDescription:f.sourceDescription,sourceDescriptionHash:sha(f.sourceDescription),category:'UNCLASSIFIED_SOURCE_OBSERVATION',observation:f.sourceName||f.sourceFeatureId,sourceConfidence:'UNVERIFIED_SOURCE_CLAIM',verificationStatus:'UNVERIFIED_SOURCE_CLAIM',spatialType:f.routeInterval?'ROUTE_INTERVAL':f.originalGeometry?.type||'PRESERVED_ONLY',sourceFeature:f};
      observations.push({observationId:'IOF-RICH-OBSERVATION-'+hash(basis),...basis});
    }
    for(const d of p.documents.filter(d=>d.status!=='PARSED'))issues.push({source:ref,...d,disposition:'SOURCE_ENTRY_PRESERVED; GEOMETRY_UNRESOLVED'});
  }return {observations:observations.sort((a,b)=>a.observationId.localeCompare(b.observationId)),issues};
}

export function compileRichEnrichment({artifact,branches,observations,issues=[],sources,input,reviewEvidence}){
  if(input?.schemaVersion!==RICH_INPUT||input.providerId!=='OFFLINE'||Object.keys(input).some(k=>!['schemaVersion','providerId','reason','selections','relationshipPolicy'].includes(k)))fail('RICH_OFFLINE_INPUT_REQUIRED');
  if(typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>2000||!Array.isArray(input.selections)||input.selections.length>200)fail('RICH_REASON_AND_BOUNDED_SELECTIONS_REQUIRED');
  const policy=input.relationshipPolicy||{};
  if(Object.keys(policy).some(k=>!['nearbyFeet','adjacentFeet'].includes(k))||Object.values(policy).some(v=>v!==null&&(!Number.isFinite(v)||v<0)))fail('RICH_EXPLICIT_PROXIMITY_POLICY_REQUIRED');
  const ids=new Set(),features=input.selections.map(s=>{
    if(!s||Object.keys(s).some(k=>!['branchId','observationId','reviewStatus','reviewNote','segmentId'].includes(k)))fail('RICH_REFERENCE_ONLY_SELECTION');
    const b=branches.find(b=>b.branchId===s.branchId),o=observations.find(o=>o.observationId===s.observationId);
    if(!b||!o||(o.eligibleBranchIds&&!o.eligibleBranchIds.includes(b.branchId)))fail('RICH_EXACT_BRANCH_OBSERVATION_REQUIRED');
    if(!['PENDING','REVIEWED_PRELIMINARY','REJECTED'].includes(s.reviewStatus)||typeof s.reviewNote!=='string'||s.reviewNote.length>2000||(s.reviewStatus!=='PENDING'&&!s.reviewNote.trim()))fail('RICH_PRELIMINARY_REVIEW_AND_NOTE_REQUIRED');
    const featureId='IOF-STATIONED-FEATURE-'+hash({branchId:b.branchId,observationId:o.observationId});if(ids.has(featureId))fail('RICH_DUPLICATE_FEATURE');ids.add(featureId);
    const native=sources.find(s=>hash(s.ref)===hash(b.sourceRevision))?.record;
    const planBinding={planId:native?.customerPlanId||native?.planId||null,planRevisionId:b.sourceRevision?.id||null,planRevisionHash:b.sourceRevision?.hash||null,selectedCandidateId:native?.customerSelection?.candidateId||native?.selectedSolution?.candidateId||null,inventoryRevisionId:b.inventoryRevisionId,inventoryHash:b.inventoryHash,runId:b.runId};
    const spatialRelation=o.sourceFeature?.routeInterval?relateSourceInterval(b,o.sourceFeature.routeInterval):relateSpatialGeometry(b,o.sourceGeometry,policy,s.segmentId);
    if(spatialRelation.parts)spatialRelation.parts=spatialRelation.parts.map(p=>({...p,sourcePartId:o.sourceFeature?.parts[p.partIndex]?.partId||null}));
    if(o.sourceFeature?.disposition==='PARTIAL')spatialRelation.qualifications.push('PARTIAL_SOURCE_GEOMETRY; UNSUPPORTED_COMPONENTS_RETAINED');
    if(spatialRelation.relationship==='AMBIGUOUS'&&s.reviewStatus==='REVIEWED_PRELIMINARY')fail('RICH_AMBIGUOUS_ADDRESS_REQUIRES_SELECTION');
    return {featureId,branchId:b.branchId,productId:b.productId,networkClasses:b.networkClasses,branchRole:b.branchRole,routeId:b.routeId,sourceRevision:b.sourceRevision,planBinding,inventoryRevisionId:b.inventoryRevisionId,inventoryHash:b.inventoryHash,routeGeometryHash:b.routeGeometryHash,spineId:b.spineId,spineRevisionHash:b.spineRevisionHash,observation:o,spatialRelation,...(spatialRelation.station?{station:spatialRelation.station}:{}),engineeringInterpretation:{status:'UNRESOLVED',preliminaryReviewerNote:s.reviewNote,verified:false,authority:'PRELIMINARY_REVIEW_ONLY; NO_METHOD_OR_COST_AUTHORITY'},review:{...reviewEvidence,status:s.reviewStatus,note:s.reviewNote},engineeringActions:[{actionId:'IOF-ACTION-'+hash({featureId,action:'REVIEW_SOURCE_CLASSIFICATION_AND_TREATMENT'}),requirement:'REVIEW_SOURCE_CLASSIFICATION_AND_ENGINEERING_TREATMENT',status:'UNRESOLVED',createsPricedScope:false}],engineeringAccepted:false,scopeQuantityCreated:false};
  }).sort((a,b)=>a.featureId.localeCompare(b.featureId));
  const sourceRegisters=sources.filter(s=>s.record.payload?.schemaVersion===RICH_SOURCE_SCHEMA).map(s=>({sourceReference:s.ref,...s.record.payload}));
  const sourceAccounting=sourceRegisters.map(r=>{const related=features.filter(f=>hash(f.observation.sourceReference)===hash(r.sourceReference)),count=predicate=>new Set(related.filter(f=>predicate(f)).map(f=>f.observation.sourceFeatureId)).size;return {sourceReference:r.sourceReference,...r.summary,selectedForRelation:count(()=>true),branchRelationships:related.length,featuresRelatedToSpine:count(f=>!['UNRESOLVED','AMBIGUOUS','GEOGRAPHICALLY_SEPARATE'].includes(f.spatialRelation.relationship)),geographicallySeparateFeatures:count(f=>f.spatialRelation.relationship==='GEOGRAPHICALLY_SEPARATE'),nearbyResources:count(f=>f.spatialRelation.relationship==='NEARBY_RESOURCE'),ambiguousGeometries:count(f=>f.spatialRelation.relationship==='AMBIGUOUS'),unresolvedRelationships:count(f=>f.spatialRelation.relationship==='UNRESOLVED'),notEvaluatedFeatures:r.features.length-count(()=>true),allFeaturesAccounted:r.summary.totalPlacemarks!==null&&r.summary.parseFailureDocuments===0&&r.summary.accountedFeatures===r.features.length};});
  return {schemaVersion:RICH_SCHEMA,context:structuredClone(artifact.context),provider:{providerId:'OFFLINE',version:'IOF-RICH-SPATIAL-ADAPTER-R2',invokesNetwork:false},input:structuredClone(input),branches:structuredClone(branches),features,issues,sourceRegisters,sourceAccounting,coverage:'SELECTED_SOURCE_GEOMETRIES; UNEVALUATED_AND_UNSUPPORTED_CONTENT_RETAINED',qualifications:['SOURCE_OBSERVATION_SPATIAL_RELATION_AND_ENGINEERING_INTERPRETATION_ARE_DISTINCT','NO_AUTOMATIC_METHOD_QUANTITY_PRICE_OR_CONNECTION','LOCAL_EPSG4326_SEGMENT_INTERSECTIONS; POLAR_DATELINE_AND_LARGE_SEGMENTS_QUALIFIED_UNRESOLVED'],authority:{planningOnly:true,engineeringAccepted:false,commercialApproved:false,customerDisclosureApproved:false,scopeVersionCreated:false},reviewEvidence};
}
