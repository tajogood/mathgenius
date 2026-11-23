-- 2026-11-23: PASS mobile identity verification as the default guardian consent route.
-- Apply after 001, 002 and 003. Only service_role (trusted Edge Function) may
-- start and complete the PASS verification. Browser input never sets "verified".

alter table public.guardian_consent_requests alter column guardian_email drop not null;
alter table public.guardian_consent_requests
  add column if not exists verification_method text not null default 'email'
    check (verification_method in ('email','pass')),
  add column if not exists pass_identity_verification_id text unique,
  add column if not exists pass_started_at timestamptz,
  add column if not exists pass_verified_at timestamptz;

create index if not exists guardian_consent_pass_id_idx
  on public.guardian_consent_requests(pass_identity_verification_id)
  where pass_identity_verification_id is not null;

create or replace function public.begin_guardian_pass_enrollment(
  p_parent uuid, p_child_nickname text, p_child_grade integer,
  p_guardian_name text, p_relation text,
  p_declared_guardian boolean, p_accepted_consent boolean,
  p_identity_verification_id text
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_code text := replace(gen_random_uuid()::text,'-','');
  v_request uuid;
begin
  if p_parent is null or not exists (
    select 1 from public.member_profiles p
    where p.id=p_parent and p.role='parent'
  ) then raise exception '학부모 로그인 후 신청할 수 있습니다'; end if;
  if p_declared_guardian is distinct from true
     or p_accepted_consent is distinct from true
  then raise exception '법정대리인 확인 및 개인정보 처리 동의가 모두 필요합니다'; end if;
  if char_length(btrim(coalesce(p_guardian_name,''))) not between 2 and 80 or
     char_length(btrim(coalesce(p_child_nickname,''))) not between 1 and 40 or
     p_child_grade not between 1 and 6 or
     p_relation not in ('mother','father','legal_guardian') or
     p_identity_verification_id !~ '^guardian-pass-[0-9a-f-]{36}$'
  then raise exception '입력 정보를 다시 확인해 주세요'; end if;
  if (select count(*) from public.guardian_consent_requests r
      where r.parent_id=p_parent and r.requested_at>now()-interval '24 hours'
        and r.verification_method='pass')>=3
  then raise exception '하루 최대 3건까지 보호자 인증을 신청할 수 있습니다'; end if;

  insert into public.guardian_consent_requests(
    parent_id,student_id,guardian_name,guardian_email,relation,terms_version,
    child_nickname,child_grade,invite_hash,invite_expires_at,
    status,verification_method,pass_identity_verification_id,pass_started_at
  ) values (
    p_parent,null,btrim(p_guardian_name),
    (select u.email from auth.users u where u.id=p_parent),p_relation,'draft-2026-11-23',
    btrim(p_child_nickname),p_child_grade,md5(lower(v_code)),now()+interval '7 days',
    'requested','pass',p_identity_verification_id,now()
  ) returning id into v_request;

  return v_request;
end $$;

-- Atomic approval; service_role must first verify actual PortOne API response:
-- status VERIFIED, intended verification id & channel, authenticated parent,
-- matching real name and an adult's birth date. Consent checkboxes were saved
-- in the parent enrollment request; the identity check verifies the declarant.
create or replace function public.finish_guardian_pass_enrollment(
  p_parent uuid, p_request uuid, p_verification_id text,
  p_verified_name text, p_verified_birth_date date
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare r public.guardian_consent_requests%rowtype;
begin
  select * into r from public.guardian_consent_requests
    where id=p_request and parent_id=p_parent
      and pass_identity_verification_id=p_verification_id
      and verification_method='pass' and status='requested'
      and pass_verified_at is null
      and pass_started_at>now()-interval '15 minutes'
      and student_id is null for update;
  if not found then raise exception '인증 요청이 만료되었거나 승인 가능한 상태가 아닙니다'; end if;
  if regexp_replace(btrim(r.guardian_name),'\s','','g')<>
     regexp_replace(btrim(coalesce(p_verified_name,'')),'\s','','g')
  then raise exception '휴대전화 본인확인 성명과 법정대리인 성명이 일치하지 않습니다'; end if;
  if p_verified_birth_date is null or
     p_verified_birth_date>(current_date-interval '19 years')::date or
     p_verified_birth_date<date '1900-01-01'
  then raise exception '법정대리인의 성인 본인확인을 완료할 수 없습니다'; end if;

  update public.guardian_consent_requests
    set status='verified',verified_at=now(),pass_verified_at=now(),
      verified_by='portone-v2-pass',invite_expires_at=now()+interval '7 days'
    where id=p_request;
  -- No student record exists yet: the verified guardian must share the
  -- invitation code and the child must claim it through trusted RPC.
  return true;
end $$;

revoke all on function public.begin_guardian_pass_enrollment(
  uuid,text,integer,text,text,boolean,boolean,text) from public,anon,authenticated;
grant execute on function public.begin_guardian_pass_enrollment(
  uuid,text,integer,text,text,boolean,boolean,text) to service_role;
revoke all on function public.finish_guardian_pass_enrollment(
  uuid,uuid,text,text,date) from public,anon,authenticated;
grant execute on function public.finish_guardian_pass_enrollment(
  uuid,uuid,text,text,date) to service_role;

-- Bind a child invitation to verified guardian regardless of verification
-- mechanism; only a verified request can rotate or consume the secret.
-- The earlier "rotate_guardian_invite" and "claim_guardian_invite" already
-- enforce status='verified' and no existing student account.

-- After PASS becomes the preferred new-child signup route, a browser cannot
-- create a new parent-first enrollment via the former email-only RPC.
revoke execute on function public.request_guardian_preapproval(
  text,integer,text,text,boolean,boolean) from authenticated;
