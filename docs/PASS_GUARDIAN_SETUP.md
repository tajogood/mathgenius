# 만 14세 미만 자녀 가입: 부모 동의 + PASS 휴대전화 본인확인

## 신규 회원가입 설계

1. **부모님**이 Google 또는 카카오 계정으로 수학천재 학부모 회원가입
2. 학부모 대시보드의 **「만 14세 미만 자녀 회원가입 승인」**에서 자녀 닉네임·학년, 법정대리인 실명과 관계 입력
3. 학부모가 **법정대리인 지위 선언**과 **아동 개인정보 수집·이용 동의**를 각각 체크
4. **「PASS 휴대전화 본인확인 및 부모 동의 완료」** 클릭
5. 포트원 V2 → KG이니시스 통합인증 → PASS 앱 인증 화면 진행
6. 클라이언트의 ‘인증 성공’ 표시를 믿지 않고 **Edge Function 서버에서 포트원 REST API**로 다음 항목 재확인
   - 서버가 미리 발급한 단일 인증 ID와 실제 인증 기록이 일치하는지
   - 상태가 `VERIFIED`인지, 지정한 본인확인 채널인지
   - 가입 화면의 법정대리인 **실명과 본인인증 실명 일치**
   - 휴대전화·CI 및 **성인 생년월일** 확인 (민감한 원본은 DB에 저장하지 않음)
   - 인증을 시작한 학부모 계정과 현재 로그인 계정이 일치하는지
   - 15분 이내의 인증이며 이미 완료된 요청이 아닌지
7. 인증 완료 시 `guardian_consent_requests`의 `verified`/타임스탬프와 `verification_method='pass'` 기록
8. 부모님이 **자녀 가입 승인 코드 발급** → 자녀에게 전달
9. 자녀가 승인 코드를 먼저 입력한 다음 소셜 로그인 → DB가 학생 프로필과 학부모 연결을 **원자적으로 생성**
10. 부모 동의 철회 시 해당 학생 학습기록 읽기·쓰기 권한 차단

> **PASS가 증명하는 것은 본인 명의의 휴대전화로 인증한 사람의 신원입니다.** 해당 아동과의 친권·후견 관계를 가족관계등록부에서 자동 조회한 것은 아닙니다. 법정대리인 선언과 동의 기록을 별도로 남기고, 신원·관계 관련 다툼에 대한 운영 정책을 마련해야 합니다.

법령 근거: 개인정보 보호법 제22조의2, 시행령 제17조의2 제1항. 법령은 화면 동의 의사 표시 + 법정대리인의 휴대전화 본인인증에 의한 확인 방법을 인정합니다.

## 제공업체 및 도메인 계약·설정 (외부 개통 전 필수)

이 저장소에는 **실제 포트원 계정/채널/비밀키가 등록되어 있지 않습니다.**

1. [포트원(PortOne) 관리자 콘솔](https://admin.portone.io/)에 상점 등록
2. KG이니시스 **통합인증** 가맹점/채널 계약 후 PASS를 이용할 수 있도록 채널 구성
3. 콘솔에서 `Store ID`, **통합인증 채널 Key**, V2 **API Secret** 확인
4. Supabase 프로젝트에 SQL 마이그레이션 **001 → 002 → 003 → 004** 순서로 적용
   - `supabase/migrations/202611230004_guardian_pass.sql`
5. Supabase Edge Function `guardian-pass` 배포 및 JWT verification 활성화
6. 아래 **Edge Function Secrets** 등록:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=SERVER_ONLY_SUPABASE_SERVICE_ROLE_KEY
APP_ORIGIN=https://YOUR_MATHGENIUS_DOMAIN
GUARDIAN_PASS_ENABLED=true
PORTONE_STORE_ID=store-...
PORTONE_PASS_CHANNEL_KEY=channel-key-...
PORTONE_API_SECRET=SERVER_ONLY_V2_API_SECRET
```

- `PORTONE_API_SECRET`와 `SUPABASE_SERVICE_ROLE_KEY`는 서버 비밀환경변수로만 사용합니다. **절대로** `VITE_*` / `.env.local`의 공개 브라우저 변수로 넣지 마세요.
- `PORTONE_STORE_ID`와 `PORTONE_PASS_CHANNEL_KEY`는 SDK 요청에서 사용되므로 클라이언트에 전달해도 되는 공개 식별자입니다.
- `APP_ORIGIN`은 실제 HTTPS 서비스 출처(예: `https://math.example.com`)만 지정합니다. 모바일의 PASS 복귀 URL은 `https://.../?guardian_pass=1&request_id=...`이며, 복귀 후에도 서버가 인증결과를 재검증합니다.
- 로컬 개발·검증은 실제 계약된 포트원 테스트채널의 제공 여부 및 통신사 정책에 따라 달라집니다. 테스트 응답을 운영 DB에 승인 기록으로 남기지 마세요.

## 구현 파일

- `src/member/Portal.tsx`: 가입/부모 동의/성명·관계 입력, PASS 버튼, 모바일 복귀, 승인 코드 UI
- `src/member/pass.ts`: 포트원 V2 SDK를 버튼 클릭 시에만 불러와 `directAgency:'PASS'`로 인증창 호출
- `supabase/functions/guardian-pass/index.ts`: 학부모 JWT 확인, 시작/완료 API, 포트원 인증내역 서버 검증
- `supabase/migrations/202611230004_guardian_pass.sql`: 비공개 RPC, 성명·성인 연령 대조, 중복·만료 승인 방지

공식 연동 문서:
- https://developers.portone.io/opi/ko/extra/identity-verification/readme-v2
- https://developers.portone.io/opi/ko/integration/pg/v2/inicis-unified-identity-verification
- https://developers.portone.io/api/rest-v2/identityVerification

## 출시 전 확인

- [ ] 실제 PASS 채널을 계약하고 Supabase Edge Function 비밀값 등록
- [ ] 부모 명의의 휴대전화로 PASS 인증 → 서버 `VERIFIED` 검사 → 자녀 승인 코드까지 전체 실제 기기 테스트
- [ ] 모바일에서 PASS 앱으로 이동했다가 복귀하는 흐름 확인
- [ ] 다른 학부모의 인증 ID, 실패·취소·만료 인증, 성명이 다른 사람, 만 19세 미만 신원 시도 모두 차단
- [ ] 고객 동의문·개인정보처리방침·보존기간·위탁 및 국외이전·정보주체 권리/삭제·철회 등 법률 검수
- [ ] 실제 아동의 본인 가입 연령 허위신고·가입 경로 우회 방지 정책
- [ ] PASS 인증으로 자동 증명되지 않는 **법정대리인과 학생의 실제 관계**에 대한 사후 증명 및 이의제기 절차 설계

**현재는 동작 가능한 인터페이스와 서버 검증 로직을 코드에 연결한 단계입니다.** 공급업체 계약, 실제 API 키 및 라이브 성공 테스트가 끝나지 않은 상태에서는 'PASS 연동 완료/상용 이용 가능'으로 표시하지 마세요.

기존 이메일 회신 경로와 수동 운영자 승인 방법은 [기존 가이드](GUARDIAN_CONSENT.md)를 참고하세요. 신규 가입의 권장 방식은 PASS입니다.
