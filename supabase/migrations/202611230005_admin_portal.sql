-- MathGenius operations/admin console (apply AFTER membership + guardian migrations).
-- This file does NOT automatically grant anyone admin access.
-- Manually bootstrap exactly one real authenticated operator in SQL Editor:
-- INSERT INTO public.site_admins (user_id, role)
-- SELECT id, 'owner' FROM auth.users WHERE email = 'OWNER_EMAIL@example.com';
-- Never put a service_role key in VITE_* or trust a UI flag for admin access.

alter table public.member_profiles
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active','suspended'));

create table if not exists public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','manager')),
  enabled boolean not null default true,
  granted_at timestamptz not null default now()
);
alter table public.site_admins enable row level security;
revoke all on public.site_admins from anon,authenticated;
grant select (user_id,role,enabled,granted_at) on public.site_admins to authenticated;
create policy "admin own role" on public.site_admins
  for select to authenticated using (user_id=(select auth.uid()));

create or replace function public.is_site_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.site_admins a
    where a.user_id=(select auth.uid()) and a.enabled=true
  );
$$;
revoke all on function public.is_site_admin() from public,anon;
grant execute on function public.is_site_admin() to authenticated;

-- Suspended users cannot persist learning or view other family members'
-- learning data, even when they know a URL or request an RPC directly.
create or replace function public.student_is_active(p_student uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.member_profiles p
    where p.id=p_student and p.role='student' and p.account_status='active'
      and (not p.under_14 or exists (
        select 1 from public.parent_student_links l
        join public.member_profiles parent on parent.id=l.parent_id
        where l.student_id=p_student and l.consent_verified_at is not null
          and parent.account_status='active'
      ))
  );
$$;
create or replace function public.can_access_child(p_student uuid,p_parent uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.parent_student_links l
    join public.member_profiles s on s.id=l.student_id
    join public.member_profiles p on p.id=l.parent_id
    where l.student_id=p_student and l.parent_id=p_parent
      and s.account_status='active' and p.account_status='active'
      and (not s.under_14 or l.consent_verified_at is not null)
  );
$$;

-- Presence is a 2-minute estimate for authenticated members only.
-- We do not track unauthenticated children/guests or collect IP/UA fingerprints.
create table if not exists public.member_presence (
  user_id uuid primary key references public.member_profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);
create index if not exists member_presence_seen_idx on public.member_presence(last_seen_at desc);
alter table public.member_presence enable row level security;
revoke all on public.member_presence from anon,authenticated;

create or replace function public.ping_member_presence()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.member_profiles p
      where p.id=(select auth.uid()) and p.account_status='active'
  ) then return; end if;
  insert into public.member_presence(user_id,last_seen_at)
    values((select auth.uid()),now())
    on conflict (user_id) do update set last_seen_at=excluded.last_seen_at;
end $$;
create or replace function public.clear_member_presence()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.member_presence where user_id=(select auth.uid());
end $$;
revoke all on function public.ping_member_presence() from public,anon;
revoke all on function public.clear_member_presence() from public,anon;
grant execute on function public.ping_member_presence() to authenticated;
grant execute on function public.clear_member_presence() to authenticated;

create table if not exists public.site_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  body text not null check (char_length(body) between 3 and 4000),
  audience text not null default 'all' check (audience in ('all','parent','student')),
  visibility text not null default 'draft' check (visibility in ('draft','published','archived')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.site_admins(user_id),
  updated_by uuid references public.site_admins(user_id),
  check (ends_at is null or ends_at>starts_at)
);
create index if not exists site_announcements_published_idx
  on public.site_announcements(visibility,starts_at desc);
alter table public.site_announcements enable row level security;
revoke all on public.site_announcements from anon,authenticated;
grant select on public.site_announcements to anon,authenticated;
create policy "active public announcements" on public.site_announcements
  for select to anon,authenticated using (
    visibility='published' and starts_at<=now()
      and (ends_at is null or ends_at>now())
  );
create policy "all announcements for administrators" on public.site_announcements
  for select to authenticated using ((select public.is_site_admin()));

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.site_admins(user_id),
  action text not null,
  target_type text not null,
  target_id text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log(created_at desc);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon,authenticated;
grant select on public.admin_audit_log to authenticated;
create policy "admin audit readable only by admin" on public.admin_audit_log
  for select to authenticated using ((select public.is_site_admin()));

-- Overview returns only aggregate counts; no raw children's answers or PII.
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if not public.is_site_admin() then raise exception '관리자 권한이 없습니다'; end if;
  return jsonb_build_object(
    'total_members',(select count(*) from public.member_profiles),
    'students',(select count(*) from public.member_profiles where role='student'),
    'parents',(select count(*) from public.member_profiles where role='parent'),
    'under14',(select count(*) from public.member_profiles where under_14),
    'suspended',(select count(*) from public.member_profiles where account_status='suspended'),
    'new_today',(select count(*) from public.member_profiles
      where (created_at at time zone 'Asia/Seoul')::date=v_today),
    'online_members',(select count(*) from public.member_presence p
      join public.member_profiles m on m.id=p.user_id
      where p.last_seen_at>now()-interval '2 minutes' and m.account_status='active'),
    'active_students_today',(select count(distinct e.student_id)
      from public.learning_events e where (e.occurred_at at time zone 'Asia/Seoul')::date=v_today),
    'answers_today',(select count(*) from public.learning_events e
      where e.event_type in ('answer','standard_answer')
        and (e.occurred_at at time zone 'Asia/Seoul')::date=v_today),
    'correct_today',(select count(*) from public.learning_events e
      where e.event_type in ('answer','standard_answer') and e.correct=true
        and (e.occurred_at at time zone 'Asia/Seoul')::date=v_today),
    'learning_seconds_today',(select coalesce(sum(seconds),0) from public.learning_events e
      where e.event_type='active_time'
        and (e.occurred_at at time zone 'Asia/Seoul')::date=v_today),
    'published_notices',(select count(*) from public.site_announcements
      where visibility='published' and starts_at<=now()
        and (ends_at is null or ends_at>now())),
    'as_of',now()
  );
end $$;

create or replace function public.admin_learning_by_day(p_days integer default 7)
returns table(day date,active_students bigint,answers bigint,correct bigint,study_minutes bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_site_admin() then raise exception '관리자 권한이 없습니다'; end if;
  if p_days<1 or p_days>31 then raise exception '조회 기간은 1~31일입니다'; end if;
  return query
  with dates as (
    select (now() at time zone 'Asia/Seoul')::date - x.n as day
    from generate_series(0,p_days-1) x(n)
  ), daily as (
    select (e.occurred_at at time zone 'Asia/Seoul')::date as day,
      count(distinct e.student_id)::bigint as active_students,
      count(*) filter(where e.event_type in ('answer','standard_answer'))::bigint as answers,
      count(*) filter(where e.event_type in ('answer','standard_answer') and e.correct=true)::bigint as correct,
      (coalesce(sum(e.seconds) filter(where e.event_type='active_time'),0)/60)::bigint as study_minutes
    from public.learning_events e
    where e.occurred_at>=now()-make_interval(days=>p_days+1)
    group by 1
  )
  select d.day,coalesce(a.active_students,0),coalesce(a.answers,0),
    coalesce(a.correct,0),coalesce(a.study_minutes,0)
  from dates d left join daily a using(day) order by d.day asc;
end $$;

-- Limit the member directory to least-necessary fields, without email,
-- birthdate, detailed answers, phone numbers or consent proof.
create or replace function public.admin_list_members(
  p_query text default '',p_limit integer default 30,p_offset integer default 0
) returns table(id uuid,nickname text,role text,grade smallint,
  under_14 boolean,account_status text,created_at timestamptz,
  last_seen_at timestamptz,guardian_approved boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare v_search text := left(btrim(coalesce(p_query,'')),80);
begin
  if not public.is_site_admin() then raise exception '관리자 권한이 없습니다'; end if;
  if p_limit<1 or p_limit>50 or p_offset<0 or p_offset>10000
  then raise exception '조회 건수 또는 페이지가 범위를 벗어났습니다'; end if;
  return query
    select p.id,p.nickname,p.role,p.grade,p.under_14,p.account_status,
      p.created_at,pr.last_seen_at,
      (not p.under_14 or public.student_is_active(p.id)) as guardian_approved
    from public.member_profiles p
    left join public.member_presence pr on pr.user_id=p.id
    where v_search='' or p.nickname ilike '%'||replace(replace(v_search,'%','\%'),'_','\_')||'%'
      or p.id::text=v_search
    order by p.created_at desc,p.id desc
    limit p_limit offset p_offset;
end $$;

create or replace function public.admin_set_member_status(
  p_member uuid,p_status text,p_reason text
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_old text;
  v_actor uuid := (select auth.uid());
begin
  if not public.is_site_admin() then raise exception '관리자 권한이 없습니다'; end if;
  if p_status not in ('active','suspended') or
    char_length(btrim(coalesce(p_reason,''))) not between 5 and 500
  then raise exception '상태와 처리 사유(5~500자)를 확인해 주세요'; end if;
  if exists(select 1 from public.site_admins where user_id=p_member)
  then raise exception '관리자 계정은 이 화면에서 정지할 수 없습니다'; end if;
  select account_status into v_old
    from public.member_profiles where id=p_member for update;
  if not found then raise exception '회원이 존재하지 않습니다'; end if;
  if v_old=p_status then return true; end if;
  update public.member_profiles set account_status=p_status where id=p_member;
  insert into public.admin_audit_log(actor_id,action,target_type,target_id,details)
    values(v_actor,'member.status','member',p_member::text,
      jsonb_build_object('from',v_old,'to',p_status,'reason',btrim(p_reason)));
  return true;
end $$;

create or replace function public.admin_save_announcement(
  p_id uuid,p_title text,p_body text,p_audience text,
  p_visibility text,p_starts_at timestamptz,p_ends_at timestamptz
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_actor uuid := (select auth.uid());
  v_action text;
begin
  if not public.is_site_admin() then raise exception '관리자 권한이 없습니다'; end if;
  if char_length(btrim(coalesce(p_title,''))) not between 3 and 120
    or char_length(btrim(coalesce(p_body,''))) not between 3 and 4000
    or p_audience not in ('all','parent','student')
    or p_visibility not in ('draft','published','archived')
    or p_starts_at is null
    or (p_ends_at is not null and p_ends_at<=p_starts_at)
  then raise exception '공지사항 제목·내용·공개설정·기간을 확인해 주세요'; end if;
  if p_id is null then
    insert into public.site_announcements
      (title,body,audience,visibility,starts_at,ends_at,created_by,updated_by)
    values(btrim(p_title),btrim(p_body),p_audience,p_visibility,p_starts_at,
      p_ends_at,v_actor,v_actor) returning id into v_id;
    v_action:='notice.create';
  else
    update public.site_announcements
      set title=btrim(p_title),body=btrim(p_body),audience=p_audience,
        visibility=p_visibility,starts_at=p_starts_at,ends_at=p_ends_at,
        updated_at=now(),updated_by=v_actor
      where id=p_id returning id into v_id;
    if not found then raise exception '공지사항이 존재하지 않습니다'; end if;
    v_action:='notice.update';
  end if;
  insert into public.admin_audit_log(actor_id,action,target_type,target_id,details)
    values(v_actor,v_action,'announcement',v_id::text,
      jsonb_build_object('visibility',p_visibility,'audience',p_audience));
  return v_id;
end $$;

-- Soft archive: reversible and auditable, not a destructive delete.
create or replace function public.admin_archive_announcement(p_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_site_admin() then raise exception '관리자 권한이 없습니다'; end if;
  update public.site_announcements
    set visibility='archived',updated_at=now(),updated_by=(select auth.uid())
    where id=p_id;
  if not found then raise exception '공지사항이 존재하지 않습니다'; end if;
  insert into public.admin_audit_log(actor_id,action,target_type,target_id)
    values((select auth.uid()),'notice.archive','announcement',p_id::text);
  return true;
end $$;

create or replace function public.admin_health_ping()
returns timestamptz language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_site_admin() then raise exception '관리자 권한이 없습니다'; end if;
  return now();
end $$;

-- RPC is the ONLY browser access path for privileged writes & analytics.
revoke all on function public.admin_overview() from public,anon;
revoke all on function public.admin_learning_by_day(integer) from public,anon;
revoke all on function public.admin_list_members(text,integer,integer) from public,anon;
revoke all on function public.admin_set_member_status(uuid,text,text) from public,anon;
revoke all on function public.admin_save_announcement(uuid,text,text,text,text,timestamptz,timestamptz) from public,anon;
revoke all on function public.admin_archive_announcement(uuid) from public,anon;
revoke all on function public.admin_health_ping() from public,anon;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_learning_by_day(integer) to authenticated;
grant execute on function public.admin_list_members(text,integer,integer) to authenticated;
grant execute on function public.admin_set_member_status(uuid,text,text) to authenticated;
grant execute on function public.admin_save_announcement(uuid,text,text,text,text,timestamptz,timestamptz) to authenticated;
grant execute on function public.admin_archive_announcement(uuid) to authenticated;
grant execute on function public.admin_health_ping() to authenticated;

-- Privileged fields remain outside browser update column grants.
revoke update(account_status) on public.member_profiles from authenticated;
