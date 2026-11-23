-- Parent-first enrollment (for under-14 children) prevents a child's OAuth
-- account being created before the guardian's verified email reply.
-- Apply after 202611230002_guardian_consent.sql.

alter table public.guardian_consent_requests
  alter column student_id drop not null;
alter table public.guardian_consent_requests
  add column if not exists invite_hash text unique,
  add column if not exists child_nickname text,
  add column if not exists child_grade smallint,
  add column if not exists invite_expires_at timestamptz,
  add column if not exists invite_claimed_at timestamptz;

alter table public.guardian_consent_requests
  drop constraint if exists guardian_consent_child_invitation_complete;
alter table public.guardian_consent_requests
  add constraint guardian_consent_child_invitation_complete
  check (
    (invite_hash is null and child_nickname is null and child_grade is null) or
    (invite_hash is not null and child_nickname is not null
      and char_length(child_nickname) between 1 and 40 and child_grade between 1 and 6)
  );

-- Parent starts a minor's signup, without requiring child's OAuth account.
create or replace function public.request_guardian_preapproval(
  p_child_nickname text, p_child_grade integer,
  p_guardian_name text, p_relation text,
  p_declared_guardian boolean, p_accepted_consent boolean
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_parent uuid := (select auth.uid());
  v_email text;
  v_code text := replace(gen_random_uuid()::text,'-','');
  v_id uuid;
begin
  if v_parent is null
    or not exists(select 1 from public.member_profiles p
      where p.id=v_parent and p.role='parent')
  then raise exception '학부모로 로그인해 주세요'; end if;
  if p_declared_guardian is distinct from true or p_accepted_consent is distinct from true
  then raise exception '법정대리인 관계 확인과 개인정보 처리 동의가 필요합니다'; end if;
  if char_length(btrim(coalesce(p_guardian_name,''))) not between 2 and 80 or
    char_length(btrim(coalesce(p_child_nickname,''))) not between 1 and 40 or
    p_child_grade not between 1 and 6 or p_relation not in ('mother','father','legal_guardian')
  then raise exception '보호자 이름, 학생 닉네임, 학년, 관계를 입력해 주세요'; end if;
  select u.email into v_email from auth.users u
    where u.id=v_parent and u.email_confirmed_at is not null;
  if v_email is null or position('@' in v_email)=0
  then raise exception '이메일이 확인된 학부모 계정이 필요합니다'; end if;

  -- Limit outstanding invitations: do not allow arbitrary email spamming.
  if (select count(*) from public.guardian_consent_requests r
      where r.parent_id=v_parent and r.student_id is null
        and r.requested_at>now()-interval '24 hours') >= 3
  then raise exception '하루에 최대 세 명의 자녀 가입 승인 요청을 보낼 수 있습니다'; end if;

  insert into public.guardian_consent_requests(
    parent_id,student_id,guardian_name,guardian_email,relation,terms_version,
    child_nickname,child_grade,invite_hash,invite_expires_at
  ) values(
    v_parent,null,btrim(p_guardian_name),v_email,p_relation,'draft-2026-11-23',
    btrim(p_child_nickname),p_child_grade,
    encode(digest(lower(v_code),'sha256'),'hex'),now()+interval '30 days'
  ) returning id into v_id;

  return jsonb_build_object('request_id',v_id,'invitation_code',v_code);
end $$;

-- No personally identifying child details are returned to anonymous users.
-- A high-entropy invite code is required and remains unusable until verified.
create or replace function public.guardian_invite_is_approved(p_code text)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if char_length(coalesce(p_code,''))<>32 or p_code !~ '^[0-9a-fA-F]{32}$'
  then return false; end if;
  return exists(
    select 1 from public.guardian_consent_requests r
    where r.invite_hash=encode(digest(lower(p_code),'sha256'),'hex')
      and r.status='verified' and r.verified_at is not null
      and r.student_id is null and r.invite_expires_at>now()
  );
end $$;

-- The parent may rotate the invitation secret if it was not saved.
create or replace function public.rotate_guardian_invite(p_request uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_code text := replace(gen_random_uuid()::text,'-','');
  v_changed integer;
begin
  update public.guardian_consent_requests
  set invite_hash=encode(digest(lower(v_code),'sha256'),'hex')
  where id=p_request and parent_id=(select auth.uid())
    and invite_hash is not null and student_id is null
    and status in ('requested','sent','verified')
    and invite_expires_at>now();
  get diagnostics v_changed=row_count;
  if v_changed<>1 then raise exception '이용 가능한 미연결 자녀 가입 요청이 아닙니다'; end if;
  return v_code;
end $$;

-- Atomically create child's profile only AFTER a verified guardian consent.
create or replace function public.claim_guardian_invite(p_code text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_student uuid := (select auth.uid());
  r public.guardian_consent_requests%rowtype;
begin
  if v_student is null then raise exception '소셜 로그인이 필요합니다'; end if;
  if char_length(coalesce(p_code,''))<>32 or p_code !~ '^[0-9a-fA-F]{32}$'
  then raise exception '가입 승인 코드가 유효하지 않습니다'; end if;
  select * into r from public.guardian_consent_requests
    where invite_hash=encode(digest(lower(p_code),'sha256'),'hex')
      and status='verified' and verified_at is not null
      and student_id is null and invite_expires_at>now() for update;
  if not found then raise exception '부모님의 동의가 확인되지 않았거나 코드가 만료됐습니다'; end if;
  if exists(select 1 from public.member_profiles where id=v_student)
  then raise exception '이미 등록된 계정입니다'; end if;

  insert into public.member_profiles(
    id,role,nickname,grade,under_14,guardian_verified_at,
    terms_version,accepted_terms_at,accepted_privacy_at,marketing_opt_in
  ) values(
    v_student,'student',r.child_nickname,r.child_grade,true,r.verified_at,
    r.terms_version,now(),null,false
  );
  insert into public.parent_student_links(parent_id,student_id,consent_verified_at)
  values(r.parent_id,v_student,r.verified_at);
  update public.guardian_consent_requests set student_id=v_student,invite_claimed_at=now()
    where id=r.id;
  return v_student;
end $$;

-- Replace verification with support for both a linked child and a parent-first
-- invitation which has no student account yet.
create or replace function public.verify_guardian_email_reply(
  p_request uuid, p_evidence_sha256 text, p_operator_ref text
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare r public.guardian_consent_requests%rowtype;
begin
  if coalesce(p_evidence_sha256,'') !~ '^[0-9a-f]{64}$'
    or char_length(btrim(coalesce(p_operator_ref,''))) not between 3 and 120
  then raise exception '회신 증빙 SHA-256과 운영자 식별자를 입력해 주세요'; end if;
  select * into r from public.guardian_consent_requests
    where id=p_request and status='sent' and sent_at is not null for update;
  if not found then raise exception '회신 확인 가능한 발송 건이 아닙니다'; end if;
  if r.student_id is not null and not exists(
    select 1 from public.parent_student_links
    where parent_id=r.parent_id and student_id=r.student_id
  ) then raise exception '학생 연결이 확인되지 않았습니다'; end if;
  update public.guardian_consent_requests
    set status='verified',verified_at=now(),verified_by=btrim(p_operator_ref),
      evidence_sha256=p_evidence_sha256,
      invite_expires_at=case when r.invite_hash is not null
        then now()+interval '7 days' else invite_expires_at end
    where id=r.id;
  if r.student_id is not null then
    update public.parent_student_links set consent_verified_at=now()
      where parent_id=r.parent_id and student_id=r.student_id;
    update public.member_profiles set guardian_verified_at=now()
      where id=r.student_id and role='student' and under_14;
  end if;
  return true;
end $$;

-- For a parent-first enrollment, consent can be withdrawn before a student
-- account is ever created, or after the child claims the invitation.
create or replace function public.withdraw_guardian_email_consent_request(p_request uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare r public.guardian_consent_requests%rowtype;
begin
  select * into r from public.guardian_consent_requests
    where id=p_request and parent_id=(select auth.uid()) and
      status in ('requested','sent','verified') for update;
  if not found then raise exception '철회 가능한 보호자 동의가 아닙니다'; end if;
  update public.guardian_consent_requests set status='withdrawn',withdrawn_at=now()
    where id=r.id;
  if r.student_id is not null then
    update public.parent_student_links set consent_verified_at=null
      where student_id=r.student_id and parent_id=r.parent_id;
    update public.member_profiles set guardian_verified_at=null
      where id=r.student_id and under_14 and not exists(
        select 1 from public.parent_student_links
         where student_id=r.student_id and consent_verified_at is not null
      );
  end if;
  return true;
end $$;

revoke all on function public.request_guardian_preapproval(text,integer,text,text,boolean,boolean) from public,anon;
grant execute on function public.request_guardian_preapproval(text,integer,text,text,boolean,boolean) to authenticated;
revoke all on function public.guardian_invite_is_approved(text) from public,authenticated,anon;
grant execute on function public.guardian_invite_is_approved(text) to anon,authenticated;
revoke all on function public.rotate_guardian_invite(uuid) from public,anon;
grant execute on function public.rotate_guardian_invite(uuid) to authenticated;
revoke all on function public.claim_guardian_invite(text) from public,anon;
grant execute on function public.claim_guardian_invite(text) to authenticated;
revoke all on function public.withdraw_guardian_email_consent_request(uuid) from public,anon;
grant execute on function public.withdraw_guardian_email_consent_request(uuid) to authenticated;
revoke all on function public.verify_guardian_email_reply(uuid,text,text) from public,anon,authenticated;
grant execute on function public.verify_guardian_email_reply(uuid,text,text) to service_role;

-- Refuse a direct student profile creation via browser if they claim under-14;
-- minors must be created by the trusted claim_guardian_invite server function.
drop policy if exists "profiles created by owner" on public.member_profiles;
create policy "profiles created by owner age14plus only" on public.member_profiles
  for insert to authenticated with check (id=(select auth.uid())
    and guardian_verified_at is null and under_14=false);

-- Browser cannot make a new "verified" child or change under_14 after creation.
revoke insert,update on public.member_profiles from authenticated;
grant select on public.member_profiles to authenticated;
grant insert (id,role,nickname,grade,under_14,terms_version,
   accepted_terms_at,accepted_privacy_at,marketing_opt_in)
  on public.member_profiles to authenticated;
grant update (nickname,grade) on public.member_profiles to authenticated;
