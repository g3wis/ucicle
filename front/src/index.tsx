import React from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './app/App';
import { AppProvider } from './app/context';
import { pageKey, pageLang } from './i18n/language';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find the root element');
}

createRoot(rootElement).render(
  <React.StrictMode>
    {/* "user": motion follows the system's reduced-motion setting everywhere. */}
    <MotionConfig reducedMotion="user">
      <AppProvider lang={pageLang()} page={pageKey()}>
        <App />
      </AppProvider>
    </MotionConfig>
  </React.StrictMode>,
);
