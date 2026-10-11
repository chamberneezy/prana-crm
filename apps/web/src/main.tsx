import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DemoPage } from './demo/DemoPage';
import { LangProvider } from './i18n';
import './styles/tokens.css';
import './styles/base.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LangProvider>
      <DemoPage />
    </LangProvider>
  </StrictMode>,
);
