import {routeLengthFeet} from '../generated/point-to-point-runtime.js';
import {stationSourcePoint} from './iof-enrichment.js';
const EPS=1e-10;
const xy=c=>c.slice(0,2),sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const box=(a,b)=>[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])];
const overlaps=(a,b)=>a[0]<=b[2]+EPS&&a[2]+EPS>=b[0]&&a[1]<=b[3]+EPS&&a[3]+EPS>=b[1];
const lerp=(a,b,t)=>[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];
const clamp=t=>Math.max(0,Math.min(1,t));
export function segmentIntersection(a,b,c,d){
  const r=sub(b,a),s=sub(d,c),q=sub(c,a),den=cross(r,s),rr=r[0]**2+r[1]**2;
  if(rr<EPS*EPS)return null;
  if(Math.abs(den)<=EPS*Math.max(Math.hypot(...r)*Math.hypot(...s),EPS)){
    if(Math.abs(cross(q,r))>EPS*Math.max(Math.hypot(...r),EPS))return null;
    const t0=(q[0]*r[0]+q[1]*r[1])/rr,t1=t0+(s[0]*r[0]+s[1]*r[1])/rr,from=Math.max(0,Math.min(t0,t1)),to=Math.min(1,Math.max(t0,t1));
    return to<from-EPS?null:{kind:to-from>EPS?'OVERLAP':'INTERSECTS',from:clamp(from),to:clamp(to)};
  }
  const t=cross(q,s)/den,u=cross(q,r)/den;
  if(t<-EPS||t>1+EPS||u<-EPS||u>1+EPS)return null;
  return {kind:t>EPS&&t<1-EPS&&u>EPS&&u<1-EPS?'CROSSES':'INTERSECTS',from:clamp(t),to:clamp(t)};
}
const geometryStation=(s,t)=>s.cumulativeStartFeet+t*(s.cumulativeEndFeet-s.cumulativeStartFeet);
function mergeIntervals(intervals){
  const out=[];for(const i of intervals.sort((a,b)=>a.fromGeometryFeet-b.fromGeometryFeet)){const last=out.at(-1);if(last&&i.fromGeometryFeet<=last.toGeometryFeet+1e-5){last.toGeometryFeet=Math.max(last.toGeometryFeet,i.toGeometryFeet);}else out.push({...i});}return out;
}
function insideRing(p,ring){
  let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[j],b=ring[i],r=sub(b,a),q=sub(p,a);
    if(Math.abs(cross(r,q))<EPS&&p[0]>=Math.min(a[0],b[0])-EPS&&p[0]<=Math.max(a[0],b[0])+EPS&&p[1]>=Math.min(a[1],b[1])-EPS&&p[1]<=Math.max(a[1],b[1])+EPS)return 'BOUNDARY';
    if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }return inside;
}
function polygonContains(p,rings){const outer=insideRing(p,rings[0]);return !!outer&&!rings.slice(1).some(r=>insideRing(p,r)===true);}
function validateCoordinates(geometry){
  let count=0;const walk=c=>{if(Array.isArray(c)&&typeof c[0]==='number'){if(++count>100000||c.length<2||c.length>3||!c.every(Number.isFinite)||Math.abs(c[0])>180||Math.abs(c[1])>80)throw Error('COORDINATE_RANGE_OR_POLAR_LIMIT');return;}if(!Array.isArray(c))throw Error('COORDINATES_REQUIRED');c.forEach(walk);};walk(geometry.coordinates);
}
function localSegment(a,b){if(Math.abs(a[0]-b[0])>2||Math.abs(a[1]-b[1])>2)throw Error('SEGMENT_EXTENT_OR_DATELINE_REQUIRES_GEOGRAPHIC_REVIEW');}
function nearestPair(a,b,c,d){
  const cos=Math.cos(((a[1]+b[1])/2)*Math.PI/180),metric=p=>[p[0]*cos,p[1]],A=metric(a),B=metric(b),C=metric(c),D=metric(d),candidates=[];
  const project=(p,x,y)=>{const dx=y[0]-x[0],dy=y[1]-x[1],l=dx*dx+dy*dy;return l?clamp(((p[0]-x[0])*dx+(p[1]-x[1])*dy)/l):0;};
  for(const [p,original] of [[C,c],[D,d]]){const t=project(p,A,B),q=lerp(A,B,t);candidates.push({t,routeCoordinate:lerp(a,b,t),sourceCoordinate:original,metricDistance:(p[0]-q[0])**2+(p[1]-q[1])**2});}
  for(const [p,t] of [[A,0],[B,1]]){const u=project(p,C,D),q=lerp(C,D,u);candidates.push({t,routeCoordinate:lerp(a,b,t),sourceCoordinate:lerp(c,d,u),metricDistance:(p[0]-q[0])**2+(p[1]-q[1])**2});}
  return candidates.sort((x,y)=>x.metricDistance-y.metricDistance)[0];
}

export function relateSpatialGeometry(branch,geometry,policy={},segmentId){
  const scale=branch.nativeRouteFeet/branch.spine.routeLengthFeet,conversion={nativeRouteFeet:branch.nativeRouteFeet,geometryRouteFeet:branch.spine.routeLengthFeet,nativeFeetPerGeometryFoot:scale,rule:'EXISTING_LAYER1_NATIVE_FOOTAGE_RECONCILIATION'};
  const unresolved=reason=>({relationship:'UNRESOLVED',contacts:[],intervals:[],nearest:null,unitReconciliation:conversion,qualifications:[reason],createsEngineeringScope:false});
  if(!geometry)return unresolved('NO_SUPPORTED_GEOMETRY');
  try{
    const complexity=g=>g?.type==='GeometryCollection'?g.geometries.reduce((n,p)=>n+complexity(p),0):g?.type==='Point'?1:g?.type==='LineString'?g.coordinates.length:g?.type==='Polygon'?g.coordinates.reduce((n,r)=>n+r.length,0):1;
    if(complexity(geometry)*branch.spine.segments.length>1000000)return unresolved('SPATIAL_RELATION_RESOURCE_LIMIT; SOURCE_RETAINED');
    if(geometry.type==='GeometryCollection'){
      const parts=geometry.geometries.map((g,index)=>({partIndex:index,...relateSpatialGeometry(branch,g,policy,segmentId)}));
      const relation=['AMBIGUOUS','CROSSES','OVERLAPS_ROUTE_INTERVAL','INTERSECTS','PARALLEL_ADJACENT','NEARBY_RESOURCE','POINT_PROJECTED'].find(r=>parts.some(p=>p.relationship===r))||(parts.every(p=>p.relationship==='GEOGRAPHICALLY_SEPARATE')?'GEOGRAPHICALLY_SEPARATE':'UNRESOLVED');
      return {relationship:relation,parts,contacts:parts.flatMap(p=>p.contacts.map(c=>({...c,partIndex:p.partIndex}))),intervals:parts.flatMap(p=>p.intervals.map(i=>({...i,partIndex:p.partIndex}))),unitReconciliation:conversion,qualifications:parts.flatMap(p=>p.qualifications),createsEngineeringScope:false};
    }
    validateCoordinates(geometry);
    for(const s of branch.spine.segments)localSegment(s.startCoordinate,s.endCoordinate);
    if(geometry.type==='Point'){
      const station=stationSourcePoint(branch,{type:'Point',coordinates:xy(geometry.coordinates)},segmentId),near=Number.isFinite(policy.nearbyFeet)&&station.offsetFeet<=policy.nearbyFeet;
      return {relationship:station.locationReviewRequired?'AMBIGUOUS':near?'NEARBY_RESOURCE':'POINT_PROJECTED',station,nearest:station,contacts:[],intervals:[],unitReconciliation:conversion,qualifications:['PROJECTION_IS_NOT_A_PHYSICAL_CONNECTION_OR_CROSSING'],createsEngineeringScope:false};
    }
    if(!['LineString','Polygon'].includes(geometry.type))return unresolved('GEOMETRY_TYPE_NOT_SUPPORTED');
    const rings=geometry.type==='Polygon'?geometry.coordinates:[geometry.coordinates],edges=[];
    for(const [ringIndex,line] of rings.entries()){
      if(line.length<2)throw Error('DEGENERATE_GEOMETRY');
      if(geometry.type==='Polygon'&&(line.length<4||line[0][0]!==line.at(-1)[0]||line[0][1]!==line.at(-1)[1]))throw Error('POLYGON_NOT_CLOSED');
      for(let i=1;i<line.length;i++){localSegment(line[i-1],line[i]);if(line[i-1][0]===line[i][0]&&line[i-1][1]===line[i][1])continue;edges.push({a:xy(line[i-1]),b:xy(line[i]),ringIndex,index:i-1});}
    }
    if(!edges.length)throw Error('DEGENERATE_GEOMETRY');
    let operations=0;
    if(geometry.type==='Polygon'){
      for(const [ri,ring] of rings.entries()){
        const area=ring.slice(1).reduce((n,p,i)=>n+ring[i][0]*p[1]-p[0]*ring[i][1],0);if(Math.abs(area)<EPS*EPS)throw Error('POLYGON_AREA_UNRESOLVED');
        for(let i=1;i<ring.length;i++)for(let j=i+2;j<ring.length;j++){
          if(++operations>250000)throw Error('GEOMETRY_VALIDITY_RESOURCE_LIMIT');if(i===1&&j===ring.length-1)continue;
          if(segmentIntersection(xy(ring[i-1]),xy(ring[i]),xy(ring[j-1]),xy(ring[j])))throw Error('SELF_INTERSECTING_POLYGON_REQUIRES_REVIEW');
        }
        if(ri&&insideRing(xy(ring[0]),rings[0])!==true)throw Error('POLYGON_HOLE_TOPOLOGY_REQUIRES_REVIEW');
      }
      for(let i=1;i<rings.length;i++)for(let j=i+1;j<rings.length;j++)if(insideRing(xy(rings[i][0]),rings[j])||insideRing(xy(rings[j][0]),rings[i]))throw Error('NESTED_POLYGON_HOLES_REQUIRE_REVIEW');
      // Crossing/touching rings cannot be treated as a reliable polygon union.
      for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++)if(edges[i].ringIndex!==edges[j].ringIndex){if(++operations>250000)throw Error('GEOMETRY_VALIDITY_RESOURCE_LIMIT');if(segmentIntersection(edges[i].a,edges[i].b,edges[j].a,edges[j].b))throw Error('POLYGON_RING_OVERLAP_REQUIRES_REVIEW');}
    }
    const contacts=[],intervals=[];let nearest=null,parallelEvidence=null;
    for(const s of branch.spine.segments){const a=s.startCoordinate,b=s.endCoordinate,breaks=[0,1];
      for(const e of edges){
        if(++operations>1000000)throw Error('SPATIAL_RELATION_RESOURCE_LIMIT');
        const hit=overlaps(box(a,b),box(e.a,e.b))?segmentIntersection(a,b,e.a,e.b):null;
        if(hit){breaks.push(hit.from,hit.to);if(hit.kind==='OVERLAP'){intervals.push({fromGeometryFeet:geometryStation(s,hit.from),toGeometryFeet:geometryStation(s,hit.to),boundaryOverlap:true});}else contacts.push({geometryMeasureFeet:geometryStation(s,hit.from),coordinate:lerp(a,b,hit.from),routeSegmentId:s.segmentId,sourceSegmentIndex:e.index,kind:hit.kind});}
        if(!hit){const pair=nearestPair(a,b,e.a,e.b);if(!nearest||pair.metricDistance<nearest.metricDistance)nearest={...pair,geometryMeasureFeet:geometryStation(s,pair.t)};
          const r=sub(b,a),q=sub(e.b,e.a),parallel=Math.abs(cross(r,q))<=EPS*Math.max(Math.hypot(...r)*Math.hypot(...q),EPS);
          if(parallel){const axis=Math.abs(r[0])>Math.abs(r[1])?0:1;if(Math.max(Math.min(a[axis],b[axis]),Math.min(e.a[axis],e.b[axis]))<Math.min(Math.max(a[axis],b[axis]),Math.max(e.a[axis],e.b[axis]))){const offsetFeet=routeLengthFeet([pair.sourceCoordinate,pair.routeCoordinate]);if(!parallelEvidence||offsetFeet<parallelEvidence.offsetFeet)parallelEvidence={routeSegmentId:s.segmentId,sourceSegmentIndex:e.index,offsetFeet};}}
        }
      }
      if(geometry.type==='Polygon'){
        const sorted=[...new Set(breaks)].sort((x,y)=>x-y);
        for(let i=1;i<sorted.length;i++)if(sorted[i]-sorted[i-1]>EPS&&polygonContains(lerp(a,b,(sorted[i]+sorted[i-1])/2),rings))intervals.push({fromGeometryFeet:geometryStation(s,sorted[i-1]),toGeometryFeet:geometryStation(s,sorted[i])});
      }
    }
    const unique=[];for(const c of contacts.sort((a,b)=>a.geometryMeasureFeet-b.geometryMeasureFeet))if(!unique.some(v=>Math.abs(v.geometryMeasureFeet-c.geometryMeasureFeet)<1e-5))unique.push({...c,measureFeet:c.geometryMeasureFeet*scale});
    const merged=mergeIntervals(intervals).map(i=>({...i,fromFeet:i.fromGeometryFeet*scale,toFeet:i.toGeometryFeet*scale,unit:'ROUTE_FEET'}));
    const wrap=branch.closed&&merged.length>1&&merged[0].fromFeet<1e-5&&Math.abs(merged.at(-1).toFeet-branch.nativeRouteFeet)<1e-5?{wrapsOrigin:true,fromFeet:merged.at(-1).fromFeet,toFeet:merged[0].toFeet,intervalIndices:[merged.length-1,0]}:null;
    if(nearest){nearest.offsetFeet=nearest.metricDistance===0?0:routeLengthFeet([nearest.sourceCoordinate,nearest.routeCoordinate]);nearest.measureFeet=nearest.geometryMeasureFeet*scale;delete nearest.metricDistance;}
    let relationship=merged.length?'OVERLAPS_ROUTE_INTERVAL':unique.some(c=>c.kind==='CROSSES')?'CROSSES':unique.length?'INTERSECTS':null;
    if(!relationship)relationship=parallelEvidence&&Number.isFinite(policy.adjacentFeet)&&parallelEvidence.offsetFeet<=policy.adjacentFeet?'PARALLEL_ADJACENT':Number.isFinite(policy.nearbyFeet)&&nearest?.offsetFeet<=policy.nearbyFeet?'NEARBY_RESOURCE':'GEOGRAPHICALLY_SEPARATE';
    return {relationship,contacts:unique,intervals:merged,wraparound:wrap,parallelEvidence,nearest:unique.length||merged.length?null:nearest,unitReconciliation:conversion,qualifications:['GEOMETRIC_RELATION_ONLY; NOT_ENGINEERING_TREATMENT',...(!unique.length&&!merged.length&&!Number.isFinite(policy.nearbyFeet)&&!Number.isFinite(policy.adjacentFeet)?['PROXIMITY_DISPLAY_THRESHOLD_NOT_REVIEWED']:[])],createsEngineeringScope:false};
  }catch(e){return unresolved(e.message);}
}

export function relateSourceInterval(branch,interval){
  const total=branch.nativeRouteFeet,scale=total/branch.spine.routeLengthFeet;
  if(interval.branchId!==branch.branchId||interval.spineRevisionHash!==branch.spineRevisionHash)return {relationship:'UNRESOLVED',contacts:[],intervals:[],qualifications:['SOURCE_INTERVAL_SPINE_REVISION_MISMATCH'],createsEngineeringScope:false};
  const {fromFeet,toFeet}=interval;
  if(interval.unit!=='ROUTE_FEET'||![fromFeet,toFeet].every(v=>Number.isFinite(v)&&v>=0&&v<=total)||(!branch.closed&&toFeet<fromFeet))return {relationship:'UNRESOLVED',contacts:[],intervals:[],qualifications:['SOURCE_INTERVAL_DIMENSION_OR_RANGE_UNRESOLVED'],createsEngineeringScope:false};
  const intervals=(fromFeet>toFeet?[[fromFeet,total],[0,toFeet]]:[[fromFeet,toFeet]]).map(([fromFeet,toFeet])=>({fromFeet,toFeet,fromGeometryFeet:fromFeet/scale,toGeometryFeet:toFeet/scale,unit:'ROUTE_FEET'}));
  return {relationship:'OVERLAPS_ROUTE_INTERVAL',contacts:[],intervals,wraparound:fromFeet>toFeet?{wrapsOrigin:true,fromFeet,toFeet}:null,unitReconciliation:{nativeRouteFeet:total,geometryRouteFeet:branch.spine.routeLengthFeet,nativeFeetPerGeometryFoot:scale},qualifications:['SOURCE_PROPOSED_INTERVAL; NOT_APPROVED_CONSTRUCTION_METHOD'],createsEngineeringScope:false};
}
