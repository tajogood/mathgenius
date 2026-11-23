import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const preapproval=readFileSync('supabase/migrations/202611230003_guardian_parent_first.sql','utf8');
const audit=readFileSync('supabase/migrations/202611230002_guardian_consent.sql','utf8');
const portal=readFileSync('src/member/Portal.tsx','utf8');
const email=readFileSync('supabase/functions/send-guardian-consent/index.ts','utf8');

test('under-14 profiles are created only by approved parent invitation',()=>{
  assert.match(preapproval,/create or replace function public.claim_guardian_invite/);
  assert.match(preapproval,/and status='verified' and verified_at is not null/);
  assert.match(preapproval,/student_id is null and invite_expires_at>now\(\) for update/);
  assert.match(preapproval,/and guardian_verified_at is null and under_14=false/);
  assert.match(preapproval,/insert into public.parent_student_links\(parent_id,student_id,consent_verified_at\)/);
  assert.match(preapproval,/revoke all on function public.claim_guardian_invite.*from public,anon/);
});

test('email send does not mark consent as verified',()=>{
  assert.match(email,/CONSENT_ENABLED/);
  assert.match(email,/RESEND_API_KEY/);
  assert.match(email,/claim_guardian_consent_delivery/);
  assert.match(email,/finish_guardian_consent_delivery/);
  assert.doesNotMatch(email,/verify_guardian_email_reply/);
  assert.doesNotMatch(email,/status:\s*'verified'/);
  assert.match(audit,/revoke all on function public.verify_guardian_email_reply.*from public,anon,authenticated/);
});

test('minor application does not store own privacy consent or marketing opt-in',()=>{
  assert.match(portal,/accepted_privacy_at:young\?null:/);
  assert.match(portal,/marketing_opt_in:young\?false:/);
  assert.match(audit,/alter column accepted_privacy_at drop not null/);
});

test('parent-first signup checks code before social OAuth',()=>{
  const functionStart=portal.indexOf("async function beginMinorSignup");
  const functionEnd=portal.indexOf("async function signOut",functionStart);
  const body=portal.slice(functionStart,functionEnd);
  assert.match(body,/guardian_invite_is_approved/);
  assert.match(body,/if\(error \|\| !data\)/);
  assert.match(body,/sessionStorage.setItem/);
  assert.match(body,/await oauth\(provider\)/);
  assert.match(portal,/claim_guardian_invite/);
});

test('withdrawal stops reading even already-stored child learning events',()=>{
  assert.match(audit,/create policy "snapshot read active student or authorized parent"/);
  assert.match(audit,/create policy "event read active student or authorized parent"/);
  assert.match(audit,/public.student_is_active\(student_id\)/);
  assert.match(preapproval,/create or replace function public.withdraw_guardian_email_consent_request/);
});

const passSql=readFileSync('supabase/migrations/202611230004_guardian_pass.sql','utf8');
const passEdge=readFileSync('supabase/functions/guardian-pass/index.ts','utf8');
const passClient=readFileSync('src/member/pass.ts','utf8');

test('PASS confirmation never trusts browser-reported success',()=>{
  assert.match(passClient,/directAgency:'PASS'/);
  assert.match(passEdge,/api.portone.io\/identity-verifications/);
  assert.match(passEdge,/verification.status!=='VERIFIED'/);
  assert.match(passEdge,/verification.channel\?\.key!==channelKey/);
  assert.match(passEdge,/record.pass_identity_verification_id!==verificationId/);
  assert.match(passEdge,/admin\.rpc\('finish_guardian_pass_enrollment'/);
  assert.doesNotMatch(passClient,/PORTONE_API_SECRET|SUPABASE_SERVICE_ROLE_KEY/);
});

test('PASS verification is server-role only and checks adult age + real name',()=>{
  assert.match(passSql,/p_verified_birth_date>\(current_date-interval '19 years'\)::date/);
  assert.match(passSql,/regexp_replace\(btrim\(r.guardian_name\)/);
  assert.match(passSql,/pass_started_at>now\(\)-interval '15 minutes'/);
  assert.match(passSql,/from public,anon,authenticated/);
  assert.match(passSql,/to service_role/);
});

test('parent must declare guardianship, grant consent and verify PASS to issue a child invitation',()=>{
  assert.match(portal,/guardianDeclared/);
  assert.match(portal,/guardianConsentOk/);
  assert.match(portal,/async function startGuardianPass/);
  assert.match(portal,/async function completeGuardianPass/);
  assert.match(portal,/request\.status==='verified'/);
  assert.match(portal,/guardian_pass/);
  assert.match(preapproval,/status='verified'/);
});
