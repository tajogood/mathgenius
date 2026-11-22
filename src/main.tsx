import React from 'react';
import { createRoot } from 'react-dom/client';
import Portal from './member/Portal';
import './styles.css';
import './styles/interactive.css';
import './styles/standards.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Portal />
  </React.StrictMode>,
);
