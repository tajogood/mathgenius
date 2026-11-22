# 수학천재 SEO · Google / 네이버 배포 점검

이 문서는 학부모·초등 교사·교육청/교육 연구 관계자를 대상으로 하는 검색 노출을 준비하기 위한 **기술/콘텐츠 SEO** 설정 절차입니다. 검색 순위나 색인은 검색엔진이 결정하며, 코드 적용만으로 보장되지 않습니다.

## 1. 배포할 실제 도메인을 지정하세요

이 프로젝트는 Vite 기반이며, 배포 후 하나의 대표 HTTPS URL을 정해야 합니다. 현재 저장소에는 실제 수학천재 배포 도메인이 확정돼 있지 않으므로 **추정 주소를 canonical로 사용하지 않습니다.**

**빌드 환경변수** `SITE_URL`에 실제 배포 URL을 지정합니다.

```bash
SITE_URL=https://YOUR_REAL_DOMAIN/ npm run build
```

서브폴더 배포라면 예: `SITE_URL=https://your-real-domain.com/math/` 로 지정하고, 호스팅의 기본 경로/정적 라우팅도 일치하게 설정하세요. 독립 도메인의 루트(`/`) 배포를 권장합니다.

GitHub Actions를 통한 빌드에서는 저장소 **Settings → Secrets and variables → Actions → Variables**에 `SITE_URL`, `GOOGLE_SITE_VERIFICATION`, `NAVER_SITE_VERIFICATION` 변수를 등록하면 빌드 과정으로 자동 전달됩니다. 도메인과 인증값이 확정되기 전에는 비워 두세요. 실제 서비스 배포 플랫폼에서도 같은 환경변수를 설정해야 합니다.

빌드 시 생성 결과:
- `dist/index.html`: 검색로봇이 자바스크립트 없이 읽을 수 있는 랜딩 본문 + canonical/OG URL/JSON-LD + Google·네이버 인증 태그
- `dist/for-parents/index.html`: 학부모용 가정학습·복습 소개
- `dist/for-teachers/index.html`: 초등학교 교사용 탐구·교구 수업 자료 소개
- `dist/for-education/index.html`: 교육 관계자용 교육과정·콘텐츠 검토 안내
- `dist/curriculum/index.html`: 학년별 수학 학습 단원 개요
- `dist/curriculum/grade-1/…grade-6/index.html`: 실제 학년별 단원 데이터에서 만든 1·2학기 안내
- `dist/sitemap.xml`: 설정한 도메인의 **11개 공개 URL** 목록
- `dist/robots.txt`: 검색로봇 허용 및 사이트맵 위치

`SITE_URL`이 없는 개발 빌드에서는 공개 HTML과 `robots.txt`는 생성되지만 **절대 URL인 canonical과 sitemap.xml은 생성하지 않습니다.** 배포 환경변수로 설정하세요.

## 2. Google Search Console 설정

1. https://search.google.com/search-console 에서 실제 도메인 속성(권장) 또는 URL 접두어 속성을 등록합니다.
2. DNS TXT 인증 또는 HTML 태그 인증을 사용합니다. HTML 태그라면 구글에서 제공한 `content` 값만 빌드 환경변수에 등록하세요.
3. `GOOGLE_SITE_VERIFICATION` 환경변수 설정 후 재빌드·재배포합니다. 소스코드에 임의의 인증 값을 넣지 마세요.
4. `https://실제도메인/sitemap.xml` 을 제출하고 홈페이지 및 각 안내 페이지에 대해 URL 검사를 수행합니다.
5. 색인 상태, 페이지 검색 노출, 클릭/노출/검색어, 모바일 사용성과 구조화 데이터 오류를 주기적으로 확인하세요.

예:
```bash
SITE_URL=https://YOUR_REAL_DOMAIN/ GOOGLE_SITE_VERIFICATION=GOOGLE_TOKEN npm run build
```

참고: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics

## 3. 네이버 서치어드바이저 설정

1. https://searchadvisor.naver.com 에서 운영 도메인을 사이트로 등록합니다.
2. HTML 메타태그 소유확인 방식으로 등록한다면 `NAVER_SITE_VERIFICATION`에 네이버가 발급한 `content` 값을 입력합니다.
3. 재빌드·재배포 후 홈페이지의 `naver-site-verification` 태그를 네이버에서 확인합니다.
4. `robots.txt` 확인과 `sitemap.xml` 제출, URL 검사 및 사이트 최적화 리포트를 점검합니다.
5. 페이지 제목과 description을 실제 공개된 본문과 일치시키세요. 반복 키워드·무관한 검색어를 덧붙이지 않습니다.

예:
```bash
SITE_URL=https://YOUR_REAL_DOMAIN/ NAVER_SITE_VERIFICATION=NAVER_TOKEN npm run build
```

참고: https://searchadvisor.naver.com/guide/seo-basic-create

## 4. 검색 대상에 포함한 콘텐츠와 하지 않은 콘텐츠

**검색을 허용할 공개 정보:**
- 수학천재 서비스 소개
- 학부모 대상 가정학습·오답 복습 방법
- 초등 교사 대상 개념 탐구·교구 활용 아이디어
- 교육청/교육 연구 관계자 대상 검토 항목
- 학년별 수학 단원 목록과 1~6학년 안내

**검색하지 않도록 취급할 비공개 정보:**
- 학생 개인정보, 개별 오답 이력, 학습 시간, 가족 연결 관계
- 학부모 대시보드, 회원 정보, 숙제 정보

현재 회원 화면은 정적 SEO 경로에 포함되지 않으며 인증/RLS로 보호하도록 설계되어 있습니다. 검색 차단(`robots.txt`)만으로 개인정보를 보호할 수 없으므로, 서비스 배포 전에 실제 계정별 접근 통제와 법정대리인 동의 절차를 검증해야 합니다.

**교육 관련 표현:** 2022 개정 교육과정과 121개 성취기준에 대한 자체 연결을 설명하되, 교육부/교육청의 공식 서비스, 검증·인증, 학교의 성취평가를 의미한다고 주장하지 않습니다.

## 5. 배포 체크리스트

- [ ] HTTPS 도메인 확정, www ↔ 비-www 중 대표 1개로 301/308 리디렉션
- [ ] `SITE_URL`을 실제 대표 URL로 설정, 빌드 결과 canonical 주소 검토
- [ ] `/robots.txt` HTTP 200, `/sitemap.xml` HTTP 200, 페이지별 <loc> 주소 검토
- [ ] `/for-parents/`, `/for-teachers/`, `/for-education/`, `/curriculum/`, `/curriculum/grade-1/` 등의 URL이 **각기 다른 정적 HTML**을 HTTP 200으로 제공하는지 확인
- [ ] SPA fallback이 위 정적 페이지를 `index.html`로 덮어쓰지 않는지 확인
- [ ] 홈페이지의 첫 HTML 응답에 소개 본문, 메타 태그, JSON-LD가 존재하는지 확인
- [ ] Google Search Console 소유확인·sitemap 제출 및 URL 검사
- [ ] 네이버 서치어드바이저 소유확인·sitemap 제출 및 URL 검사
- [ ] Google 리치 결과 테스트로 구조화 데이터 유효성 점검: https://search.google.com/test/rich-results
- [ ] 개인정보를 포함한 학습·대시보드 URL이 공개 정보로 검색되지 않는지 확인
- [ ] 공개 페이지의 학년·단원 설명을 정기적으로 교과 전문가가 검수

## 6. 구현과 측정의 구분

검색 키워드를 무조건 반복하거나 실재하지 않는 후기·교육적 인증·도입 사례를 만들어 넣지 않습니다. Google/Naver의 실제 순위는 크롤링, 콘텐츠의 품질, 외부 링크, 성능 등 여러 요인의 영향을 받으므로, 배포 후 Search Console과 서치어드바이저의 검색어/노출 지표를 기반으로 개선해야 합니다.

관련 문서: [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) · [네이버 웹사이트 SEO](https://searchadvisor.naver.com/guide/seo-basic-intro)
