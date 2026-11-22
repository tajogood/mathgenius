# Android·PWA 배포 준비

수학천재는 React/TypeScript 기반 학습 교구를 그대로 재사용하여 Android에서도 동일한 동작을 제공하도록 설계되어 있습니다.

## 현재 상태

- **웹앱:** 브라우저에서 실행되고 71개 단원의 83개 대표 유형이 동작
- **PWA:** `vite-plugin-pwa`가 프로덕션 빌드 시 서비스 워커와 오프라인 캐시를 생성; 기존 한국어 Web App Manifest 유지
- **Android 래퍼:** `capacitor.config.ts`에 `webDir: 'dist'`, 앱 이름·ID 설정
- **미완성:** Android Studio 네이티브 프로젝트를 저장소에 아직 생성·커밋하지 않았고, APK/AAB 빌드와 실기기 검증 및 스토어 등록은 진행하지 않음

## PWA 로컬 테스트

```bash
npm install --legacy-peer-deps
npm run build
npm run preview
```

프로덕션 빌드에서 `dist/sw.js`와 `dist/manifest.webmanifest`가 생성되는지 확인합니다. 브라우저에서 HTTPS(또는 localhost)로 앱에 방문한 뒤 오프라인 캐시가 준비되면 네트워크를 끊고 같은 화면을 다시 열 수 있어야 합니다.

자동 검사:

```bash
npx playwright install chromium
npm run test:offline
```

오프라인 기능은 처음 방문할 때 자료를 내려받아야 하므로, **처음부터 네트워크가 없는 환경에서는 설치·오프라인 시작이 불가능**합니다.

## Android 프로젝트 생성

Android Studio와 Android SDK가 설치된 개발 장비에서 다음 명령으로 Capacitor Android 프로젝트를 생성합니다.

```bash
npm install --legacy-peer-deps
npm run android:init
npm run android:open
```

이미 `android/` 프로젝트가 있다면 수정 후:

```bash
npm run android:sync
npm run android:open
```

프로젝트는 Capacitor가 `dist/`의 웹 콘텐츠를 네이티브 WebView로 복사해 실행합니다. 앱에 별도 서버나 학습 데이터베이스가 없어도 문제 생성과 연습 기능은 동작하도록 설계되어 있습니다.

현재 앱 ID는 개발용 `kr.larix.mathgenius`로 설정했습니다. 스토어 출시에 앞서 실제 사용 가능한 패키지 ID와 소유권을 확정해야 합니다. 패키지 ID를 출시한 뒤 바꾸면 새 앱으로 취급될 수 있습니다.

## 출시 전에 확인할 항목

1. Android Studio의 최신 SDK 및 필수 개발 도구 설치
2. APK/AAB 빌드 성공, 디지털 서명/버전 코드, 앱 아이콘 및 Android 13+ 등 현재 배포 요구 사항
3. Android 휴대폰/태블릿에서 실제 터치·드래그·가로모드·접근성·메모리 점검
4. 자녀 개인정보 처리·학부모 안내 및 앱 내 정책·지원 정보 점검
5. 학습 진도의 기기 간 이동이 아직 지원되지 않음(로컬 저장만 지원)

`npm run test:viewport`는 데스크톱 Chromium의 크기/터치 에뮬레이션이며 실제 Android WebView 테스트를 대체하지 않습니다.
