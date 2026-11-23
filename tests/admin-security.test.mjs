import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync('supabase/migrations/202611230005_admin_portal.sql','utf8');
const admin=readFileSync('src/admin/AdminPanel.tsx','utf8');
const edge=readFileSync('supabase/functions/admin-health/index.ts','utf8');
const portal=readFileSync('src/member/Portal.tsx','utf8');
const publicNotices=readFileSync('src/member/SiteAnnouncements.tsx','utf8');
const entry=readFileSync('src/main.tsx','utf8');

test('admin role bootstrap requires SQL editor and never auto-registers ordinary users',()=>{
  assert.match(sql,/create table if not exists public.site_admins/);
  assert.match(sql,/create or replace function public.is_site_admin/);
  assert.match(sql,/revoke all on public.site_admins from anon,authenticated/);
  assert.match(sql,/grant select \(user_id,role,enabled,granted_at\)/);
  assert.doesNotMatch(sql,/grant insert.*public\.site_admins to authenticated/);
  assert.match(admin,/db!\.rpc\('is_site_admin'\)/);
  assert.match(entry,/new URLSearchParams\(window.location.search\).get\('admin'\)==='1'/);
});

test('member directory exposes no private email/phone/child answer data',()=>{
  const at=sql.indexOf('create or replace function public.admin_list_members(');
  const next=sql.indexOf('create or replace function public.admin_set_member_status(',at);
  const fn=sql.slice(at,next);
  assert.ok(at>=0 && next>at);
  assert.doesNotMatch(fn,/auth\.users|guardian_email|phone|birth_date|answer_text/);
  assert.match(fn,/if not public\.is_site_admin\(\)/);
  assert.match(fn,/p_limit>50/);
});

test('suspension and notice modifications are audited by server-only functions',()=>{
  assert.match(sql,/public\.admin_set_member_status/);
  assert.match(sql,/char_length\(btrim\(coalesce\(p_reason,''\)\)\) not between 5 and 500/);
  assert.match(sql,/insert into public\.admin_audit_log/);
  assert.match(sql,/admin_archive_announcement/);
  assert.match(sql,/revoke all on public\.admin_audit_log from anon,authenticated/);
  assert.match(sql,/and p\.account_status='active'/);
});

test('notices enforce audience and publishing window in RLS',()=>{
  assert.match(sql,/create policy "active public announcements"/);
  assert.match(sql,/audience='all' and starts_at<=now\(\)/);
  assert.match(sql,/create policy "active targeted announcements"/);
  assert.match(sql,/p\.role=audience/);
  assert.match(publicNotices,/\.eq\('visibility','published'\)/);
  assert.doesNotMatch(publicNotices,/dangerouslySetInnerHTML/);
});

test('presence describes authenticated members only, not anonymous children',()=>{
  assert.match(sql,/create table if not exists public\.member_presence/);
  assert.match(sql,/revoke all on public\.member_presence from anon,authenticated/);
  assert.match(sql,/public\.ping_member_presence\(\)/);
  assert.match(sql,/p\.last_seen_at>now\(\)-interval '2 minutes'/);
  assert.match(portal,/document\.visibilityState==='visible'/);
  assert.match(admin,/GUEST 제외/);
});

test('metrics are optional and never supplied from browser as network targets',()=>{
  assert.match(edge,/adminClient\.rpc\('admin_health_ping'\)/);
  assert.match(edge,/adminClient\.rpc\('is_site_admin'\)/);
  assert.match(edge,/SERVER_METRICS_URL/);
  assert.match(edge,/metricsEndpoint\.startsWith\('https:\/\/'\)/);
  assert.match(edge,/cpu_pct:boundedMetric/);
  assert.doesNotMatch(edge,/body\.metrics_url|body\.url|body\.endpoint/);
  assert.match(admin,/측정 데이터 없음/);
});
