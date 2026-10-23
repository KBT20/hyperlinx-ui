// Server-only bounded HTTP. Public research and operator-configured inference
// are distinct trust domains. Model arguments can never select inference URLs.
import https from 'node:https';
import http from 'node:http';
import dns from 'node:dns/promises';
import {isIP,BlockList} from 'node:net';
export function researchError(code,status=422){return Object.assign(new Error(code),{code,status});}
const blocked=new BlockList();
for(const [ip,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',3]])blocked.addSubnet(ip,prefix,'ipv4');
const v6Global=new BlockList();v6Global.addSubnet('2000::',3,'ipv6');
for(const [ip,prefix] of [['2001::',23],['2001:db8::',32],['2002::',16],['3fff::',20]])blocked.addSubnet(ip,prefix,'ipv6');
export function publicAddress(ip){const family=isIP(ip);return family===4?!blocked.check(ip,'ipv4'):family===6&&v6Global.check(ip,'ipv6')&&!blocked.check(ip,'ipv6');}
export function publicUrl(value,domains){
  let u;try{u=new URL(value);}catch{throw researchError('RESEARCH_URL_INVALID');}
  if(u.protocol!=='https:'||u.username||u.password||u.hash||u.port&&u.port!=='443'||isIP(u.hostname.replace(/^\[|\]$/g,''))||!domains.includes(u.hostname)||u.hostname.endsWith('.'))throw researchError('RESEARCH_URL_POLICY_DENIED');
  if(u.href.length>2048)throw researchError('RESEARCH_URL_TOO_LONG');
  if([...u.searchParams.keys()].some(k=>/^(token|access_token|api[_-]?key|password|authorization|credential|secret)$/i.test(k)))throw researchError('RESEARCH_URL_CREDENTIAL_DENIED');
  return u;
}
export async function resolvePublic(host,lookup=dns.lookup){
  const addresses=await lookup(host,{all:true,verbatim:true});
  if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw researchError('RESEARCH_DNS_POLICY_DENIED');
  return addresses[0];
}
export async function boundedHttp(url,{method='GET',headers={},body,signal,timeoutMs=8000,maxBytes=262144,publicDomains=null}={}){
  const u=publicDomains?publicUrl(url,publicDomains):new URL(url);
  if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.hash)throw researchError('RESEARCH_ENDPOINT_INVALID');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)controller.abort();
  try{
    if(controller.signal.aborted)throw researchError('RESEARCH_TIMEOUT');
    // Pin the resolved address to this connection; redirects are never automatic.
    const pinned=publicDomains?await Promise.race([resolvePublic(u.hostname),new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(researchError('RESEARCH_TIMEOUT')),{once:true}))]):null;
    if(controller.signal.aborted)throw researchError('RESEARCH_TIMEOUT');
    return await new Promise((resolve,reject)=>{
      const req=(u.protocol==='https:'?https:http).request(u,{method,headers:{'accept-encoding':'identity',...headers},signal:controller.signal,agent:false,...(pinned?{lookup:(_host,options,cb)=>cb(null,options?.all?[pinned]:pinned.address,pinned.family)}:{})},res=>{
        const chunks=[];let size=0;
        res.on('data',chunk=>{size+=chunk.length;if(size>maxBytes){req.destroy();reject(researchError('RESEARCH_RESPONSE_TOO_LARGE'));}else chunks.push(chunk);});
        res.on('error',()=>reject(researchError('RESEARCH_TRANSPORT_FAILURE',502)));
        res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,bytes:Buffer.concat(chunks)}));
      });
      req.on('error',e=>reject(e?.code?.startsWith('RESEARCH_')?e:researchError(controller.signal.aborted?'RESEARCH_TIMEOUT':'RESEARCH_TRANSPORT_FAILURE',502)));
      req.end(body);
    });
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
