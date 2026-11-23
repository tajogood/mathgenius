import React, {lazy,Suspense} from 'react';
import { createRoot } from 'react-dom/client';
import Portal from './member/Portal';
import './styles.css';
import './styles/interactive.css';
import './styles/standards.css';

const AdminPanel=lazy(()=>import('./admin/AdminPanel.tsx'));
const isAdminRoute=window.location.pathname.replace(/\/$/,'')==='/admin' ||
  new URLSearchParams(window.location.search).get('admin')==='1';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isAdminRoute?
      <Suspense fallback={<p style={{padding:'40px',textAlign:'center'}}>관리자 화면을 준비 중입니다…</p>}>
        <AdminPanel/>
      </Suspense>:
      <Portal/>}
  </React.StrictMode>,
);
