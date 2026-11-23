// Supabase Edge Function: guardian-pass
// PortOne V2 + KG Inicis Unified Identity Verification (PASS).
// Actions: start -> browser PASS SDK -> complete -> trusted server verifies result.
// Neither a client callback nor a checked box is sufficient for verification.
// JWT verification should remain enabled on deployment.
import {createClient} from 'npm:@supabase/supabase-js@2';

const url=Deno.env.get('SUPABASE_URL')??'';
const anonKey=Deno.env.get('SUPABASE_ANON_KEY')??'';
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
const apiSecret=Deno.env.get('PORTONE_API_SECRET')??'';
const storeId=Deno.env.get('PORTONE_STORE_ID')??'';
const channelKey=Deno.env.get('PORTONE_PASS_CHANNEL_KEY')??'';
const appOrigin=Deno.env.get('APP_ORIGIN')??'';
const enabled=Deno.env.get('GUARDIAN_PASS_ENABLED')==='true';

const headers={
  'Access-Control-Allow-Origin':appOrigin,
  'Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Vary':'Origin',
  'Content-Type':'application/json; charset=utf-8',
};
const reply=(status:number,body:Record<string,unknown>)=>
  new Response(JSON.stringify(body),{status,headers});
const validUuid=(x:unknown)=>typeof x==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);

type Verification={
  id?:string;
  status?:string;
  storeId?:string;
  channel?:{key?:string; id?:string};
  verifiedCustomer?:{name?:string;birthDate?:string;ci?:string;phoneNumber?:string};
};
Deno.serve(async req=>{
  const origin=req.headers.get('origin')??'';
  if(!appOrigin || origin!==appOrigin)return reply(403,{error:'허용되지 않은 요청 출처입니다.'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply(405,{error:'POST 요청만 지원합니다.'});
  if(!enabled || !url || !anonKey || !serviceKey || !apiSecret || !storeId || !channelKey)
    return reply(503,{error:'PASS 본인확인 서비스가 아직 설정되지 않았습니다.'});
  const token=/^Bearer\s+(.+)$/i.exec(req.headers.get('authorization')??'')?.[1];
  if(!token)return reply(401,{error:'학부모 로그인 후 이용해 주세요.'});

  const browser=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await browser.auth.getUser(token);
  if(authError || !user)return reply(401,{error:'유효하지 않은 로그인입니다.'});

  let body:Record<string,unknown>;
  try{
    body=await req.json();
    if(typeof body!=='object' || body===null || Array.isArray(body))
      return reply(400,{error:'요청 형식이 올바르지 않습니다.'});
  }catch{return reply(400,{error:'요청을 해석할 수 없습니다.'});}

  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  if(body.action==='start'){
    const childNickname=typeof body.child_nickname==='string'?body.child_nickname.trim():'';
    const guardianName=typeof body.guardian_name==='string'?body.guardian_name.trim():'';
    const childGrade=body.child_grade;
    const relation=body.relation;
    if(childNickname.length<1 || childNickname.length>40 ||
      guardianName.length<2 || guardianName.length>80 ||
      !Number.isInteger(childGrade) || Number(childGrade)<1 || Number(childGrade)>6 ||
      !['mother','father','legal_guardian'].includes(String(relation)) ||
      body.declared_guardian!==true || body.accepted_consent!==true)
      return reply(400,{error:'자녀 정보와 법정대리인의 동의 항목을 확인해 주세요.'});

    // Browser cannot choose an identityVerificationId or approve its own data.
    const verificationId='guardian-pass-'+crypto.randomUUID();
    const {data:requestId,error}=await admin.rpc('begin_guardian_pass_enrollment',{
      p_parent:user.id,
      p_child_nickname:childNickname,
      p_child_grade:Number(childGrade),
      p_guardian_name:guardianName,
      p_relation:relation,
      p_declared_guardian:true,
      p_accepted_consent:true,
      p_identity_verification_id:verificationId,
    });
    if(error){
      console.error('PASS start failed',error.code??'unknown');
      return reply(409,{error:error.message??'법정대리인 본인확인 요청에 실패했습니다.'});
    }
    return reply(200,{
      requestId,identityVerificationId:verificationId,storeId,channelKey,
      redirectUrl:appOrigin+'/?guardian_pass=1&request_id='+encodeURIComponent(String(requestId)),
    });
  }

  if(body.action==='complete'){
    const requestId=body.request_id;
    const verificationId=body.identity_verification_id;
    if(!validUuid(requestId) ||
      typeof verificationId!=='string' || !/^guardian-pass-[0-9a-f-]{36}$/.test(verificationId))
      return reply(400,{error:'잘못된 본인확인 요청번호입니다.'});

    // Bind proof to authenticated parent, request and the server-created unique
    // verification ID before ever consulting the external provider.
    const {data:record,error:findError}=await admin.from('guardian_consent_requests')
      .select('id,parent_id,status,verification_method,pass_identity_verification_id,pass_started_at')
      .eq('id',requestId).eq('parent_id',user.id).maybeSingle();
    if(findError || !record || record.verification_method!=='pass' ||
       record.pass_identity_verification_id!==verificationId ||
       record.status!=='requested')
      return reply(403,{error:'이 계정의 본인확인 요청이 아니거나 이미 처리된 인증입니다.'});
    if(!record.pass_started_at || Date.now()-Date.parse(record.pass_started_at)>15*60*1000)
      return reply(410,{error:'PASS 인증 시간이 만료되었습니다. 다시 신청해 주세요.'});

    let verification:Verification;
    try{
      const result=await fetch(
        'https://api.portone.io/identity-verifications/'+encodeURIComponent(verificationId),
        {headers:{'Authorization':'PortOne '+apiSecret,'Accept':'application/json'}},
      );
      if(!result.ok){
        console.error('PortOne verification lookup failed',result.status);
        return reply(502,{error:'PASS 인증 결과를 조회하지 못했습니다. 잠시 후 재확인해 주세요.'});
      }
      verification=await result.json() as Verification;
    }catch{
      return reply(502,{error:'PASS 인증 업체와 통신할 수 없습니다.'});
    }
    if(verification.id!==verificationId || verification.status!=='VERIFIED' ||
      verification.channel?.key!==channelKey ||
      (verification.storeId && verification.storeId!==storeId))
      return reply(403,{error:'요청한 PASS 본인확인이 완료되지 않았습니다.'});

    const verified=verification.verifiedCustomer;
    // PASS identity must include identity-based name/age plus phone and CI.
    // We do not store the CI, full date of birth or phone number.
    if(!verified || typeof verified.name!=='string' ||
      typeof verified.birthDate!=='string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(verified.birthDate) ||
      !/^\d{9,12}$/.test(String(verified.phoneNumber??'').replace(/\D/g,'')) ||
      typeof verified.ci!=='string' || verified.ci.length<10)
      return reply(403,{error:'PASS 본인확인 정보가 불충분합니다.'});

    // Enforced again inside SECURITY DEFINER transaction to avoid trusting a
    // browser-provided name or a manipulated identity verification response.
    const {data:finished,error}=await admin.rpc('finish_guardian_pass_enrollment',{
      p_parent:user.id,p_request:requestId,
      p_verification_id:verificationId,
      p_verified_name:verified.name,
      p_verified_birth_date:verified.birthDate,
    });
    if(error || finished!==true){
      return reply(403,{error:error?.message??'법정대리인 정보 검증에 실패했습니다.'});
    }
    return reply(200,{verified:true,message:'휴대전화 PASS 본인확인이 완료됐습니다. 자녀 가입 승인 코드를 발급해 주세요.'});
  }
  return reply(400,{error:'지원하지 않는 인증 요청입니다.'});
});
