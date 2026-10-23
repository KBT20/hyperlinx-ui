import {useEffect,useState,useRef} from 'react';
import {withStoredAuthHeaders} from '../api/authHeaders';
import type {IofArtifact,IofExport} from '../api/plannerIof';
import {PlannerIofResearch} from './PlannerIofResearch';

type Selection={branchId:string;observationId:string;reviewStatus:string;reviewNote:string;segmentId?:string};
type Branch={branchId:string;productId:string;branchRole:string;routeId:string;spineRevisionHash:string};
type Observation={observationId:string;category:string;observation:string;sourceFeatureId:string;verificationStatus:string;source:{artifactId:string;sha256:string;revision:string};sourceLocator:string;sourceDescription?:string;spatialType?:string};
type Feature={featureId:string;branchId:string;branchRole:string;observation:Observation;station?:{stationLabel:string;measureFeet:number;offsetFeet:number;locationReviewRequired:boolean;nearestAddresses:Array<{segmentId:string;measureFeet:number}>};spatialRelation?:Record<string,unknown>;review:{status:string};engineeringActions:Array<{actionId:string;requirement:string}>};
type Revision={features:Feature[];input:{selections:Selection[];schemaVersion?:string;relationshipPolicy?:{nearbyFeet?:number|null;adjacentFeet?:number|null}};coverage:string};
type State={artifactHash:string;branches:Branch[];observations:Observation[];revision:Revision|null;acknowledgementText:string;issues:unknown[]};

export function PlannerIofEnrichment({accountId,exportId,artifactHash,onSaved,onDraftChange,disabled=false}:{accountId:string;exportId:string;artifactHash:string;onSaved:(saved:IofExport&{snapshot:IofArtifact})=>void;onDraftChange:(dirty:boolean)=>void;disabled?:boolean}){
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const [state,setState]=useState<State|null>(null),[selections,setSelections]=useState<Selection[]>([]),[branch,setBranch]=useState(''),[observation,setObservation]=useState(''),[reason,setReason]=useState(''),[ack,setAck]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[preview,setPreview]=useState<Revision|null>(null),[requestId,setRequestId]=useState(()=>crypto.randomUUID());
  const [rich,setRich]=useState(false),[nearby,setNearby]=useState(''),[adjacent,setAdjacent]=useState('');
  async function request<T>(suffix:string,body?:unknown,signal?:AbortSignal):Promise<T>{
    const response=await fetch(`/api/network-planning/planner/iof/exports/${encodeURIComponent(exportId)}/enrichment${suffix}`,{method:body?'POST':'GET',credentials:'same-origin',headers:{...withStoredAuthHeaders(),'X-Planning-Account-Id':accountId,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal});
    const value=await response.json();if(!response.ok)throw Error(value.error||`IOF_ENRICHMENT_HTTP_${response.status}`);return value as T;
  }
  useEffect(()=>{const controller=new AbortController();void request<State>('',undefined,controller.signal).then(s=>{if(controller.signal.aborted)return;setState(s);setSelections(s.revision?.input.selections||[]);setPreview(s.revision);setRich(s.revision?.input.schemaVersion==='IOF-RICH-ENRICHMENT-INPUT-R2');setNearby(s.revision?.input.relationshipPolicy?.nearbyFeet?.toString()||'');setAdjacent(s.revision?.input.relationshipPolicy?.adjacentFeet?.toString()||'');}).catch(e=>{if(!controller.signal.aborted)setNotice(String(e.message));});return()=>controller.abort();},[accountId,exportId]);
  function edited(next:Selection[]){setSelections(next);setPreview(null);setAck(false);setRequestId(crypto.randomUUID());onDraftChange(true);}
  async function run(save:boolean){setBusy(true);try{
    const input={providerId:'OFFLINE',reason,selections,...(rich?{schemaVersion:'IOF-RICH-ENRICHMENT-INPUT-R2',relationshipPolicy:{nearbyFeet:nearby.trim()?Number(nearby):null,adjacentFeet:adjacent.trim()?Number(adjacent):null}}:{})};
    if(save){const saved=await request<IofExport&{snapshot:IofArtifact}>('/revision',{expectedArtifactHash:artifactHash,input,requestId,integrationPolicy:'IOF-SPATIAL-MANIFEST-R3B',acknowledgementText:state?.acknowledgementText});if(!mounted.current)return;onDraftChange(false);onSaved(saved);}
    else{setPreview(await request<Revision>('/preview',input));setNotice('Unsaved preliminary review. Source claims remain unverified; no scope or cost was added.');}
  }catch(e){setNotice(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
  async function downloadReview(){setBusy(true);try{const response=await fetch(`/api/network-planning/planner/iof/exports/${encodeURIComponent(exportId)}/enrichment/review.kmz`,{credentials:'same-origin',headers:{...withStoredAuthHeaders(),'X-Planning-Account-Id':accountId}});if(!response.ok)throw Error('Review KMZ unavailable');const url=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=url;a.download='iof-enrichment-review.kmz';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setNotice(String(e));}finally{setBusy(false);}}
  return <section aria-label="Stationed IOF enrichment">
    <h3>Route evidence and engineering actions</h3>
    <p>Attach saved source observations to an exact native branch and Spine revision. Review records preliminary use; it does not verify a crossing or approve its treatment. Deterministic enrichment uses offline evidence; provider readiness and bounded research appear below.</p>
    <p role="status">{notice}</p><p>Saving creates a new integrated package for the map and internal outputs. Existing proposals, prices and source geometry remain unchanged. For a saved commercial strategy, reopen its source package before revising enrichment.</p>
    {state?.revision?<button disabled={busy} onClick={()=>void downloadReview()}>Download saved enrichment review KMZ</button>:null}
    {state?<><p>{state.branches.length} native branches · {state.observations.length} available source observations. Coverage is limited to selected evidence.</p>
      {!state.branches.length?<p>Native Layer-1 branch revisions are required. A scope-only package cannot be enriched as a spatially defined route.</p>:null}
      {!state.observations.length?<p>No supported saved point evidence is available for this Account and Opportunity. Missing evidence does not mean no constraints exist.</p>:null}
      <fieldset disabled={busy||disabled}><legend>Select source-backed observations</legend>
        <label>Product branch<select aria-label="Enrichment branch" value={branch} onChange={e=>setBranch(e.target.value)}><option value="">Choose branch</option>{state.branches.map(b=><option key={b.branchId} value={b.branchId}>{b.productId} · {b.branchRole} · {b.routeId}</option>)}</select></label>
        <label>Saved observation<select aria-label="Enrichment observation" value={observation} onChange={e=>{setObservation(e.target.value);if(state.observations.find(o=>o.observationId===e.target.value)?.spatialType)setRich(true);}}><option value="">Choose source observation</option>{state.observations.map(o=><option key={o.observationId} value={o.observationId}>{o.spatialType||o.category} · {o.observation.slice(0,90)} · {o.sourceFeatureId}</option>)}</select></label>
        <label><input type="checkbox" checked={rich} onChange={e=>{setRich(e.target.checked);edited(selections);}}/>Rich spatial relationships (R2); names and colors remain unclassified source claims</label>
        {rich?<><p>Optional display-proximity thresholds in feet. Blank means no proximity classification. These do not create construction scope or engineering facts.</p><label>Nearby resource distance<input aria-label="Nearby display feet" type="number" min="0" value={nearby} onChange={e=>{setNearby(e.target.value);edited(selections);}}/></label><label>Parallel-adjacent distance<input aria-label="Adjacent display feet" type="number" min="0" value={adjacent} onChange={e=>{setAdjacent(e.target.value);edited(selections);}}/></label></>:null}
        <button disabled={!branch||!observation||selections.some(s=>s.branchId===branch&&s.observationId===observation)} onClick={()=>edited([...selections,{branchId:branch,observationId:observation,reviewStatus:'PENDING',reviewNote:''}])}>Attach observation</button>
        {selections.map((s,index)=>{const o=state.observations.find(v=>v.observationId===s.observationId),b=state.branches.find(v=>v.branchId===s.branchId),feature=preview?.features.find(f=>f.observation.observationId===s.observationId&&f.branchId===s.branchId);return <div key={`${s.branchId}:${s.observationId}`}>
          <h4>{b?.branchRole} · {o?.category} · {o?.sourceFeatureId}</h4><p>{o?.observation}</p><p>{o?.verificationStatus} · Source revision {o?.source.revision} · {o?.sourceLocator}</p><code>{o?.source.sha256}</code><p>Spine revision: <code>{b?.spineRevisionHash}</code></p>
          {o?.sourceDescription?<details><summary>Original source description — unverified claim</summary><pre style={{whiteSpace:'pre-wrap'}}>{o.sourceDescription}</pre></details>:null}
          <label>Preliminary review<select aria-label={`Evidence review ${index+1}`} value={s.reviewStatus} onChange={e=>edited(selections.map((v,i)=>i===index?{...v,reviewStatus:e.target.value}:v))}>{['PENDING','REVIEWED_PRELIMINARY','REJECTED'].map(v=><option key={v}>{v}</option>)}</select></label>
          <label>Review note<input aria-label={`Evidence review note ${index+1}`} value={s.reviewNote} onChange={e=>edited(selections.map((v,i)=>i===index?{...v,reviewNote:e.target.value}:v))}/></label>
          {feature?<>{feature.station?<><p>{feature.station.stationLabel} · {feature.station.measureFeet.toFixed(3)} route feet · source offset {feature.station.offsetFeet.toFixed(3)} feet</p>{feature.station.locationReviewRequired?<label>Resolve ambiguous station address<select aria-label={`Evidence segment ${index+1}`} value={s.segmentId||''} onChange={e=>edited(selections.map((v,i)=>i===index?{...v,segmentId:e.target.value}:v))}><option value="">Choose source segment</option>{feature.station.nearestAddresses.map(a=><option key={a.segmentId} value={a.segmentId}>{a.segmentId} · {a.measureFeet.toFixed(3)} feet</option>)}</select></label>:null}</>:null}{feature.spatialRelation?<details open><summary>{String(feature.spatialRelation.relationship)} — deterministic spatial evidence</summary><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(feature.spatialRelation,null,2)}</pre></details>:null}<ul>{feature.engineeringActions.map(a=><li key={a.actionId}>{a.requirement} — UNRESOLVED</li>)}</ul></>:null}
          <button onClick={()=>edited(selections.filter((_,i)=>i!==index))}>Remove attachment</button>
        </div>;})}
        <label>Revision reason<input aria-label="Enrichment revision reason" value={reason} onChange={e=>{setReason(e.target.value);setRequestId(crypto.randomUUID());setAck(false);onDraftChange(true);}}/></label>
        <button disabled={!reason.trim()||!state.branches.length} onClick={()=>void run(false)}>Preview stationed evidence</button>
        <label><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>{state.acknowledgementText}</label>
        <button disabled={!ack||!reason.trim()||!state.branches.length} onClick={()=>void run(true)}>Save enrichment package revision</button>
      </fieldset>
      <p>Unsupported source geometry records: {state.issues.length}. Original financials and physical quantities remain unchanged. No customer acceptance is created.</p>
      {state.issues.length?<details><summary>Unresolved source geometry and engineering qualifications</summary><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(state.issues,null,2)}</pre></details>:null}
    </>:null}
    <PlannerIofResearch key={`${accountId}:${exportId}`} accountId={accountId} exportId={exportId} artifactHash={artifactHash} disabled={disabled||busy}/>
  </section>;
}
