-- Execute in Supabase SQL Editor. Never expose a service role key to the browser.
create extension if not exists pgcrypto;

create table if not exists public.member_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student','parent')),
  nickname text not null check (char_length(nickname) between 1 and 40),
  grade smallint check (grade between 1 and 6),
  under_14 boolean not null default false,
  guardian_verified_at timestamptz,
  terms_version text not null,
  accepted_terms_at timestamptz not null,
  accepted_privacy_at timestamptz not null,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  constraint student_grade_required check ((role = 'student' and grade is not null) or (role = 'parent' and grade is null))
);

create table if not exists public.parent_student_links (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.member_profiles(id) on delete cascade,
  student_id uuid not null references public.member_profiles(id) on delete cascade,
  -- For children under 14, only a trusted verification service may set this.
  consent_verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (parent_id,student_id),
  check (parent_id <> student_id)
);

create table if not exists public.student_pairing_codes (
  student_id uuid primary key references public.member_profiles(id) on delete cascade,
  code_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create or replace function public.can_access_child(p_student uuid, p_parent uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
 select exists (
   select 1 from public.parent_student_links l
   join public.member_profiles s on s.id=l.student_id
   where l.student_id=p_student and l.parent_id=p_parent
     and (not s.under_14 or l.consent_verified_at is not null)
 );
$$;

create or replace function public.student_is_active(p_student uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
 select exists (
   select 1 from public.member_profiles p
   where p.id=p_student and p.role='student' and
     (not p.under_14 or exists (
       select 1 from public.parent_student_links l
       where l.student_id=p_student and l.consent_verified_at is not null
     ))
 );
$$;

create table if not exists public.learning_snapshots (
  student_id uuid primary key references public.member_profiles(id) on delete cascade,
  progress jsonb not null default '{}'::jsonb,
  standard_progress jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_events (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.member_profiles(id) on delete cascade,
  event_type text not null check (event_type in
    ('lesson_open','concept_view','lab_interaction','answer','standard_open','standard_answer','active_time')),
  unit_id text,
  topic text,
  standard_id text,
  correct boolean,
  seconds integer check (seconds between 0 and 3600),
  occurred_at timestamptz not null default now()
);
create index if not exists learning_events_student_time
  on public.learning_events(student_id,occurred_at desc);

create table if not exists public.homework_assignments (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.member_profiles(id) on delete cascade,
  student_id uuid not null references public.member_profiles(id) on delete cascade,
  unit_id text not null,
  status text not null default 'assigned' check (status in ('assigned','completed')),
  due_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists homework_student_status on public.homework_assignments(student_id,status);

alter table public.member_profiles enable row level security;
alter table public.parent_student_links enable row level security;
alter table public.student_pairing_codes enable row level security;
alter table public.learning_snapshots enable row level security;
alter table public.learning_events enable row level security;
alter table public.homework_assignments enable row level security;

create policy "profiles visible to self or linked parent" on public.member_profiles
  for select to authenticated using (id = (select auth.uid()) or
    public.can_access_child(id,(select auth.uid())));
create policy "profiles created by owner" on public.member_profiles
  for insert to authenticated with check (id = (select auth.uid()) and
    guardian_verified_at is null);
create policy "owner editable basics" on public.member_profiles
  for update to authenticated using (id=(select auth.uid()))
  with check (id=(select auth.uid()));
-- Column grants prevent clients from spoofing guardian verification/terms auditing.
revoke insert,update on public.member_profiles from authenticated;
grant select on public.member_profiles to authenticated;
grant insert (id,role,nickname,grade,under_14,terms_version,accepted_terms_at,
  accepted_privacy_at,marketing_opt_in) on public.member_profiles to authenticated;
grant update (nickname,grade) on public.member_profiles to authenticated;

create policy "links visible to owners" on public.parent_student_links
  for select to authenticated using (parent_id=(select auth.uid()) or student_id=(select auth.uid()));
revoke insert,update,delete on public.parent_student_links from authenticated;
grant select on public.parent_student_links to authenticated;

-- Pairing codes cannot be selected or modified directly by browser clients.
revoke all on public.student_pairing_codes from anon,authenticated;

create or replace function public.issue_pairing_code()
returns text language plpgsql security definer set search_path = ''
as $$
declare new_code text;
begin
  if not exists (select 1 from public.member_profiles p where p.id=auth.uid() and p.role='student')
  then raise exception '학생 계정에서만 연결할 수 있습니다'; end if;
  new_code := encode(gen_random_bytes(16),'hex');
  insert into public.student_pairing_codes(student_id,code_hash,expires_at)
  values (auth.uid(),encode(digest(new_code,'sha256'),'hex'),now()+interval '15 minutes')
  on conflict (student_id) do update set
    code_hash=excluded.code_hash,expires_at=excluded.expires_at,created_at=now();
  return new_code;
end $$;

create or replace function public.accept_pairing_code(entered_code text)
returns text language plpgsql security definer set search_path = ''
as $$
declare sid uuid; young boolean;
begin
  if not exists (select 1 from public.member_profiles p where p.id=auth.uid() and p.role='parent')
  then raise exception '학부모 계정에서만 연결할 수 있습니다'; end if;
  if char_length(entered_code)<>32 then raise exception '유효하지 않은 연결 코드입니다'; end if;
  select c.student_id into sid from public.student_pairing_codes c
   where c.code_hash=encode(digest(lower(entered_code),'sha256'),'hex')
   and c.expires_at>now() for update;
  if sid is null then raise exception '연결 코드가 만료되었거나 틀렸습니다'; end if;
  select p.under_14 into young from public.member_profiles p where p.id=sid;
  insert into public.parent_student_links(parent_id,student_id)
    values (auth.uid(),sid) on conflict (parent_id,student_id) do nothing;
  delete from public.student_pairing_codes where student_id=sid;
  if young then return '미성년자 보호자 본인확인이 필요합니다. 인증 완료 전 데이터 조회와 숙제 기능이 제한됩니다.';
  else return '연결되었습니다'; end if;
end $$;

revoke all on function public.issue_pairing_code() from public,anon;
revoke all on function public.accept_pairing_code(text) from public,anon;
grant execute on function public.issue_pairing_code() to authenticated;
grant execute on function public.accept_pairing_code(text) to authenticated;

create policy "snapshot read student or authorized parent" on public.learning_snapshots
  for select to authenticated using (
    student_id=(select auth.uid()) or public.can_access_child(student_id,(select auth.uid())));
create policy "student inserts own snapshot" on public.learning_snapshots
  for insert to authenticated with check (
    student_id=(select auth.uid()) and public.student_is_active(student_id));
create policy "student updates own snapshot" on public.learning_snapshots
  for update to authenticated using (
    student_id=(select auth.uid()) and public.student_is_active(student_id))
  with check (student_id=(select auth.uid()) and public.student_is_active(student_id));

create policy "event read student or authorized parent" on public.learning_events
  for select to authenticated using (
    student_id=(select auth.uid()) or public.can_access_child(student_id,(select auth.uid())));
create policy "student logs own events" on public.learning_events
  for insert to authenticated with check (
    student_id=(select auth.uid()) and public.student_is_active(student_id));
revoke update,delete on public.learning_events from authenticated;

create policy "homework read linked parties" on public.homework_assignments
  for select to authenticated using (
    (student_id=(select auth.uid()) and public.student_is_active(student_id))
    or (parent_id=(select auth.uid()) and public.can_access_child(student_id,parent_id)));
create policy "parent can assign linked students" on public.homework_assignments
  for insert to authenticated with check (
    parent_id=(select auth.uid()) and public.can_access_child(student_id,parent_id));
create policy "linked family can update homework" on public.homework_assignments
  for update to authenticated using (
    (parent_id=(select auth.uid()) and public.can_access_child(student_id,parent_id)) or
    (student_id=(select auth.uid()) and public.student_is_active(student_id)))
  with check (
    (parent_id=(select auth.uid()) and public.can_access_child(student_id,parent_id)) or
    (student_id=(select auth.uid()) and public.student_is_active(student_id)));
revoke update on public.homework_assignments from authenticated;
grant update (status) on public.homework_assignments to authenticated;
-- DB-side trigger enforces completion scope, prevents a student changing arbitrary fields.
