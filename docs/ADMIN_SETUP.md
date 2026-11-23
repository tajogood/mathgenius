# 수학천재 운영자(Admin) 콘솔 설치 및 운영

## 0. 현재 구현 상태

관리자 화면의 웹 코드는 PR 브랜치에 구현되었습니다. **실제 회원·학습 통계는 Supabase 환경을 연결하고 마이그레이션을 적용해야 나타납니다.** 가짜 실시간 수치나 서버 리소스 값을 보여주지 않습니다.

- 운영자 접속: \`https://실제서비스주소/admin/\`
  - 정적 웹 호스팅이면 이 주소는 \`/?admin=1\`로 이동합니다.
  - \`https://실제서비스주소/?admin=1\`도 직접 이용할 수 있습니다.
- 관리자 화면은 robots noindex이며, 일반 소셜로그인 사용자는 서버에서 권한이 없으면 조회·편집을 할 수 없습니다.
- **운영자 계정은 관리자가 별도 등록**합니다. 일반 사용자는 UI나 프로필 변경으로 관리자 권한을 얻을 수 없습니다.

## 1. DB SQL 설치와 최초 관리자 지정

기존 회원·보호자 SQL 마이그레이션 001~004를 먼저 적용한 후:

\`\`\`text
supabase/migrations/202611230005_admin_portal.sql
\`\`\`

Supabase SQL Editor에서 위 SQL을 실행합니다. 이후 운영자가 **이미 Google 또는 카카오 로그인을 한 계정**이어야 하므로, 우선 그 계정으로 수학천재에서 로그인하세요. 그런 다음 SQL Editor의 프로젝트 소유자 권한으로 아래처럼 실제 운영자 계정을 허용 명단에 넣습니다.

\`\`\`sql
-- EMAIL_HERE는 실사용 운영자 로그인 이메일로 교체하세요.
insert into public.site_admins (user_id,role)
select id,'owner' from auth.users where email='EMAIL_HERE'
on conflict (user_id) do update set role='owner',enabled=true;
\`\`\`

**운영자 이메일 주소나 실제 사용자 UUID를 소스 코드에 하드코딩하지 않습니다.** 서비스 관리자 권한은 \`site_admins\` 테이블에서 관리하고, \`is_site_admin()\` RPC가 DB에서 권한을 재검증합니다.

계정의 로그인 이메일이 구글/카카오 제공 정보와 다르면 먼저 Supabase Auth Users 화면에서 확인합니다. 관리자 최초 등록은 SQL Editor에서만 합니다.

### 보안

- \`admin_overview()\`, \`admin_list_members()\`, \`admin_learning_by_day()\`, \`admin_learning_by_grade()\`, \`admin_set_member_status()\`, \`admin_save_announcement()\`, \`admin_archive_announcement()\`은 **관리자 서버 권한 확인 후에만 실행**됩니다.
- 회원 상태 변경에는 사유(최소 5자)를 입력해야 합니다. 변경 대상·사유·운영자·시각이 삭제/업데이트할 수 없는 \`admin_audit_log\`에 저장됩니다.
- 관리자는 어드민에서 **자기 또는 다른 관리자 계정을 정지하지 못합니다.** 관리자 지정/해제는 높은 권한의 SQL Editor에서만 합니다.
- 회원 목록에서 이메일·휴대전화·CI·정확한 생년월일·원문 답안은 노출하지 않습니다.
- 만 14세 미만 회원의 개인정보 동의 관련 기록은 기존 보호자 승인 및 RLS 정책을 그대로 따릅니다.

## 2. 메뉴

| 메뉴 | 내용과 측정 근거 |
| --- | --- |
| 운영 현황 | 회원 수, 학생/부모, 신규 가입, 현재 로그인 접속 회원, 오늘 활동 학생, 문제 풀이/정답률, 학습 시간, 이용 정지, 노출 중인 공지 |
| 회원 관리 | 닉네임/UUID 검색, 가입/최근 접속, 학생 학년과 보호자 동의 상태, 사유 기록 후 계정 정지/복구, 30명씩 페이징 |
| 공지사항 | 전체/학부모/학생 대상, 임시저장·게시·보관, 시작/종료시간, 목록에서 수정, 서버 권한 검증/작업 이력 |
| 학습 분석 | 최근 7일/30일 일별 활동 학생·문제 풀이·정답률·활성 학습 시간, 학년별 집계 |
| 서버·네트워크 | 사이트 HTTPS HEAD 응답, Supabase DB RPC 응답 지연, 운영자 브라우저 네트워크, 선택적으로 실제 호스트 CPU/메모리/디스크/송수신 속도 |
| 관리 이력 | 최근 60건의 공지 작성·수정·보관, 회원 정지/복구 및 사유 |

### 동시 접속자 정의

\`member_presence\`는 로그인된 활성 회원이 화면이 표시되는 동안 **30초 간격으로 갱신**합니다. 마지막 활동이 2분 이내인 **고유 로그인 계정 수**를 현재 접속자로 표시합니다. 이것은 동시 HTTP 연결 수가 아니며, 개인 브라우저 연결 장애/강제 종료 후 최대 2분 정도 차이가 생길 수 있습니다.

- **익명 GUEST 이용자는 포함하지 않습니다.** 자녀가 동의하지 않은 익명 학습 세션의 추적을 피하기 위한 의도적인 설계입니다.
- 전체 방문자 동시접속, 방문수/유입 경로는 개인정보 영향을 평가한 후 Cloudflare Web Analytics나 호스팅 사업자 로그/분석 도구를 추가해야 합니다.
- 현재 학습 시간은 기존 앱에서 저장한 \`active_time\` 이벤트를 합산합니다. 페이지 체류 시간 전체를 뜻하지 않습니다.

## 3. 서버·네트워크 모니터링 구성

브라우저에서 **Supabase 서버의 물리 CPU/RAM 값을 직접 조회하는 것은 불가능**합니다. 별도의 신뢰된 서버 측 모니터링 도구가 있어야 합니다.

### 최소 구성: 웹서버와 DB 상태 확인

Supabase Edge Function \`supabase/functions/admin-health/index.ts\` 배포. JWT 확인 활성화 상태 유지.

Edge Function Secret 값:

\`\`\`dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=SUPABASE_PUBLISHABLE_KEY
APP_ORIGIN=https://your-real-math-domain.example
MONITORED_APP_URL=https://your-real-math-domain.example
\`\`\`

- 호출할 때 로그인한 관리자의 JWT를 확인한 뒤 서버에서 \`admin_health_ping()\` RPC와 HTTPS HEAD를 실시합니다.
- 상태와 지연 시간은 관리자만 확인할 수 있습니다.
- 네트워크/서버 상태 값은 30초마다 갱신하거나 새로고침 버튼으로 조회합니다.

### 확장 구성: 소유 서버 CPU / RAM / 디스크 / 네트워크

\`monitor/host_metrics.py\`는 CPU·RAM·디스크·네트워크 RX/TX·업타임을 제공하는 선택적 Python 에이전트입니다.

\`\`\`bash
python3 -m pip install psutil
export METRICS_TOKEN="$(openssl rand -hex 32)"
export METRICS_BIND="127.0.0.1"
export METRICS_PORT="8765"
python3 monitor/host_metrics.py
\`\`\`

운영 서버 내에서 \`http://127.0.0.1:8765/metrics\`로 제공됩니다. **절대로 이 HTTP 포트를 공인 인터넷에 직접 열지 마세요.** 보호된 HTTPS 프록시(예: Cloudflare Tunnel + 별도 접근 제어 및 토큰 인증)로 백엔드가 접근하도록 설정해야 합니다.

\`\`\`bash
curl -H "Authorization: Bearer <STRONG_TOKEN>" http://127.0.0.1:8765/metrics
\`\`\`

HTTPS 프록시가 준비되면 Edge Function Secrets에:

\`\`\`dotenv
SERVER_METRICS_URL=https://protected-metrics.your-domain.example/metrics
SERVER_METRICS_BEARER=SAME_METRICS_TOKEN_AS_AGENT
\`\`\`

**주의:** \`SERVER_METRICS_BEARER\`는 외부에 노출하지 않으며, Vite 브라우저용 환경 변수에 설정하면 안 됩니다. 배포 서버의 CPU·메모리만 측정하며, 정적 웹사이트 자체가 별도 물리 서버를 쓰지 않으면 실제 호스팅 사업자의 메트릭 API를 따로 연결해야 합니다.

## 4. 공지사항 공개

공지사항은 \`site_announcements\`에 기록되고 RLS로 게시 대상에 맞게 공개됩니다.

- \`all\`: 로그인하지 않은 GUEST와 전체 회원
- \`parent\`: 로그인한 **학부모** 회원
- \`student\`: 로그인한 **학생** 회원
- 드래프트, 보관 상태, 게시 시작 전/종료 후 공지: 일반 이용자에게 노출되지 않음
- 본문은 **텍스트로 렌더링**하므로 HTML/스크립트를 직접 실행하지 않습니다.

사이트 방문자의 메인 상단에 최신 공지 최대 3건을 표시하며 각 공지를 개별 닫을 수 있습니다. 새 공지가 게시되면 사용자 화면을 새로 열었을 때 반영됩니다.

## 5. 필수 운영 QA

- [ ] 실제 Supabase에 기존 001~004 + 005 마이그레이션을 적용
- [ ] 최초 owner 계정을 SQL Editor에서 등록, 그 계정으로 관리자 로그인
- [ ] 학부모·학생·비로그인 각각 \`/?admin=1\` 시도 → 접근 거부 확인
- [ ] 관리자 회원 검색, 30명 페이징, 정지/복구, 처리 사유와 감사 이력 확인
- [ ] 계정 정지 후 기존 열린 학습 페이지의 신규 학습기록 읽기/쓰기 서버 차단 확인
- [ ] 공지 작성, 임시저장, 미래 예약게시, 종료시각, 보관, 대상별 RLS 검증
- [ ] 학습 통계의 정답률/학습 시간과 실제 \`learning_events\` SQL 집계 비교
- [ ] 2분 현재 접속 추정치 + 로그아웃/탭 백그라운드 동작 점검
- [ ] \`admin-health\` Edge Function의 비관리자 접근 거부와 실제 DB/HTTPS 지연 점검
- [ ] 서버 메트릭 에이전트를 사용할 경우 HTTPS 보호, Bearer 토큰 비밀 관리 검증
- [ ] 운영 배포 전 개인정보 고지·삭제·보존·민원 처리, 관리자 역할 변경 절차 법무/보안 검수

**주의:** 이 PR의 코드는 테스트 및 검토 대상으로 현재 \`main\` 브랜치에 자동 배포되지 않습니다. 외부 인증 및 실제 Supabase/호스팅 자격 증명 없이는 운영 데이터 연동을 현장에서 검증하지 못합니다.
