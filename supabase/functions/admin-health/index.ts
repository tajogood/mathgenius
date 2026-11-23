// Admin-only health inspection. No secrets ever reach the browser.
// Optional SERVER_METRICS_URL points at a trusted HTTPS metrics agent,
// configured exclusively as an Edge Function secret (not user supplied).
import {createClient} from 'npm:@supabase/supabase-js@2';

const url=Deno.env.get('SUPABASE_URL')??'';
const anonKey=Deno.env.get('SUPABASE_ANON_KEY')??'';
const origin=Deno.env.get('APP_ORIGIN')??'';
const monitoredApp=Deno.env.get('MONITORED_APP_URL')??origin;
const metricsEndpoint=Deno.env.get('SERVER_METRICS_URL')??'';
const metricsToken=Deno.env.get('SERVER_METRICS_BEARER')??'';

const CORS={
  'Access-Control-Allow-Origin':origin,
  'Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods':'POST,OPTIONS',
  'Content-Type':'application/json;charset=utf-8',
  'Cache-Control':'no-store',
  'Vary':'Origin',
};
function result(status:number,payload:Record<string,unknown>){
  return new Response(JSON.stringify(payload),{status,headers:CORS});
}
type Probe={state:'ok'|'down'|'unconfigured';latency_ms:number|null;status_code:number|null};
async function ping(target:string):Promise<Probe>{
  if(!target || !target.startsWith('https://'))
    return {state:'unconfigured',latency_ms:null,status_code:null};
  const begin=performance.now();
  try{
    const res=await fetch(target,{method:'HEAD',redirect:'error',signal:AbortSignal.timeout(4000)});
    return {state:res.ok?'ok':'down',
      latency_ms:Math.round(performance.now()-begin),status_code:res.status};
  }catch{
    return {state:'down',latency_ms:Math.round(performance.now()-begin),status_code:null};
  }
}
function boundedMetric(x:unknown,max=1e16):number|null{
  return typeof x==='number' && Number.isFinite(x) && x>=0 && x<=max?x:null;
}
Deno.serve(async(req)=>{
  const requestOrigin=req.headers.get('origin')??'';
  if(!origin || requestOrigin!==origin)return result(403,{error:'허용되지 않은 요청 출처입니다.'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
  if(req.method!=='POST')return result(405,{error:'POST 요청만 지원합니다.'});
  if(!url||!anonKey)return result(503,{error:'운영 모니터링 설정이 누락되었습니다.'});
  const jwt=/^Bearer\s+(.+)$/i.exec(req.headers.get('authorization')??'')?.[1];
  if(!jwt)return result(401,{error:'운영자 로그인이 필요합니다.'});
  const adminClient=createClient(url,anonKey,{
    auth:{persistSession:false,autoRefreshToken:false},
    global:{headers:{Authorization:'Bearer '+jwt}},
  });
  const {data:{user},error:userError}=await adminClient.auth.getUser(jwt);
  if(userError || !user)return result(401,{error:'로그인 세션을 확인할 수 없습니다.'});
  const {data:isAdmin,error:adminError}=await adminClient.rpc('is_site_admin');
  if(adminError || isAdmin!==true)return result(403,{error:'관리자 접근 권한이 없습니다.'});

  const dbStart=performance.now();
  const [{error:dbError},app]=await Promise.all([
    adminClient.rpc('admin_health_ping'),
    ping(monitoredApp),
  ]);
  const database:Probe={state:dbError?'down':'ok',
    latency_ms:Math.round(performance.now()-dbStart),status_code:null};

  let serverMetrics:Record<string,number|null>|null=null;
  let serverMetricsStatus:'connected'|'unconfigured'|'error'='unconfigured';
  if(metricsEndpoint && metricsEndpoint.startsWith('https://')){
    try{
      const r=await fetch(metricsEndpoint,{
        method:'GET',redirect:'error',
        headers:{'Accept':'application/json',...(metricsToken?{Authorization:'Bearer '+metricsToken}:{})},
        signal:AbortSignal.timeout(4000),
      });
      if(!r.ok)throw new Error('metrics unavailable');
      const metrics=await r.json() as Record<string,unknown>;
      // Allowlist numeric fields only: never forward any sensitive
      // data, IP addresses, host names, process names or raw payloads.
      serverMetrics={
        cpu_pct:boundedMetric(metrics.cpu_pct,100),
        memory_used_bytes:boundedMetric(metrics.memory_used_bytes),
        memory_total_bytes:boundedMetric(metrics.memory_total_bytes),
        disk_used_bytes:boundedMetric(metrics.disk_used_bytes),
        disk_total_bytes:boundedMetric(metrics.disk_total_bytes),
        network_rx_bytes_per_sec:boundedMetric(metrics.network_rx_bytes_per_sec),
        network_tx_bytes_per_sec:boundedMetric(metrics.network_tx_bytes_per_sec),
        uptime_seconds:boundedMetric(metrics.uptime_seconds),
      };
      serverMetricsStatus='connected';
    }catch{serverMetricsStatus='error';}
  }
  return result(200,{
    as_of:new Date().toISOString(),
    application:app,database,
    metrics_status:serverMetricsStatus,
    metrics:serverMetrics,
    notice:'서버 CPU·메모리 및 네트워크 트래픽은 별도 호스트 모니터링 에이전트가 있어야 조회됩니다.',
  });
});
