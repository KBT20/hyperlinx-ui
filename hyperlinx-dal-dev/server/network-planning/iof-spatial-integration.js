// Projection of existing enrichment and native object identities, not new plant.
import {contentCanonicalHash as hash} from '../content/content-registry-authority.js';
export const SPATIAL_INTEGRATION_POLICY='IOF-SPATIAL-MANIFEST-R3B';
export const SPATIAL_EXPORT_POLICY='IOF-SAME-SNAPSHOT-PDF-XLSX-KMZ-R3B';
const fail=code=>{throw Object.assign(Error(code),{code,status:409});};
export const ROUTE_REFINEMENT_PATH=Object.freeze([
 'Record a source-backed candidate change; keep the current route unchanged.',
 'Authorized Engineering reviews the candidate and unresolved conditions.',
 'Admit a new governed route revision and regenerate its measured Spine and Layer-1 inventory.',
 'Regenerate quantities and source-backed costs; explicitly select a new commercial strategy.',
 'Create a new proposal revision for human review and release; preserve prior proposals.'
]);
export function enrichmentObjectBindings(artifact,revision){
 const objects=artifact.iofPackage.viewData.objects;
 return revision.features.map(feature=>{
  const branch=revision.branches.find(b=>b.branchId===feature.branchId);
  if(!branch||feature.spineRevisionHash!==branch.spineRevisionHash||feature.routeGeometryHash!==branch.routeGeometryHash)fail('IOF_SPATIAL_BRANCH_BINDING_CONFLICT');
  const route=artifact.iofPackage.viewData.routes.find(r=>r.routeId===branch.routeId);
  if(!route||hash(route.geometry)!==branch.routeGeometryHash)fail('IOF_SPATIAL_ROUTE_BINDING_CONFLICT');
  const relation=feature.spatialRelation||{},segments=branch.spine.segments;
  const segmentIds=new Set([feature.station?.segmentId,...(relation.contacts||[]).map(c=>c.routeSegmentId)] .filter(Boolean));
  for(const interval of relation.intervals||[])for(const segment of segments){
   const factor=branch.nativeRouteFeet/branch.spine.routeLengthFeet;
   if(segment.cumulativeEndFeet*factor>=interval.fromFeet&&segment.cumulativeStartFeet*factor<=interval.toFeet)segmentIds.add(segment.segmentId);
  }
  if([...segmentIds].some(id=>!segments.some(s=>s.segmentId===id)))fail('IOF_SPATIAL_SEGMENT_BINDING_CONFLICT');
  const physicalObjectReferences=objects.filter(o=>o.routeCandidateId===branch.routeId&&o.branchRole===branch.branchRole).map(o=>({physicalObjectId:o.physicalObjectId,physicalObjectHash:o.physicalObjectHash||o.valueHash,association:'EXACT_NATIVE_BRANCH_CONTEXT_NOT_OBSERVED_ASSET_IDENTITY'})).sort((a,b)=>a.physicalObjectId.localeCompare(b.physicalObjectId));
  return {featureId:feature.featureId,branchId:branch.branchId,routeId:branch.routeId,runId:branch.runId,inventoryHash:branch.inventoryHash,spineId:branch.spineId,spineRevisionHash:branch.spineRevisionHash,spineSegmentIds:[...segmentIds].sort(),physicalObjectReferences,unresolved:physicalObjectReferences.length?[]:['NATIVE_BRANCH_PHYSICAL_OBJECT_REFERENCES_UNRESOLVED']};
 }).sort((a,b)=>a.featureId.localeCompare(b.featureId));
}
export function integratedEnrichment(artifact){
 const ref=artifact.iofPackage.enrichmentRevision;
 if(!ref?.integrationPolicy)return null;
 if(ref.integrationPolicy!==SPATIAL_INTEGRATION_POLICY||!ref.snapshot||hash(ref.snapshot)!==ref.revisionHash||hash(ref.snapshot.context)!==hash(artifact.context)||hash(enrichmentObjectBindings(artifact,ref.snapshot))!==hash(ref.objectBindings))fail('IOF_SPATIAL_SNAPSHOT_BINDING_CONFLICT');
 return ref;
}
export function spatialExportBinding(artifact){
 const ref=integratedEnrichment(artifact);if(!ref)return null;
 return {policy:ref.integrationPolicy,revisionHash:ref.revisionHash,evidenceReference:ref.evidenceReference,baseExportId:ref.baseExportId,featureIds:ref.snapshot.features.map(f=>f.featureId),objectBindings:ref.objectBindings,spines:ref.snapshot.branches.map(b=>({branchId:b.branchId,spineId:b.spineId,spineRevisionHash:b.spineRevisionHash,inventoryHash:b.inventoryHash})),audience:'INTERNAL_PRELIMINARY_EVIDENCE_NOT_CUSTOMER_DISCLOSURE',engineeringAccepted:false,routeRefinementPath:ROUTE_REFINEMENT_PATH};
}
