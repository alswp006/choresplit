// @AI:ANCHOR — 이 파일은 scaffold가 생성합니다. 코딩 에이전트가 수정하지 마세요.
// Provider 추가가 필요하면 App.tsx를 수정하세요.
// TDSMobileAITProvider: 토스 앱인토스 환경 통합 Provider.
//   내부적으로 TDSMobileProvider + GlobalCSSVariables(--adaptive*)
//   + SafeAreaInsets(--toss-safe-area-*) 자동 주입.
//   userAgent 자동 파싱, brandPrimaryColor는 apps-in-toss.config.ts에서 자동.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
import App from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TDSMobileAITProvider>
      {/*
        basename은 반드시 BASE_URL을 따라야 한다 — 없으면 **미리보기가 항상 흰 화면**이다.
        폰 미리보기는 GitHub Pages 프로젝트 사이트라 `/<repo>/` 아래에 붙고, phone-preview가
        `vite build --base /<repo>/`로 다시 빌드한다. 그런데 basename이 없으면 라우터는
        pathname `/splitmate/`를 보고 `<Route path="/">`와 매칭하지 못해 **아무것도 렌더하지
        않는다.** 에러도 안 난다 — 그래서 "흰 화면, 콘솔 오류 없음"으로만 보였다.

        실측(2026-08-03, 템플릿 그대로 빌드):
          basename 없음 → 글자 0자 · 보이는 요소 1개(root 껍데기) · root innerHTML 44자
          basename 있음 → 글자 137자 · 보이는 요소 38개 · root innerHTML 6,158자
        토스 배포용 빌드는 base가 "/"라 BASE_URL도 "/"가 되어 동작이 동일하다.
      */}
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </TDSMobileAITProvider>
  </React.StrictMode>,
);
