import {boundedHttp,researchError as error} from './iof-research-http.js';
import {createHash} from 'node:crypto';
export const FINDING_KINDS=['DIRECT_SOURCE_FACT','MODEL_INTERPRETATION','UNVERIFIED_LEAD','UNRESOLVED_QUESTION'];
export const FINDINGS_SCHEMA={type:'object',additionalProperties:false,required:['findings','qualifications'],properties:{findings:{type:'array',maxItems:30,items:{type:'object',additionalProperties:false,required:['kind','text','sourceIds'],properties:{kind:{type:'string',enum:FINDING_KINDS},text:{type:'string'},sourceIds:{type:'array',items:{type:'string'}}}}},qualifications:{type:'array',items:{type:'string'}}}};
const number=value=>value!==undefined&&value!==''&&Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;
export function researchConfiguration(env=process.env){
  const provider=id=>{const prefix=`IOF_RESEARCH_${id}_`,key=env[prefix+'API_KEY']||(id==='OPENAI'?env.OPENAI_API_KEY:undefined);
    return {providerId:id,endpoint:id==='OPENAI'?'https://api.openai.com/v1':env[prefix+'ENDPOINT'],model:env[prefix+'MODEL'],apiKey:key,enabled:env[prefix+'ENABLED']==='true',tokenParameter:id==='L40S'&&env[prefix+'TOKEN_PARAMETER']==='max_tokens'?'max_tokens':'max_completion_tokens',inputUsdPerMillion:number(env[prefix+'INPUT_USD_PER_MILLION']),outputUsdPerMillion:number(env[prefix+'OUTPUT_USD_PER_MILLION']),priceRevision:env[prefix+'PRICE_REVISION']||null};};
  const domains=(env.IOF_RESEARCH_PUBLIC_DOMAINS||'www.eia.gov,api.eia.gov,www.usgs.gov,apps.nationalmap.gov,services.nationalmap.gov,www.nrcs.usda.gov,gdg.sc.egov.usda.gov,www.fema.gov,services.arcgis.com').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  return {providers:['L40S','OPENAI'].map(provider),domains,search:{enabled:env.IOF_RESEARCH_SEARCH_ENABLED==='true',apiKey:env.IOF_RESEARCH_BRAVE_API_KEY,usdPerCall:number(env.IOF_RESEARCH_SEARCH_USD_PER_CALL),priceRevision:env.IOF_RESEARCH_SEARCH_PRICE_REVISION||null},liveAuthorized:env.IOF_RESEARCH_LIVE_AUTHORIZED==='true'};
}
export function providerStatus(config){
  return config.providers.map(p=>{let endpointValid=false;try{const u=new URL(p.endpoint);endpointValid=['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&!u.search&&!u.hash&&(p.providerId!=='OPENAI'||u.origin==='https://api.openai.com');}catch{}
    const configured=Boolean(p.model&&endpointValid&&(p.providerId!=='OPENAI'||p.apiKey));
    return {providerId:p.providerId,model:p.model||null,configured,enabled:p.enabled,readiness:configured?'NOT_VERIFIED':'NOT_CONFIGURED',inference:'NOT_VERIFIED',liveAuthorized:config.liveAuthorized,costAuthority:p.inputUsdPerMillion!==null&&p.outputUsdPerMillion!==null&&Boolean(p.priceRevision)};
  });
}
export function assertNoResearchSecrets(value,config){
  const serialized=JSON.stringify(value),secrets=[...config.providers.map(p=>p.apiKey),config.search?.apiKey].filter(Boolean);
  if(secrets.some(secret=>serialized.includes(secret)||serialized.includes(encodeURIComponent(secret))))throw error('RESEARCH_SENSITIVE_RESPONSE_REJECTED',502);
}
export async function checkResearchProvider(p,{http=boundedHttp,signal}={}){
  if(!providerStatus({providers:[p],liveAuthorized:false})[0].configured)throw error('RESEARCH_PROVIDER_NOT_CONFIGURED');
  const result=await http(p.endpoint.replace(/\/$/,'')+'/models',{signal,timeoutMs:5000,maxBytes:65536,headers:p.apiKey?{Authorization:`Bearer ${p.apiKey}`}:{}});
  if(result.status!==200)throw error(result.status===401||result.status===403?'RESEARCH_PROVIDER_AUTH_FAILED':'RESEARCH_PROVIDER_UNAVAILABLE',502);
  let body;try{body=JSON.parse(result.bytes.toString('utf8'));}catch{throw error('RESEARCH_PROVIDER_INVALID_RESPONSE',502);}
  const found=Array.isArray(body.data)&&body.data.some(m=>m.id===p.model);
  return {providerId:p.providerId,readiness:found?'MODEL_ADVERTISED_INFERENCE_NOT_VERIFIED':'MODEL_NOT_ADVERTISED',inference:'NOT_VERIFIED',checkedAt:new Date().toISOString()};
}
export async function inferResearch(p,messages,tools,{http=boundedHttp,signal,maxOutputTokens=1024,onAttempt=()=>{},responseSchema=FINDINGS_SCHEMA,responseName='iof_research_findings',reasoningEffort,timeoutMs=10000}={}){
  const payload={model:p.model,messages,max_completion_tokens:maxOutputTokens,stream:false,store:false,tools,tool_choice:tools.length?'auto':'none',parallel_tool_calls:false,response_format:{type:'json_schema',json_schema:{name:'iof_research_findings',strict:true,schema:FINDINGS_SCHEMA}}};
  if(p.tokenParameter==='max_tokens'){payload.max_tokens=maxOutputTokens;delete payload.max_completion_tokens;}
  payload.response_format.json_schema={name:responseName,strict:true,schema:responseSchema};
  if(reasoningEffort)payload.reasoning_effort=reasoningEffort;
  if(!tools.length){delete payload.tools;delete payload.tool_choice;delete payload.parallel_tool_calls;}
  let result;
  for(let attempt=0;attempt<2;attempt++){
    await onAttempt(payload,attempt);
    try{result=await http(p.endpoint.replace(/\/$/,'')+'/chat/completions',{method:'POST',signal,timeoutMs,maxBytes:131072,headers:{'content-type':'application/json',...(p.apiKey?{Authorization:`Bearer ${p.apiKey}`}:{})},body:JSON.stringify(payload)});}
    catch(e){throw e?.code?.startsWith('RESEARCH_')?e:error('RESEARCH_PROVIDER_TRANSPORT_FAILED',502);}
    if([429,502,503,504].includes(result.status)&&attempt===0)continue;
    if(result.status!==200)throw error(result.status===401||result.status===403?'RESEARCH_PROVIDER_AUTH_FAILED':result.status===429?'RESEARCH_PROVIDER_RATE_LIMIT':result.status>=500?'RESEARCH_PROVIDER_UNAVAILABLE':'RESEARCH_PROVIDER_REQUEST_REJECTED',502);
    break;
  }
  let data;try{data=JSON.parse(result.bytes.toString('utf8'));}catch{throw error('RESEARCH_PROVIDER_INVALID_JSON',502);}
  const c=data.choices?.[0];if(!c?.message||!['stop','tool_calls'].includes(c.finish_reason)||c.message.refusal)throw error('RESEARCH_PROVIDER_INCOMPLETE',502);
  const usage=data.usage;
  const sha=v=>createHash('sha256').update(v).digest('hex');
  return {message:c.message,model:data.model||p.model,requestHash:sha(JSON.stringify(payload)),responseHash:sha(result.bytes),systemFingerprint:typeof data.system_fingerprint==='string'?data.system_fingerprint:null,usage:usage&&[usage.prompt_tokens,usage.completion_tokens].every(n=>Number.isSafeInteger(n)&&n>=0)?{inputTokens:usage.prompt_tokens,outputTokens:usage.completion_tokens}:null};
}
