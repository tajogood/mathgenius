# 수학천재 회원·학부모 학습관리 설정

## 배포 단계 (현재 브랜치는 기능 구현 초안)
- 기존 GUEST는 `/?guest=1` 로 바로 들어갈 수 있고, 랜딩에서 GUEST 체험을 선택해도 됩니다.
- 인증 서버가 구성되지 않아도 GUEST 모드의 기존 로컬 학습 기능은 유지됩니다.
- Google/Kakao 소셜 로그인 및 학습 기록·숙제는 Supabase를 생성하고 인증 공급자 정보를 설정한 뒤에만 동작합니다.

## 1. Supabase 프로젝트
1. 새 프로젝트 생성 후 SQL Editor에서 `supabase/migrations/202611230001_membership.sql` 적용.
2. `.env.example`을 `.env.local`로 복사. `VITE_SUPABASE_URL` 및 공개 가능한 publishable(anon) key 입력.
3. **절대로** `service_role`, OAuth client secret, 비밀번호를 `VITE_*` 변수에 입력하지 마세요.
4. Auth > URL Configuration의 Site URL 및 Redirect URLs에 실제 도메인/개발 주소 추가.
5. Auth > Providers에서 Google 및 Kakao 활성화. 각각의 공식 개발자 콘솔에서 앱, 리디렉션 URI, 서버측 Client Secret 설정.
6. 정적 SPA OAuth 리디렉션은 `signInWithOAuth`와 Supabase의 세션 파서로 처리.

공식 문서:
- https://supabase.com/docs/guides/auth/social-sign-in/auth-google
- https://supabase.com/docs/guides/auth/social-sign-in/auth-kakao
- https://supabase.com/docs/guides/auth/row-level-security

## 2. 만 14세 미만 아동 가입과 법정대리인 동의 (기본: PASS)

**[PASS 휴대전화 본인확인 운영·배포 설정](PASS_GUARDIAN_SETUP.md)** 문서를 먼저 읽어 주세요. 과거 이메일 회신 방식은 [별도 안내](GUARDIAN_CONSENT.md)에 유지했습니다.

- `src/member/legal.ts`는 아직 법무 검수 전 **약관·개인정보 처리방침 초안**이며, 공개 출시를 승인하는 근거가 아닙니다.
- 개인정보 보호법 제22조의2 및 시행령 제17조의2에 따라, 학생 연결코드로 학부모 계정을 연결하는 것과 법정대리인 **동의 여부를 확인하는 것**은 서로 다른 단계입니다.
- 신규 가입 기본 경로는 **법정대리인 동의 체크 → PASS 휴대전화 본인확인 → 포트원 서버 API 재검증 → 승인 코드 발급 → 자녀 로그인**입니다. 시행령 제17조의2의 휴대전화 본인확인 방법을 적용합니다. 기존 이메일 회신 대안은 개발 브랜치에 남아 있지만 신규 화면은 PASS가 기본입니다.
- SQL 마이그레이션을 **001(기본) → 002(동의 이메일) → 003(부모 우선 가입) → 004(PASS)** 순서로 적용합니다. 마지막 파일: `supabase/migrations/202611230004_guardian_pass.sql`.
- `supabase/functions/guardian-pass` Edge Function을 설치하고 **포트원 V2/KG이니시스 통합인증 PASS 채널**의 서버측 API Secret 및 공개 상점/채널 식별자를 등록해야 합니다. 이메일 서버는 PASS 기본 경로에 필요하지 않습니다.
- PASS 인증 화면의 클라이언트 응답 또는 체크박스만으로는 `guardian_consent_requests.status='verified'`가 될 수 없습니다. **서버가 포트원 인증 내역을 직접 조회한 후에만** 승인됩니다.
- 학부모 화면에서 동의 철회가 가능하며, 철회하면 연결된 학생의 서버측 학습 기록 저장·열람이 차단됩니다.
- 만 14세 미만의 **신규 가입은 학부모 주도 동의 이메일 승인 → 자녀 승인 코드 → 자녀 OAuth** 순서로 진행합니다. 학생이 직접 만 14세 미만 프로필을 삽입할 수 없도록 서버에서 차단합니다.
- **출시 전 보완:** 포트원 가맹점 실계약/키, 실제 PASS 성공·실패 검증, 생년월일 허위신고 대응, 자녀와 보호자 실제 법정대리인 관계 증명 필요 시 추가 확인, 개인정보 삭제·보존 및 법률 검토가 여전히 필요합니다.

법령: https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029335069

## 3. 계정과 데이터 모델
- `member_profiles`: SNS ID, 역할(student/parent), 닉네임/학년, 연령 플래그, 약관 동의 이력.
- `parent_student_links`: 역할이 다른 독립 계정 간 링크, 미성년자 법정대리인 동의 증빙 여부.
- `student_pairing_codes`: 128비트 1회용 코드, 15분 TTL, 서버측 해시 저장.
- `learning_snapshots`: 단원별 개념 정오답 진도 + 121개 성취기준 달성 상태.
- `learning_events`: 단원 방문, 오답, 교구 체험, 활동 시간. 답안 원문은 저장하지 않음.
- `homework_assignments`: 학부모→학생 단원 숙제와 완료 상태.
- 테이블에 RLS를 적용하여 학생은 본인 기록, 보호자는 권한 확인된 연결 학생 기록만 접근합니다.
- 학부모는 연결코드를 입력하고, 만 14세 미만 학생은 검증 후 열람할 수 있습니다. 학부모/학생 모두 **각자 SNS 계정으로 가입**합니다.

## 4. 학습 통계와 추천
- 학생은 로그인하면 미완료 숙제가 있으면 해당 단원으로 바로 이동합니다.
- 학습 시간은 20초 단위로, 탭이 보이고 최근 90초 내 사용자 입력이 있었을 때 집계합니다. 완벽한 집중도 측정은 아닙니다.
- 오답이 많거나 정답률이 낮은 개념을 복습 추천합니다. 복습 대상이 없으면 해당 학년의 미달성 단원을 추천합니다.
- 부모는 학생별 정답률, 단원 진도율, 오답 개념 및 반복 방문을 확인할 수 있습니다.
- 학습 이벤트 기반 시간/반복 통계는 최근 2,000건을 집계합니다. 장기 누적 통계는 서버측 rollup/summary로 확장해야 합니다.
- GUEST 기존 `localStorage` 기록은 자동으로 회원 계정에 업로드하지 않습니다(명시적 동의 없는 데이터 이전 방지).
- 숙제 완료 버튼은 해당 단원의 개념 달성을 마친 후에만 사용 가능합니다.

## 5. 점검 목록
- [ ] Google / Kakao 각자 가입 및 재로그인, 다른 기기에서도 동일 진도 복원
- [ ] 학생/부모 역할 오선택 및 연결 해제·동의 철회
- [ ] 보안: 다른 보호자의 학생 기록 접근 불가 (RLS test)
- [ ] 만 14세 미만 보호자 본인확인 서버 및 법정대리인 동의 증빙
- [ ] 약관 법무 검수, 아동 친화적 고지, 데이터 삭제/열람 청구 처리
- [ ] 숙제 생성→학생 자동 단원 이동→수학 개념 달성→완료
- [ ] 학습 시간 idle/숨김 처리, 반복 보기와 실수 복습 안내
- [ ] Android Capacitor 환경의 OAuth 리디렉션 및 브라우저/PWA 복귀 검증

이 브랜치는 **인증·데이터·화면의 통합 기반**이며, 민감한 개인정보 기능의 운영 배포를 승인하는 문서가 아닙니다.
