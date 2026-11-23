// Supabase Edge Function: send-guardian-consent
// Deploy with JWT verification enabled. This function NEVER approves consent.
// Resend sends only the request email; a human operator must verify the
// LEGAL GUARDIAN's explicit reply before service_role marks it verified.
// Secrets (RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY) never enter VITE_*.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL=Deno.env.get('SUPABASE_URL') ?? '';
const PUBLIC_KEY=Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const EMAIL_KEY=Deno.env.get('RESEND_API_KEY') ?? '';
const FROM=Deno.env.get('CONSENT_FROM_EMAIL') ?? '';
const REPLY_TO=Deno.env.get('CONSENT_REPLY_TO_EMAIL') ?? '';
const APP_ORIGIN=Deno.env.get('APP_ORIGIN') ?? '';
const CONSENT_ENABLED=Deno.env.get('GUARDIAN_CONSENT_ENABLED') === 'true';

const CORS={
  'Access-Control-Allow-Origin':APP_ORIGIN,
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Vary':'Origin',
};
function json(status:number,data:Record<string,unknown>){
  return new Response(JSON.stringify(data),{status,headers:{...CORS,'Content-Type':'application/json'}});
}
function esc(value:string){
  return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] ?? c));
}
function mailContent(name:string,requestId:string){
  const disclosure=[
    '수학천재 법정대리인 개인정보 처리 동의 요청',
    '',
    '보호자 성명: '+name,
    '요청번호: '+requestId,
    '개인정보 처리자: 주식회사 라릭(수학천재)',
    '대상: 연결 요청된 만 14세 미만 학생의 회원 계정',
    '수집 항목: 소셜 인증 식별자, 닉네임, 학년, 만 14세 미만 여부, 동의 이력',
    '학습정보: 단원 방문·정오답·반복 학습·교구 활동·학습 시간·숙제',
    '이용 목적: 학생 계정 유지, 개념 학습·추천, 연결 학부모의 학습 현황 조회와 숙제 관리',
    '이용자 권리: 동의 거부 가능, 동의 거부 시 회원 학습기록 서비스 제한(GUEST 이용 가능),',
    '동의 철회 시 이후 학습 서비스 접근 중지 및 관련 기록 삭제 요청 가능',
    '보유/삭제: 회원 탈퇴·삭제 청구 시 관계 법령상 의무를 제외하고 삭제하는 방향으로 설계 중',
    '주의: 운영 전 개인정보처리방침 및 보존기간, 문의처, 개인정보 처리 위탁/국외이전 고지 확정 필요',
    '',
    '[동의 방법]',
    '1. 위 내용을 확인하고 해당 학생의 법정대리인인 경우에만 이 메일에 답장하세요.',
    '2. 메일 답장 본문에 다음 문구를 직접 적어 보내 주세요.',
    '   "저는 해당 학생의 법정대리인이며 위 개인정보 수집·이용에 동의합니다. 요청번호: '+requestId+'"',
    '3. 운영자가 수신한 동의 회신을 확인하기 전에는 아동 회원 서비스가 잠겨 있습니다.',
    '',
    '동의하지 않는 경우 답장하지 않거나 "동의하지 않습니다"로 회신해 주세요.',
    '이 메일은 승인 완료 통지가 아닌 동의 확인 요청입니다.',
    '법적 근거: 개인정보 보호법 제22조의2, 시행령 제17조의2 제1항.',
  ];
  return disclosure.join('\n');
}
Deno.serve(async req=>{
  const origin=req.headers.get('origin') ?? '';
  if(req.method==='OPTIONS'){
    if(!APP_ORIGIN || origin!==APP_ORIGIN) return json(403,{error:'Origin not allowed'});
    return new Response(null,{status:204,headers:CORS});
  }
  if(req.method!=='POST')return json(405,{error:'POST required'});
  if(!APP_ORIGIN || origin!==APP_ORIGIN)return json(403,{error:'Origin not allowed'});
  if(!CONSENT_ENABLED || !SUPABASE_URL || !PUBLIC_KEY || !SERVICE_KEY ||
    !EMAIL_KEY || !FROM || !REPLY_TO)return json(503,{error:'법정대리인 동의 이메일 서비스를 준비 중입니다.'});

  const match=/^Bearer\s+(.+)$/i.exec(req.headers.get('authorization')??'');
  if(!match)return json(401,{error:'로그인이 필요합니다'});
  const publicClient=createClient(SUPABASE_URL,PUBLIC_KEY,{
    auth:{persistSession:false,autoRefreshToken:false},
  });
  const {data:{user},error:authError}=await publicClient.auth.getUser(match[1]);
  if(authError || !user)return json(401,{error:'유효하지 않은 학부모 로그인입니다.'});
  let requestId:string;
  try {
    const payload=await req.json();
    requestId=String(payload.request_id??'');
  } catch {return json(400,{error:'요청 형식이 잘못되었습니다.'});}
  if(!/^[0-9a-f-]{36}$/i.test(requestId))return json(400,{error:'동의 요청번호가 유효하지 않습니다.'});

  const admin=createClient(SUPABASE_URL,SERVICE_KEY,{
    auth:{persistSession:false,autoRefreshToken:false},
  });
  const {data:record,error:readError}=await admin.from('guardian_consent_requests')
    .select('id,parent_id,guardian_name,guardian_email,status,terms_version')
    .eq('id',requestId).eq('parent_id',user.id).maybeSingle();
  if(readError || !record)return json(404,{error:'이 계정의 동의 요청을 찾을 수 없습니다.'});
  if(record.status==='sent' || record.status==='verified')return json(200,{sent:true});
  if(record.status!=='requested')return json(409,{error:'현재 발송할 수 없는 요청입니다.'});
  if(record.terms_version!=='draft-2026-11-23')return json(409,{error:'동의 문서 버전이 일치하지 않습니다.'});

  const {data:claimed,error:claimError}=await admin.rpc('claim_guardian_consent_delivery',{
    p_request:record.id,p_parent:user.id,
  });
  if(claimError)return json(500,{error:'발송 준비 중 문제가 발생했습니다.'});
  if(!claimed)return json(409,{error:'이미 이메일 발송이 진행 중입니다.'});

  const text=mailContent(record.guardian_name,record.id);
  let delivered=false;
  try {
    const sent=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{'Authorization':'Bearer '+EMAIL_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({
        from:FROM,to:[record.guardian_email],reply_to:REPLY_TO,
        subject:'[수학천재] 만 14세 미만 학생 법정대리인 동의 확인 요청',
        text,
      }),
    });
    delivered=sent.ok;
    if(!delivered)console.error('Guardian consent email provider status',sent.status);
  } catch(e){
    console.error('Guardian consent email send failure',e instanceof Error?e.name:'unknown');
  }
  const {error:finishError}=await admin.rpc('finish_guardian_consent_delivery',{
    p_request:record.id,p_sent:delivered,
  });
  if(finishError || !delivered)return json(502,{error:'동의 요청 이메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.'});
  return json(200,{sent:true,message:'학부모 이메일로 동의 내용을 보냈습니다. 직접 회신해 주세요.'});
});
