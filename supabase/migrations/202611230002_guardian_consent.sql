-- Guardian consent by outbound email + explicit inbound reply.
-- Apply AFTER 202611230001_membership.sql.
-- This implements the email-and-reply method in Enforcement Decree Article 17-2.
-- Important: Only the trusted operator can examine received email evidence and verify consent.
-- Connecting a pairing code, tapping checkbox, or OAuth DOES NOT unlock a minor's records.

-- A child's checkbox is only acknowledgment of the consent-request flow, not
-- consent authorizing processing of the child's learning history.
alter table public.member_profiles alter column accepted_privacy_at drop not null;
alter table public.member_profiles drop constraint if exists minor_or_privacy_acceptance;
alter table public.member_profiles add constraint minor_or_privacy_acceptance
  check (under_14 or accepted_privacy_at is not null);

create table if not exists public.guardian_consent_requests (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.member_profiles(id) on delete cascade,
  student_id uuid not null references public.member_profiles(id) on delete cascade,
  guardian_name text not null check (char_length(guardian_name) between 2 and 80),
  guardian_email text not null,
  relation text not null check (relation in ('mother','father','legal_guardian')),
  terms_version text not null,
  status text not null default 'requested'
    check (status in ('requested','sent','verified','rejected','withdrawn')),
  requested_at timestamptz not null default now(),
  delivery_claimed_at timestamptz,
  sent_at timestamptz,
  verified_at timestamptz,
  verified_by text,
  evidence_sha256 text,
  withdrawn_at timestamptz,
  unique (parent_id,student_id)
);
create index if not exists guardian_consent_status_idx
  on public.guardian_consent_requests(status,requested_at);

alter table public.guardian_consent_requests enable row level security;
revoke all on public.guardian_consent_requests from anon,authenticated;
grant select on public.guardian_consent_requests to authenticated;
drop policy if exists "guardian request visible to requesting parent" on public.guardian_consent_requests;
create policy "guardian request visible to requesting parent"
  on public.guardian_consent_requests for select to authenticated
  using (parent_id=(select auth.uid()));

-- Child's minimal ID and age flag exist to solicit a guardian's consent;
-- there is NO record write or guardian dashboard access before verification.
create or replace function public.request_guardian_email_consent(
  p_student_id uuid,
  p_guardian_name text,
  p_relation text,
  p_declared_guardian boolean,
  p_accepted_consent boolean
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_parent uuid := (select auth.uid());
  v_email text;
  v_request_id uuid;
  v_existing public.guardian_consent_requests%rowtype;
begin
  if v_parent is null
    or not exists(select 1 from public.member_profiles where id=v_parent and role='parent')
  then raise exception '학부모 계정으로 로그인해 주세요'; end if;
  if p_declared_guardian is distinct from true or p_accepted_consent is distinct from true
  then raise exception '법정대리인 관계 확인과 개인정보 처리 동의가 필요합니다'; end if;
  if char_length(btrim(coalesce(p_guardian_name,''))) not between 2 and 80
    or p_relation not in ('mother','father','legal_guardian')
  then raise exception '보호자 이름과 관계를 확인해 주세요'; end if;
  if not exists(
    select 1 from public.parent_student_links l
    join public.member_profiles s on s.id=l.student_id
    where l.parent_id=v_parent and l.student_id=p_student_id
      and s.role='student' and s.under_14
  ) then raise exception '연결된 만 14세 미만 학생을 찾을 수 없습니다'; end if;
  select u.email into v_email from auth.users u
    where u.id=v_parent and u.email_confirmed_at is not null;
  if v_email is null or position('@' in v_email)=0
  then raise exception '이메일이 인증된 학부모 계정이 필요합니다'; end if;

  select * into v_existing from public.guardian_consent_requests
   where parent_id=v_parent and student_id=p_student_id for update;
  if found then
    if v_existing.status='verified' then raise exception '이미 동의가 확인됐습니다'; end if;
    if v_existing.status in ('requested','sent')
       and v_existing.requested_at > now()-interval '24 hours'
    then return v_existing.id; end if;
    update public.guardian_consent_requests
      set guardian_name=btrim(p_guardian_name),guardian_email=v_email,
          relation=p_relation,terms_version='draft-2026-11-23',
          status='requested',requested_at=now(),delivery_claimed_at=null,
          sent_at=null,verified_at=null,verified_by=null,
          evidence_sha256=null,withdrawn_at=null
     where id=v_existing.id returning id into v_request_id;
  else
    insert into public.guardian_consent_requests
     (parent_id,student_id,guardian_name,guardian_email,relation,terms_version)
    values(v_parent,p_student_id,btrim(p_guardian_name),v_email,p_relation,'draft-2026-11-23')
    returning id into v_request_id;
  end if;
  return v_request_id;
end $$;

-- Edge Function only: atomic claim prevents repeated email sends in concurrent requests.
create or replace function public.claim_guardian_consent_delivery(p_request uuid, p_parent uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare changed integer;
begin
  update public.guardian_consent_requests
    set delivery_claimed_at=now()
  where id=p_request and parent_id=p_parent
    and status='requested' and delivery_claimed_at is null;
  get diagnostics changed = row_count;
  return changed=1;
end $$;

create or replace function public.finish_guardian_consent_delivery(p_request uuid, p_sent boolean)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare changed integer;
begin
  update public.guardian_consent_requests
    set status=case when p_sent then 'sent' else 'requested' end,
        sent_at=case when p_sent then now() else null end,
        delivery_claimed_at=case when p_sent then delivery_claimed_at else null end
  where id=p_request and status='requested' and delivery_claimed_at is not null;
  get diagnostics changed=row_count;
  return changed=1;
end $$;

-- Operator action ONLY after comparing actual incoming email reply with outbound
-- request, the sender account, explicit acceptance and guardianship declaration.
-- Store a one-way SHA-256 proof reference; keep original evidence in controlled
-- mailbox with access restriction / retention schedule.
create or replace function public.verify_guardian_email_reply(
  p_request uuid, p_evidence_sha256 text, p_operator_ref text
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare r public.guardian_consent_requests%rowtype;
begin
  if coalesce(p_evidence_sha256,'') !~ '^[0-9a-f]{64}$'
    or char_length(btrim(coalesce(p_operator_ref,''))) not between 3 and 120
  then raise exception '회신 증빙의 SHA-256 해시와 담당자 식별자가 필요합니다'; end if;
  select * into r from public.guardian_consent_requests
    where id=p_request and status='sent' and sent_at is not null for update;
  if not found then raise exception '발송·회신 확인 대기 상태가 아닙니다'; end if;
  if not exists(select 1 from public.parent_student_links
    where parent_id=r.parent_id and student_id=r.student_id)
  then raise exception '연결이 철회된 학생입니다'; end if;

  update public.guardian_consent_requests
    set status='verified',verified_at=now(),verified_by=btrim(p_operator_ref),
        evidence_sha256=p_evidence_sha256
    where id=r.id;
  update public.parent_student_links
    set consent_verified_at=now()
    where parent_id=r.parent_id and student_id=r.student_id;
  update public.member_profiles
    set guardian_verified_at=now()
    where id=r.student_id and role='student' and under_14;
  return true;
end $$;

create or replace function public.withdraw_guardian_email_consent(p_student uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_parent uuid := (select auth.uid());
  changed integer;
begin
  update public.guardian_consent_requests set status='withdrawn',withdrawn_at=now()
  where parent_id=v_parent and student_id=p_student
    and status in ('requested','sent','verified');
  get diagnostics changed=row_count;
  if changed=0 then raise exception '철회할 동의 요청이 없습니다'; end if;
  update public.parent_student_links set consent_verified_at=null
    where parent_id=v_parent and student_id=p_student;
  update public.member_profiles set guardian_verified_at=null
    where id=p_student and under_14
      and not exists (select 1 from public.parent_student_links
        where student_id=p_student and consent_verified_at is not null);
  return true;
end $$;

-- Browser can only request/withdraw. "verified" is service_role/operator only.
revoke all on function public.request_guardian_email_consent(uuid,text,text,boolean,boolean)
  from public,anon;
grant execute on function public.request_guardian_email_consent(uuid,text,text,boolean,boolean)
  to authenticated;
revoke all on function public.withdraw_guardian_email_consent(uuid) from public,anon;
grant execute on function public.withdraw_guardian_email_consent(uuid) to authenticated;

revoke all on function public.claim_guardian_consent_delivery(uuid,uuid) from public,anon,authenticated;
revoke all on function public.finish_guardian_consent_delivery(uuid,boolean) from public,anon,authenticated;
revoke all on function public.verify_guardian_email_reply(uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_guardian_consent_delivery(uuid,uuid) to service_role;
grant execute on function public.finish_guardian_consent_delivery(uuid,boolean) to service_role;
grant execute on function public.verify_guardian_email_reply(uuid,text,text) to service_role;

-- Protect against updates to "consent_verified_at" from ordinary clients; this is
-- already revoked by membership migration but explicit defense in depth:
revoke insert,update,delete on public.parent_student_links from authenticated;
revoke insert,update,delete on public.guardian_consent_requests from authenticated;

-- Prevent browser from fabricating registration timestamps and self-reported age
-- after profile creation; parent-supplied verification is always separately locked.


-- Stop student reads of prior learning data immediately on consent withdrawal.
-- This replaces older policies that allowed students to SELECT their own records
-- without checking their current active/minor status.
drop policy if exists "snapshot read student or authorized parent" on public.learning_snapshots;
create policy "snapshot read active student or authorized parent"
  on public.learning_snapshots for select to authenticated using (
    (student_id=(select auth.uid()) and public.student_is_active(student_id))
    or public.can_access_child(student_id,(select auth.uid()))
  );
drop policy if exists "event read student or authorized parent" on public.learning_events;
create policy "event read active student or authorized parent"
  on public.learning_events for select to authenticated using (
    (student_id=(select auth.uid()) and public.student_is_active(student_id))
    or public.can_access_child(student_id,(select auth.uid()))
  );

-- Verified consent remains invalid if the parent/student link is removed.
-- Only service roles may mutate verification fields.
