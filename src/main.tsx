import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { StartupErrorBoundary } from './components/common/StartupErrorBoundary.tsx';
import './index.css';

console.info('[STARTUP] JavaScript loaded');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StartupErrorBoundary>
      <App />
    </StartupErrorBoundary>
  </StrictMode>
);
